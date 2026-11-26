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
    SERVICE_SESSION_BEARBEITEN,
    SERVICE_SESSION_EINTRAGEN,
    SERVICE_SESSION_LOESCHEN,
    SERVICE_SESSIONS_ABRUFEN,
    SERVICE_SESSIONS_IMPORTIEREN,
    SERVICE_ZEITEN_SETZEN,
    SESSION_ARTEN,
    SPIELARTEN,
    SERVICE_SPIELTAG_BEARBEITEN,
    SERVICE_SPIELTAG_EINTRAGEN,
    SERVICE_SPIELTAG_LOESCHEN,
    SERVICE_SPIELTAGE_ABRUFEN,
)
from .data import PokerData, fmt_eur

KARTE_URL = "/poker_home_games/mg-poker-dashboard.js"
KARTE_DATEI = Path(__file__).parent / "www" / "mg-poker-dashboard.js"
KARTE_VERSION = "1.10.0"

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
        vol.Optional("ort", default=""): cv.string,
        vol.Optional("blinds", default=""): cv.string,
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
BEARBEITEN_SCHEMA = SPIELTAG_SCHEMA.extend({vol.Required("id"): cv.string})
LOESCHEN_SCHEMA = vol.Schema({vol.Required("id"): cv.string})

SESSION_SCHEMA = vol.Schema(
    {
        vol.Required("datum"): cv.date,
        vol.Optional("beginn"): cv.time,
        vol.Optional("ende"): cv.time,
        vol.Optional("art", default="casino"): vol.In(SESSION_ARTEN),
        vol.Optional("spielart", default="cash"): vol.In(SPIELARTEN),
        vol.Optional("blinds", default=""): cv.string,
        vol.Optional("ort", default=""): cv.string,
        vol.Required("einsatz"): vol.All(vol.Coerce(float), vol.Range(min=0)),
        vol.Required("gewinn"): vol.Coerce(float),
        vol.Optional("notiz", default=""): cv.string,
    }
)
SESSION_BEARBEITEN_SCHEMA = SESSION_SCHEMA.extend({vol.Required("id"): cv.string})


def _pruefe_session(daten: dict) -> None:
    if daten["gewinn"] < -daten["einsatz"]:
        raise ServiceValidationError("Verlust größer als Einsatz")


