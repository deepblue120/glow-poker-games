"""Sensoren für Poker Home Games."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity, SensorStateClass
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import PokerConfigEntry
from .const import DOMAIN, SIGNAL_UPDATE
from .data import PokerData


async def async_setup_entry(
    hass: HomeAssistant,
    entry: PokerConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    data = entry.runtime_data
    entities: list[SensorEntity] = [PokerRanglisteSensor(entry, data)]
    entities += [PokerSpielerSensor(entry, data, pid) for pid in data.spieler]
    async_add_entities(entities)


class _PokerSensor(SensorEntity):
    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, entry: PokerConfigEntry, data: PokerData) -> None:
        self._data = data
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name="Poker Home Games",
            manufacturer="Poker Home Games",
            entry_type=DeviceEntryType.SERVICE,
        )

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            async_dispatcher_connect(self.hass, SIGNAL_UPDATE, self._aktualisiert)
        )
        self._werte_setzen()

    @callback
    def _aktualisiert(self) -> None:
        self._werte_setzen()
        self.async_write_ha_state()

    def _werte_setzen(self) -> None:
        raise NotImplementedError


class PokerRanglisteSensor(_PokerSensor):
    """Gesamtübersicht – Zustand = Anzahl Spieltage, Details als Attribute."""

    _attr_name = "Rangliste"
    _attr_icon = "mdi:trophy"
    _attr_native_unit_of_measurement = "Spieltage"
    _attr_state_class = SensorStateClass.MEASUREMENT
    _unrecorded_attributes = frozenset(
        {"rangliste", "letzter_spieltag", "verlauf", "spieler_liste", "orte",
         "aktualisiert", "anzahl_sessions", "nach_ort", "rekorde"}
    )

    def __init__(self, entry: PokerConfigEntry, data: PokerData) -> None:
        super().__init__(entry, data)
        self._attr_unique_id = f"{entry.entry_id}_rangliste"

    def _werte_setzen(self) -> None:
        st = self._data.statistik()
        self._attr_native_value = st["anzahl_spieltage"]
        self._attr_extra_state_attributes: dict[str, Any] = {
            "teilnahmen": st["teilnahmen"],
            "einsatz_gesamt": st["einsatz_gesamt"],
            "stunden_gesamt": st["stunden_gesamt"],
            "rangliste": st["rangliste"],
            "letzter_spieltag": st["letzter_spieltag"],
            "verlauf": st["verlauf"],
            "spieler_liste": st["spieler_liste"],
            "orte": st["orte"],
            "aktualisiert": st["aktualisiert"],
            "anzahl_sessions": st["anzahl_sessions"],
            "nach_ort": st["nach_ort"],
            "rekorde": st["rekorde"],
        }


class PokerSpielerSensor(_PokerSensor):
    """Gesamtgewinn eines Spielers, Kennzahlen als Attribute."""

    _attr_icon = "mdi:cards-playing"
    _attr_native_unit_of_measurement = "€"
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_suggested_display_precision = 2

    def __init__(self, entry: PokerConfigEntry, data: PokerData, pid: str) -> None:
        super().__init__(entry, data)
        self._pid = pid
        self._attr_unique_id = f"{entry.entry_id}_{pid}"
        self._attr_name = data.spieler[pid]["name"]

    def _werte_setzen(self) -> None:
        werte = self._data.statistik()["spieler"].get(self._pid)
        if werte is None:
            self._attr_available = False
            return
        self._attr_available = True
        self._attr_native_value = werte["gewinn"]
        self._attr_extra_state_attributes = {
            k: v for k, v in werte.items() if k not in ("id", "name", "gewinn")
        }
