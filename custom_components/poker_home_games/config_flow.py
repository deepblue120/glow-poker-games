"""Einrichtung und Eingabemasken für Poker Home Games."""

from __future__ import annotations

from datetime import date, time
import os
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.core import callback
from homeassistant.helpers.selector import (
    BooleanSelector,
    DateSelector,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectOptionDict,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
    TextSelector,
    TimeSelector,
)
from homeassistant.util import dt as dt_util

from .const import CONF_IMPORT_PFAD, CONF_SPIELER, DOMAIN
from .data import PokerData, fmt_eur

STANDARD_EINSATZ = 20


def _betrag(minimum: float) -> NumberSelector:
    return NumberSelector(
        NumberSelectorConfig(
            min=minimum, max=10000, step=0.05,
            mode=NumberSelectorMode.BOX, unit_of_measurement="€",
        )
    )


def _datum_de(iso: str) -> str:
    return date.fromisoformat(iso).strftime("%d.%m.%Y")


class PokerConfigFlow(ConfigFlow, domain=DOMAIN):
    """Erstmalige Einrichtung."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        platzhalter = {"fehler": ""}
        if user_input is not None:
            pfad = (user_input.get(CONF_IMPORT_PFAD) or "").strip()
            spieler = [
                s.strip()
                for s in (user_input.get(CONF_SPIELER) or "").split(",")
                if s.strip()
            ]
            if pfad:
                if not await self.hass.async_add_executor_job(os.path.isfile, pfad):
                    errors[CONF_IMPORT_PFAD] = "datei_fehlt"
                else:
                    try:
                        await self.hass.async_add_executor_job(PokerData.lese_csv, pfad)
                    except (OSError, ValueError) as err:
                        errors[CONF_IMPORT_PFAD] = "csv_fehler"
                        platzhalter["fehler"] = str(err)
            elif not spieler:
                errors["base"] = "keine_spieler"
            if not errors:
                return self.async_create_entry(
                    title="Poker Home Games",
                    data={CONF_IMPORT_PFAD: pfad, CONF_SPIELER: spieler},
                )

        schema = vol.Schema(
            {
                vol.Optional(CONF_IMPORT_PFAD): TextSelector(),
                vol.Optional(CONF_SPIELER): TextSelector(),
            }
        )
        schema = self.add_suggested_values_to_schema(
            schema, user_input or {CONF_IMPORT_PFAD: "/config/poker_log.csv"}
        )
        return self.async_show_form(
            step_id="user", data_schema=schema, errors=errors,
            description_placeholders=platzhalter,
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return PokerOptionsFlow()


class PokerOptionsFlow(OptionsFlow):
    """Menü unter „Konfigurieren“: Spieltag eintragen, Spieler verwalten …"""

    def __init__(self) -> None:
        self._kopf: dict[str, Any] = {}

    @property
    def _data(self) -> PokerData:
        return self.config_entry.runtime_data

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        return self.async_show_menu(
            step_id="init",
            menu_options=[
                "spieltag", "spieler_hinzufuegen", "spieler_verwalten",
                "letzten_loeschen",
            ],
        )

    # -------------------------------------------------- Spieltag, Schritt 1
    async def async_step_spieltag(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        aktive = self._data.aktive_spieler()
        errors: dict[str, str] = {}
        if user_input is not None:
            if not user_input.get("spieler"):
                errors["spieler"] = "keine_auswahl"
            else:
                self._kopf = user_input
                return await self.async_step_ergebnisse()

        jetzt = dt_util.now()
        schema = vol.Schema(
            {
                vol.Required("datum"): DateSelector(),
                vol.Optional("beginn"): TimeSelector(),
                vol.Optional("ende"): TimeSelector(),
                vol.Optional("bezeichnung"): TextSelector(),
                vol.Required("spieler"): SelectSelector(
                    SelectSelectorConfig(
                        options=[
                            SelectOptionDict(value=pid, label=name)
                            for pid, name in aktive.items()
                        ],
                        multiple=True,
                        mode=SelectSelectorMode.LIST,
                    )
                ),
            }
        )
        vorschlag = user_input or {
            "datum": jetzt.date().isoformat(),
            "beginn": "19:00:00",
            "ende": jetzt.strftime("%H:%M:00"),
            "spieler": list(aktive),
        }
        return self.async_show_form(
            step_id="spieltag",
            data_schema=self.add_suggested_values_to_schema(schema, vorschlag),
            errors=errors,
        )

    # -------------------------------------------------- Spieltag, Schritt 2
    async def async_step_ergebnisse(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        ids: list[str] = self._kopf["spieler"]
        namen = {pid: self._data.spieler[pid]["name"] for pid in ids}
        errors: dict[str, str] = {}
        platzhalter = {"datum": _datum_de(self._kopf["datum"]), "summe": "0,00"}

        if user_input is not None:
            ergebnisse: list[tuple[str, float, float]] = []
            for pid, name in namen.items():
                einsatz = float(user_input.get(f"{name} – Einsatz") or 0)
                gewinn = float(user_input.get(f"{name} – Gewinn") or 0)
                if einsatz <= 0:
                    errors[f"{name} – Einsatz"] = "einsatz_fehlt"
                elif gewinn < -einsatz:
                    errors[f"{name} – Gewinn"] = "verlust_zu_hoch"
                ergebnisse.append((pid, einsatz, gewinn))
            summe = round(sum(e[2] for e in ergebnisse), 2)
            if (
                not errors
                and abs(summe) > 0.009
                and not user_input.get("trotzdem_speichern")
            ):
                errors["base"] = "summe_nicht_null"
                platzhalter["summe"] = fmt_eur(summe)
            if not errors:
                k = self._kopf
                await self._data.async_spieltag_speichern(
                    date.fromisoformat(k["datum"]),
                    time.fromisoformat(k["beginn"]) if k.get("beginn") else None,
                    time.fromisoformat(k["ende"]) if k.get("ende") else None,
                    k.get("bezeichnung") or "",
                    ergebnisse,
                )
                return self.async_create_entry(data={})

        felder: dict[Any, Any] = {}
        for name in namen.values():
            felder[vol.Required(f"{name} – Einsatz")] = _betrag(0)
            felder[vol.Required(f"{name} – Gewinn")] = _betrag(-10000)
        felder[vol.Optional("trotzdem_speichern")] = BooleanSelector()
        vorschlag = user_input or {
            **{f"{n} – Einsatz": STANDARD_EINSATZ for n in namen.values()},
            **{f"{n} – Gewinn": 0 for n in namen.values()},
        }
        return self.async_show_form(
            step_id="ergebnisse",
            data_schema=self.add_suggested_values_to_schema(vol.Schema(felder), vorschlag),
            errors=errors,
            description_placeholders=platzhalter,
        )

    # -------------------------------------------------- Spieler
    async def async_step_spieler_hinzufuegen(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        errors: dict[str, str] = {}
        if user_input is not None:
            try:
                self._data.spieler_hinzufuegen(user_input.get("name") or "")
            except ValueError as err:
                errors["name"] = str(err)
            else:
                await self._data.async_save()
                # neu laden, damit der Sensor des neuen Spielers entsteht
                self.hass.config_entries.async_schedule_reload(
                    self.config_entry.entry_id
                )
                return self.async_create_entry(data={})
        return self.async_show_form(
            step_id="spieler_hinzufuegen",
            data_schema=vol.Schema({vol.Required("name"): TextSelector()}),
            errors=errors,
        )

    async def async_step_spieler_verwalten(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        alle = dict(sorted(self._data.spieler.items(), key=lambda x: x[1]["name"]))
        if user_input is not None:
            aktiv = set(user_input.get("aktiv", []))
            for pid, sp in self._data.spieler.items():
                sp["aktiv"] = pid in aktiv
            await self._data.async_save()
            return self.async_create_entry(data={})
        schema = vol.Schema(
            {
                vol.Optional("aktiv"): SelectSelector(
                    SelectSelectorConfig(
                        options=[
                            SelectOptionDict(value=pid, label=sp["name"])
                            for pid, sp in alle.items()
                        ],
                        multiple=True,
                        mode=SelectSelectorMode.LIST,
                    )
                )
            }
        )
        return self.async_show_form(
            step_id="spieler_verwalten",
            data_schema=self.add_suggested_values_to_schema(
                schema, {"aktiv": list(self._data.aktive_spieler())}
            ),
        )

    # -------------------------------------------------- Löschen
    async def async_step_letzten_loeschen(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        letzter = self._data.letzter_spieltag()
        if letzter is None:
            return self.async_abort(reason="keine_spieltage")
        errors: dict[str, str] = {}
        if user_input is not None:
            if user_input.get("bestaetigen"):
                await self._data.async_letzten_loeschen()
                return self.async_create_entry(data={})
            errors["bestaetigen"] = "nicht_bestaetigt"
        info = self._data.spieltag_info(letzter)
        zeilen = ", ".join(
            f"{e['name']} {fmt_eur(e['gewinn'])} €" for e in info["ergebnisse"]
        )
        titel = _datum_de(info["datum"]) + (
            f" ({info['bezeichnung']})" if info["bezeichnung"] else ""
        )
        return self.async_show_form(
            step_id="letzten_loeschen",
            data_schema=vol.Schema({vol.Optional("bestaetigen"): BooleanSelector()}),
            errors=errors,
            description_placeholders={"spieltag": titel, "ergebnisse": zeilen},
        )