def _pruefe_ergebnisse(
    data: PokerData, call_data: dict
) -> list[tuple[str, float, float]]:
    """Ergebnisse aus einem Aktionsaufruf prüfen und in IDs übersetzen."""
    ergebnisse: list[tuple[str, float, float]] = []
    for erg in call_data["ergebnisse"]:
        pid = data.spieler_id(erg["spieler"])
        if pid is None:
            raise ServiceValidationError(f"Unbekannter Spieler: {erg['spieler']}")
        if any(pid == e[0] for e in ergebnisse):
            raise ServiceValidationError(f"Spieler doppelt: {erg['spieler']}")
        if erg["gewinn"] < -erg["einsatz"]:
            raise ServiceValidationError(f"{erg['spieler']}: Verlust größer als Einsatz")
        ergebnisse.append((pid, erg["einsatz"], erg["gewinn"]))
    summe = round(sum(e[2] for e in ergebnisse), 2)
    if abs(summe) > 0.009 and not call_data["summe_ignorieren"]:
        raise ServiceValidationError(
            f"Die Gewinne ergeben {fmt_eur(summe)} € statt 0 € "
            "(mit summe_ignorieren: true trotzdem speichern)"
        )
    return ergebnisse


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
        ergebnisse = _pruefe_ergebnisse(data, call.data)
        info = await data.async_spieltag_speichern(
            call.data["datum"], call.data.get("beginn"), call.data.get("ende"),
            call.data["bezeichnung"], ergebnisse, call.data["ort"],
            call.data["blinds"],
        )
        return info if call.return_response else None

    async def spieltag_bearbeiten(call: ServiceCall) -> ServiceResponse:
        data = _poker_data(hass)
        ergebnisse = _pruefe_ergebnisse(data, call.data)
        try:
            info = await data.async_spieltag_aendern(
                call.data["id"], call.data["datum"], call.data.get("beginn"),
                call.data.get("ende"), call.data["bezeichnung"], ergebnisse,
                call.data["ort"], call.data["blinds"],
            )
        except KeyError as err:
            raise ServiceValidationError("Spieltag nicht gefunden") from err
        return info if call.return_response else None

    async def spieltag_loeschen(call: ServiceCall) -> ServiceResponse:
        try:
            info = await _poker_data(hass).async_spieltag_loeschen(call.data["id"])
        except KeyError as err:
            raise ServiceValidationError("Spieltag nicht gefunden") from err
        return info if call.return_response else None

    async def session_eintragen(call: ServiceCall) -> ServiceResponse:
        _pruefe_session(call.data)
        info = await _poker_data(hass).async_session_speichern(dict(call.data))
        return info if call.return_response else None

    async def session_bearbeiten(call: ServiceCall) -> ServiceResponse:
        _pruefe_session(call.data)
        try:
            info = await _poker_data(hass).async_session_aendern(
                call.data["id"], dict(call.data)
            )
        except KeyError as err:
            raise ServiceValidationError("Session nicht gefunden") from err
        return info if call.return_response else None

    async def session_loeschen(call: ServiceCall) -> ServiceResponse:
        try:
            info = await _poker_data(hass).async_session_loeschen(call.data["id"])
        except KeyError as err:
            raise ServiceValidationError("Session nicht gefunden") from err
        return info if call.return_response else None

    async def zeiten_setzen(call: ServiceCall) -> ServiceResponse:
        data = _poker_data(hass)
        try:
            n = await data.async_zeiten_setzen(
                [(z["id"], z.get("beginn"), z.get("ende")) for z in call.data["zeiten"]]
            )
        except KeyError as err:
            raise ServiceValidationError(f"Spieltag nicht gefunden: {err}") from err
        return {"geaendert": n} if call.return_response else None

    async def sessions_importieren(call: ServiceCall) -> ServiceResponse:
        try:
            res = await _poker_data(hass).async_sessions_importieren(call.data["text"])
        except ValueError as err:
            raise ServiceValidationError(str(err)) from err
        return res if call.return_response else None

    async def sessions_abrufen(call: ServiceCall) -> ServiceResponse:
        data = _poker_data(hass)
        return {"sessions": [data.session_info(x) for x in data.sessions_sortiert()]}

    for name, handler, schema, antwort in (
        (SERVICE_SESSION_EINTRAGEN, session_eintragen, SESSION_SCHEMA, SupportsResponse.OPTIONAL),
        (SERVICE_SESSION_BEARBEITEN, session_bearbeiten, SESSION_BEARBEITEN_SCHEMA, SupportsResponse.OPTIONAL),
        (SERVICE_SESSION_LOESCHEN, session_loeschen, LOESCHEN_SCHEMA, SupportsResponse.OPTIONAL),
        (SERVICE_SESSIONS_ABRUFEN, sessions_abrufen, None, SupportsResponse.ONLY),
        (SERVICE_ZEITEN_SETZEN, zeiten_setzen,
         vol.Schema({vol.Required("zeiten"): vol.All(cv.ensure_list, [vol.Schema({
             vol.Required("id"): cv.string,
             vol.Optional("beginn"): vol.Any(None, cv.time),
             vol.Optional("ende"): vol.Any(None, cv.time),
         })])}), SupportsResponse.OPTIONAL),
        (SERVICE_SESSIONS_IMPORTIEREN, sessions_importieren,
         vol.Schema({vol.Required("text"): cv.string}), SupportsResponse.OPTIONAL),
    ):
        hass.services.async_register(
            DOMAIN, name, handler, schema=schema, supports_response=antwort
        )

    async def letzten_loeschen(call: ServiceCall) -> ServiceResponse:
        info = await _poker_data(hass).async_letzten_loeschen()
        if info is None:
            raise ServiceValidationError("Es sind keine Spieltage gespeichert")
        return info if call.return_response else None

    async def spieltage_abrufen(call: ServiceCall) -> ServiceResponse:
        data = _poker_data(hass)
        return {"spieltage": [data.spieltag_info(t) for t in data.sortiert()]}

    hass.services.async_register(
        DOMAIN,
        SERVICE_SPIELTAGE_ABRUFEN,
        spieltage_abrufen,
        supports_response=SupportsResponse.ONLY,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_SPIELTAG_EINTRAGEN,
        spieltag_eintragen,
        schema=SPIELTAG_SCHEMA,
        supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_SPIELTAG_BEARBEITEN,
        spieltag_bearbeiten,
        schema=BEARBEITEN_SCHEMA,
        supports_response=SupportsResponse.OPTIONAL,
    )
    hass.services.async_register(
        DOMAIN,
        SERVICE_SPIELTAG_LOESCHEN,
        spieltag_loeschen,
        schema=LOESCHEN_SCHEMA,
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
