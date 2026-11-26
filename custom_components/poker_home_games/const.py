"""Konstanten für Poker Home Games."""

DOMAIN = "poker_home_games"
STORAGE_VERSION = 1

SIGNAL_UPDATE = f"{DOMAIN}_update"
EVENT_SPIELTAG_GESPEICHERT = f"{DOMAIN}_spieltag_gespeichert"
EVENT_SPIELTAG_GEAENDERT = f"{DOMAIN}_spieltag_geaendert"

CSV_EXPORT = "poker_spieltage.csv"
CSV_EXPORT_SESSIONS = "poker_eigene_sessions.csv"

SESSION_ARTEN = ["casino", "home_game", "online", "sonstiges"]
SPIELARTEN = ["cash", "turnier"]

CONF_IMPORT_PFAD = "import_pfad"
CONF_SPIELER = "spieler"

SERVICE_SPIELTAG_EINTRAGEN = "spieltag_eintragen"
SERVICE_LETZTEN_LOESCHEN = "letzten_spieltag_loeschen"
SERVICE_SPIELTAGE_ABRUFEN = "spieltage_abrufen"
SERVICE_SPIELTAG_BEARBEITEN = "spieltag_bearbeiten"
SERVICE_SPIELTAG_LOESCHEN = "spieltag_loeschen"
SERVICE_SESSION_EINTRAGEN = "session_eintragen"
SERVICE_SESSION_BEARBEITEN = "session_bearbeiten"
SERVICE_SESSION_LOESCHEN = "session_loeschen"
SERVICE_SESSIONS_ABRUFEN = "sessions_abrufen"
SERVICE_SESSIONS_IMPORTIEREN = "sessions_importieren"
SERVICE_ZEITEN_SETZEN = "zeiten_setzen"
