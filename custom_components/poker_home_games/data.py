"""Datenhaltung und Statistik für Poker Home Games."""

from __future__ import annotations

import copy
import csv
from datetime import date, datetime, time, timedelta
from typing import Any
import uuid

from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.storage import Store
from homeassistant.util import slugify

from .const import (
    CSV_EXPORT,
    DOMAIN,
    EVENT_SPIELTAG_GEAENDERT,
    EVENT_SPIELTAG_GESPEICHERT,
    SIGNAL_UPDATE,
    STORAGE_VERSION,
)


def _r(wert: float) -> float:
    return round(wert + 0.0, 2)


def fmt_eur(wert: float) -> str:
    """Betrag im deutschen Format, z. B. +12,50."""
    text = f"{abs(wert):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return ("+" if wert > 0 else "−" if wert < 0 else "") + text


def dauer_stunden(spieltag: dict[str, Any]) -> float | None:
    """Spieldauer in Stunden, Ende nach Mitternacht wird berücksichtigt."""
    beginn, ende = spieltag.get("beginn"), spieltag.get("ende")
    if not beginn or not ende:
        return None
    b = datetime.combine(date.min, time.fromisoformat(beginn))
    e = datetime.combine(date.min, time.fromisoformat(ende))
    if e <= b:
        e += timedelta(days=1)
    return round((e - b).total_seconds() / 3600, 2)


