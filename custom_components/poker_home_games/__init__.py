"""Poker Home Games – Ergebnisse von Pokerabenden in Home Assistant."""

from __future__ import annotations

import logging

import voluptuous as vol

from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry, ConfigEntryState
from homeassistant.const import Platform
from homeassistant.core import (
    HomeAssistant,
    ServiceCall,
    ServiceResponse,
    SupportsResponse,
)
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .const import (
    CONF_IMPORT_PFAD,
    CONF_SPIELER,
    DOMAIN,
    SERVICE_LETZTEN_LOESCHEN,
    SERVICE_SPIELTAG_EINTRAGEN,
)
from .data import PokerData, fmt_eur

KARTE_URL = "/poker_home_games/mg-poker-dashboard.js"
KARTE_DATEI = Path(__file__).parent / "www" / "mg-poker-dashboard.js"
KARTE_VERSION = "1.2.0"

_LOGGER = logging.getLogger(__name__)

PLATFORMS = [Platform.SENSOR]
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

type PokerConfigEntry = ConfigEntry[PokerData]

SPIELTAG_SCHEMA = vol.Schema(
    {
        vol.Required("datum"): cv.date,
        vol.Optional("beginn"): cv.time,
        vol.Optional("ende"): cv.time,
        vol.Optional("bezeichnung", default=""): cv.string,
        vol.Required("ergebnisse"): vol.All(
            cv.ensure_list,
            [
                vol.Schema(
                    {
                        vol.Required("spieler"): cv.string,
                        vol.Required("einsatz"): vol.All(
                            vol.Coerce(float), vol.Range(min=0.01)
                        ),
                        vol.Required("gewinn"): vol.Coerce(float),
                    }
                )
            ],
        ),
        vol.Optional("summe_ignorieren", default=False): cv.boolean,
    }
)


def _poker_data(hass: HomeAssistant) -> PokerData:
    for entry in hass.config_entries.async_entries(DOMAIN):
        if entry.state is ConfigEntryState.LOADED:
            return entry.runtime_data
    raise ServiceValidationError("Poker Home Games ist nicht eingerichtet")


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Karte bereitstellen und Aktionen registrieren."""
    # Dashboard-Karte mitliefern: kein manueller Ressourcen-Eintrag nötig
    if getattr(hass, "http", None) is not None:
        await hass.http.async_register_static_paths(
            [StaticPathConfig(KARTE_URL, str(KARTE_DATEI), True)]
        )
        add_extra_js_url(hass, f"{KARTE_URL}?v={KARTE_VERSION}")

    async def spieltag_eintragen(call: ServiceCall) -> ServiceResponse:
        data = _poker_data(hass)
        ergebnisse: list[tuple[str, float, float]] = []
        for erg in call.data["ergebnisse"]:
            pid = data.spieler_id(erg["spieler"])
            if pid is None:
                raise ServiceValidationError(f"Unbekannter Spieler: {erg['spieler']}")
            if any(pid == e[0] for e in ergebnisse):
                raise ServiceValidationError(f"Spieler doppelt: {erg['spieler']}")
            if erg["gewinn"] < -erg["einsatz"]:
                raise ServiceValidationError(
                    f"{erg['spieler']}: Verlust größer als Einsatz"
                )
            ergebnisse.append((pid, erg["einsatz"], erg["gewinn"]))
        summe = round(sum(e[2] for e in ergebnisse), 2)
        if abs(summe) > 0.009 and not call.data["summe_ignorieren"]:
            raise ServiceValidationError(
                f"Die Gewinne ergeben {fmt_eur(summe)} € statt 0 € "
                "(mit summe_ignorieren: true trotzdem speichern)"
            )
        info = await data.async_spieltag_speichern(
            call.data["datum"],
            call.data.get("beginn"),
            call.data.get("ende"),
            call.data["bezeichnung"],
            ergebnisse,
        )
        return info if call.return_response else None

    async def letzten_loeschen(call: ServiceCall) -> ServiceResponse:
        info = await _poker_data(hass).async_letzten_loeschen()
        if info is None:
            raise ServiceValidationError("Es sind keine Spieltage gespeichert")
        return info if call.return_response else None

    hass.services.async_register(
        DOMAIN,
        SERVICE_SPIELTAG_EINTRAGEN,
        spieltag_eintragen,
        schema=SPIELTAG_SCHEMA,
        supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_LETZTEN_LOESCHEN,
        letzten_loeschen,
        supports_response=SupportsResponse.OPTIONAL,
    )
    return True


async def async_setup_entry(hass: HomeAssistant, entry: PokerConfigEntry) -> bool:
    data = PokerData(hass, entry.entry_id)
    await data.async_load()

    # Beim allerersten Start: Historie importieren bzw. Spieler anlegen
    if not data.spieler and not data.spieltage:
        if pfad := entry.data.get(CONF_IMPORT_PFAD):
            try:
                tage = await hass.async_add_executor_job(PokerData.lese_csv, pfad)
            except (OSError, ValueError) as err:
                _LOGGER.error("Import aus %s fehlgeschlagen: %s", pfad, err)
            else:
                data.uebernehme_import(tage)
                _LOGGER.info("%s Spieltage aus %s importiert", len(tage), pfad)
        for name in entry.data.get(CONF_SPIELER, []):
            try:
                data.spieler_hinzufuegen(name)
            except ValueError:
                pass
        await data.async_save()

    entry.runtime_data = data
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: PokerConfigEntry) -> bool:
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
