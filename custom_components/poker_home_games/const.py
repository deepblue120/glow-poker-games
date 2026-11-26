"""Konstanten für Poker Home Games."""

DOMAIN = "poker_home_games"
STORAGE_VERSION = 1

SIGNAL_UPDATE = f"{DOMAIN}_update"
EVENT_SPIELTAG_GESPEICHERT = f"{DOMAIN}_spieltag_gespeichert"
EVENT_SPIELTAG_GEAENDERT = f"{DOMAIN}_spieltag_geaendert"

CSV_EXPORT = "poker_spieltage.csv"

CONF_IMPORT_PFAD = "import_pfad"
CONF_SPIELER = "spieler"

SERVICE_SPIELTAG_EINTRAGEN = "spieltag_eintragen"
SERVICE_LETZTEN_LOESCHEN = "letzten_spieltag_loeschen"
SERVICE_SPIELTAGE_ABRUFEN = "spieltage_abrufen"
SERVICE_SPIELTAG_BEARBEITEN = "spieltag_bearbeiten"
SERVICE_SPIELTAG_LOESCHEN = "spieltag_loeschen"