class PokerData:
    """Spieler und Spieltage, gespeichert in .storage."""

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(
            hass, STORAGE_VERSION, f"{DOMAIN}.{entry_id}"
        )
        self.spieler: dict[str, dict[str, Any]] = {}
        self.spieltage: list[dict[str, Any]] = []
        self._statistik: dict[str, Any] | None = None

    # ------------------------------------------------------------ Speicher
    async def async_load(self) -> None:
        daten = await self._store.async_load() or {}
        self.spieler = daten.get("spieler", {})
        self.spieltage = daten.get("spieltage", [])
        self._statistik = None

    async def async_save(self) -> None:
        self._statistik = None
        await self._store.async_save(
            {"spieler": self.spieler, "spieltage": self.spieltage}
        )
        snapshot = (copy.deepcopy(self.spieler), self.sortiert())
        await self.hass.async_add_executor_job(self._schreibe_csv, *snapshot)
        async_dispatcher_send(self.hass, SIGNAL_UPDATE)

    def _schreibe_csv(self, spieler: dict, spieltage: list) -> None:
        """Excel-taugliche Kopie aller Spieltage (Semikolon, Dezimalkomma)."""

        def zahl(wert: float | None) -> str:
            return "" if wert is None else f"{wert:.2f}".replace(".", ",")

        with open(
            self.hass.config.path(CSV_EXPORT), "w", encoding="utf-8-sig", newline=""
        ) as datei:
            writer = csv.writer(datei, delimiter=";")
            writer.writerow(
                ["Datum", "Beginn", "Ende", "Dauer (h)", "Bezeichnung", "Ort",
                 "Spieler", "Einsatz", "Endstand", "Gewinn"]
            )
            for tag in spieltage:
                dauer = dauer_stunden(tag)
                for erg in tag["ergebnisse"]:
                    name = spieler.get(erg["spieler"], {}).get("name", erg["spieler"])
                    writer.writerow(
                        [
                            tag["datum"], tag.get("beginn") or "", tag.get("ende") or "",
                            zahl(dauer), tag.get("bezeichnung") or "",
                            tag.get("ort") or "", name,
                            zahl(erg["einsatz"]), zahl(erg["einsatz"] + erg["gewinn"]),
                            zahl(erg["gewinn"]),
                        ]
                    )

    # ------------------------------------------------------------ Spieler
    def spieler_id(self, name_oder_id: str) -> str | None:
        """Spieler über ID oder Namen (ohne Groß-/Kleinschreibung) finden."""
        if name_oder_id in self.spieler:
            return name_oder_id
        gesucht = name_oder_id.strip().casefold()
        for pid, sp in self.spieler.items():
            if sp["name"].casefold() == gesucht:
                return pid
        slug = slugify(name_oder_id)
        return slug if slug in self.spieler else None

    def spieler_hinzufuegen(self, name: str) -> str:
        name = name.strip()
        if not name:
            raise ValueError("name_leer")
        if self.spieler_id(name):
            raise ValueError("name_vorhanden")
        pid = slugify(name)
        self.spieler[pid] = {"name": name, "aktiv": True}
        return pid

    def aktive_spieler(self) -> dict[str, str]:
        return {
            pid: sp["name"]
            for pid, sp in sorted(self.spieler.items(), key=lambda x: x[1]["name"])
            if sp.get("aktiv", True)
        }

    # ------------------------------------------------------------ Spieltage
    def sortiert(self) -> list[dict[str, Any]]:
        return sorted(
            copy.deepcopy(self.spieltage),
            key=lambda t: (t["datum"], t.get("beginn") or ""),
        )

    async def async_spieltag_speichern(
        self,
        datum: date,
        beginn: time | None,
        ende: time | None,
        bezeichnung: str,
        ergebnisse: list[tuple[str, float, float]],
        ort: str = "",
    ) -> dict[str, Any]:
        """Spieltag anlegen, speichern und Event auslösen."""
        spieltag = {"id": uuid.uuid4().hex}
        spieltag.update(
            self._felder(datum, beginn, ende, bezeichnung, ort, ergebnisse)
        )
        self.spieltage.append(spieltag)
        await self.async_save()
        info = self.spieltag_info(spieltag)
        self.hass.bus.async_fire(EVENT_SPIELTAG_GESPEICHERT, info)
        return info

    @staticmethod
    def _felder(
        datum: date,
        beginn: time | None,
        ende: time | None,
        bezeichnung: str,
        ort: str,
        ergebnisse: list[tuple[str, float, float]],
    ) -> dict[str, Any]:
        return {
            "datum": datum.isoformat(),
            "beginn": beginn.strftime("%H:%M") if beginn else None,
            "ende": ende.strftime("%H:%M") if ende else None,
            "bezeichnung": (bezeichnung or "").strip(),
            "ort": (ort or "").strip(),
            "ergebnisse": [
                {"spieler": pid, "einsatz": _r(einsatz), "gewinn": _r(gewinn)}
                for pid, einsatz, gewinn in ergebnisse
            ],
        }

    def _finde(self, spieltag_id: str) -> dict[str, Any]:
        for tag in self.spieltage:
            if tag["id"] == spieltag_id:
                return tag
        raise KeyError(spieltag_id)

    async def async_spieltag_aendern(
        self,
        spieltag_id: str,
        datum: date,
        beginn: time | None,
        ende: time | None,
        bezeichnung: str,
        ergebnisse: list[tuple[str, float, float]],
        ort: str = "",
    ) -> dict[str, Any]:
        """Vorhandenen Spieltag komplett ersetzen (ID bleibt)."""
        tag = self._finde(spieltag_id)
        tag.update(self._felder(datum, beginn, ende, bezeichnung, ort, ergebnisse))
        await self.async_save()
        info = self.spieltag_info(tag)
        self.hass.bus.async_fire(EVENT_SPIELTAG_GEAENDERT, info)
        return info

    async def async_spieltag_loeschen(self, spieltag_id: str) -> dict[str, Any]:
        tag = self._finde(spieltag_id)
        info = self.spieltag_info(tag)
        self.spieltage = [t for t in self.spieltage if t["id"] != spieltag_id]
        await self.async_save()
        return info

    def letzter_spieltag(self) -> dict[str, Any] | None:
        tage = self.sortiert()
        return tage[-1] if tage else None

    async def async_letzten_loeschen(self) -> dict[str, Any] | None:
        letzter = self.letzter_spieltag()
        if letzter is None:
            return None
        self.spieltage = [t for t in self.spieltage if t["id"] != letzter["id"]]
        await self.async_save()
        return self.spieltag_info(letzter)

    def spieltag_info(self, tag: dict[str, Any]) -> dict[str, Any]:
        ergebnisse = sorted(
            (
                {
                    "spieler": e["spieler"],
                    "name": self.spieler.get(e["spieler"], {}).get("name", e["spieler"]),
                    "einsatz": e["einsatz"],
                    "endstand": _r(e["einsatz"] + e["gewinn"]),
                    "gewinn": e["gewinn"],
                }
                for e in tag["ergebnisse"]
            ),
            key=lambda e: -e["gewinn"],
        )
        return {
            "id": tag["id"],
            "datum": tag["datum"],
            "beginn": tag.get("beginn"),
            "ende": tag.get("ende"),
            "dauer_h": dauer_stunden(tag),
            "bezeichnung": tag.get("bezeichnung") or "",
            "ort": tag.get("ort") or "",
            "topf": _r(sum(e["einsatz"] for e in tag["ergebnisse"])),
            "ergebnisse": ergebnisse,
        }

    # ------------------------------------------------------------ Statistik
    def statistik(self) -> dict[str, Any]:
        if self._statistik is not None:
            return self._statistik

        werte: dict[str, dict[str, Any]] = {
            pid: {
                "id": pid, "name": sp["name"], "aktiv": sp.get("aktiv", True),
                "einsatz": 0.0, "endstand": 0.0, "gewinn": 0.0, "spiele": 0,
                "plus": 0, "minus": 0, "stunden": 0.0, "_gewinn_mit_zeit": 0.0,
                "bester_spieltag": None, "schlechtester_spieltag": None,
            }
            for pid, sp in self.spieler.items()
        }
        stunden_gesamt = 0.0
        tage = self.sortiert()
        verlauf: list[dict[str, Any]] = []
        kumuliert: dict[str, float] = {}
        for tag in tage:
            dauer = dauer_stunden(tag)
            if dauer:
                stunden_gesamt += dauer
            for erg in tag["ergebnisse"]:
                w = werte.get(erg["spieler"])
                if w is None:
                    continue
                g = erg["gewinn"]
                w["einsatz"] += erg["einsatz"]
                w["endstand"] += erg["einsatz"] + g
                w["gewinn"] += g
                w["spiele"] += 1
                w["plus"] += g > 0
                w["minus"] += g < 0
                if dauer:
                    w["stunden"] += dauer
                    w["_gewinn_mit_zeit"] += g
                if w["bester_spieltag"] is None or g > w["bester_spieltag"]:
                    w["bester_spieltag"] = g
                if w["schlechtester_spieltag"] is None or g < w["schlechtester_spieltag"]:
                    w["schlechtester_spieltag"] = g
                kumuliert[erg["spieler"]] = _r(kumuliert.get(erg["spieler"], 0.0) + g)
            verlauf.append(
                {"datum": tag["datum"], "bezeichnung": tag.get("bezeichnung") or "",
                 "werte": dict(kumuliert)}
            )

        for w in werte.values():
            sp, entschieden = w["spiele"], w["plus"] + w["minus"]
            w["gewinn_avg"] = _r(w["gewinn"] / sp) if sp else 0.0
            w["roi"] = round(w["endstand"] / w["einsatz"] * 100, 1) if w["einsatz"] else 0.0
            w["quote"] = round(w["plus"] / entschieden * 100, 1) if entschieden else 0.0
            w["gewinn_pro_stunde"] = (
                _r(w["_gewinn_mit_zeit"] / w["stunden"]) if w["stunden"] else None
            )
            del w["_gewinn_mit_zeit"]
            for key in ("einsatz", "endstand", "gewinn", "stunden"):
                w[key] = _r(w[key])

        rangliste = sorted(
            (w for w in werte.values() if w["spiele"]), key=lambda w: -w["gewinn"]
        )
        for platz, w in enumerate(rangliste, 1):
            w["platz"] = platz

        self._statistik = {
            "spieler": werte,
            "rangliste": rangliste,
            "anzahl_spieltage": len(tage),
            "teilnahmen": sum(w["spiele"] for w in werte.values()),
            "einsatz_gesamt": _r(sum(w["einsatz"] for w in werte.values())),
            "stunden_gesamt": _r(stunden_gesamt),
            "letzter_spieltag": self.spieltag_info(tage[-1]) if tage else None,
            "verlauf": verlauf,
            "orte": self._orte(tage),
            "spieler_liste": [
                {"id": pid, "name": sp["name"], "aktiv": sp.get("aktiv", True)}
                for pid, sp in sorted(self.spieler.items(), key=lambda x: x[1]["name"])
            ],
        }
        return self._statistik

    @staticmethod
    def _orte(tage: list[dict[str, Any]]) -> list[str]:
        """Bisher verwendete Orte, häufigste zuerst."""
        zaehler: dict[str, int] = {}
        for tag in tage:
            if ort := (tag.get("ort") or "").strip():
                zaehler[ort] = zaehler.get(ort, 0) + 1
        return sorted(zaehler, key=lambda o: (-zaehler[o], o.casefold()))

    # ------------------------------------------------------------ Import
    @staticmethod
    def lese_csv(pfad: str) -> list[dict[str, Any]]:
        """CSV lesen (datum;bezeichnung;spieler;einsatz;endstand;gewinn).

        Optional: beginn, ende, name. Aufeinanderfolgende Zeilen mit gleichem
        Datum und gleicher Bezeichnung bilden einen Spieltag.
        """

        def zahl(text: str | None) -> float:
            text = (text or "").strip().replace(",", ".")
            return float(text) if text else 0.0

        tage: list[dict[str, Any]] = []
        with open(pfad, encoding="utf-8-sig") as datei:
            reader = csv.DictReader(datei, delimiter=";")
            pflicht = {"datum", "spieler", "einsatz"}
            if not reader.fieldnames or not pflicht <= set(reader.fieldnames):
                raise ValueError("Spalten datum, spieler und einsatz fehlen")
            for nr, zeile in enumerate(reader, start=2):
                datum_text = (zeile.get("datum") or "").strip()
                try:
                    datum = date.fromisoformat(datum_text)
                except ValueError as err:
                    raise ValueError(f"Zeile {nr}: ungültiges Datum '{datum_text}'") from err
                spieler = (zeile.get("spieler") or "").strip()
                if not spieler:
                    raise ValueError(f"Zeile {nr}: Spieler fehlt")
                einsatz = zahl(zeile.get("einsatz"))
                if zeile.get("gewinn", "").strip():
                    gewinn = zahl(zeile["gewinn"])
                else:
                    gewinn = zahl(zeile.get("endstand")) - einsatz
                bez = (zeile.get("bezeichnung") or "").strip()
                schluessel = (datum.isoformat(), bez)
                if not tage or tage[-1]["_key"] != schluessel:
                    tage.append(
                        {
                            "_key": schluessel, "datum": datum.isoformat(),
                            "bezeichnung": bez,
                            "ort": (zeile.get("ort") or "").strip(),
                            "beginn": (zeile.get("beginn") or "").strip()[:5] or None,
                            "ende": (zeile.get("ende") or "").strip()[:5] or None,
                            "ergebnisse": [],
                        }
                    )
                name = (zeile.get("name") or "").strip() or spieler[:1].upper() + spieler[1:]
                tage[-1]["ergebnisse"].append((spieler, name, einsatz, gewinn))
        if not tage:
            raise ValueError("Keine Daten gefunden")
        return tage

    def uebernehme_import(self, tage: list[dict[str, Any]]) -> None:
        for tag in tage:
            ergebnisse = []
            for spieler, name, einsatz, gewinn in tag["ergebnisse"]:
                pid = self.spieler_id(spieler) or self.spieler_id(name)
                if pid is None:
                    pid = slugify(spieler)
                    self.spieler[pid] = {"name": name, "aktiv": True}
                ergebnisse.append(
                    {"spieler": pid, "einsatz": _r(einsatz), "gewinn": _r(gewinn)}
                )
            self.spieltage.append(
                {
                    "id": uuid.uuid4().hex, "datum": tag["datum"],
                    "beginn": tag["beginn"], "ende": tag["ende"],
                    "bezeichnung": tag["bezeichnung"], "ort": tag.get("ort", ""),
                    "ergebnisse": ergebnisse,
                }
            )
