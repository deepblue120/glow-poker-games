# Glow Poker Games

Home-Assistant-Integration für die Ergebnisse von Poker-Home-Games – mit eigener Dashboard-Karte im Glow-Stil.

- Spieltage mit Datum, Beginn, Ende, Ort, Bezeichnung und Ergebnissen pro Spieler erfassen
- Jeden Spieltag nachträglich bearbeiten oder löschen
- Dritte Seite „Meine Spiele“: eigene Bilanz aus der Runde (automatisch) plus eigene Sessions im Casino, bei anderen Home Games oder online – mit Blinds, Ort, Zeit, Bilanz nach Spielart, Verlauf, Rekorden und Liste
- Ewige Tabelle mit Gewinn, Ø pro Spieltag, ROI, Gewinnquote und Gewinn pro Stunde
- Podium, letzter Spieltag, Verlaufsgraph und Rekorde in einer Panel-Karte
- Übersicht passt im Browser komplett auf einen Bildschirm (ideal für Screenshots)
- Podium umschaltbar: Gesamt, Ø pro Spiel (ab 5 Spielen) oder nach Spielort
- Spiele über Mitternacht: Endzeit vor Startzeit = Ende am Folgetag (wird im Dialog angezeigt, in Listen mit „+1“)
- Zweite Seite „Alle Spiele“ als Tagesübersicht wie in Excel: eine Zeile pro Spieltag, pro Spieler Einsatz, Gewinn und optional Endstand, Summenzeile; sortierbar nach Datum, höchstem Gewinn/Verlust, Gesamteinsatz oder per Klick auf jede Spielerspalte; Filter nach Jahr
- Prüfung, dass die Gewinne eines Abends zusammen 0 € ergeben
- Import bestehender Ergebnisse aus CSV, automatischer Excel-Export nach jeder Änderung

## Installation

### Über HACS (empfohlen)

1. HACS → ⋮ → **Benutzerdefinierte Repositories** → `https://github.com/deepblue120/glow-poker-games`, Typ **Integration**
2. „Glow Poker Games“ installieren und Home Assistant neu starten
3. Einstellungen → Geräte & Dienste → **Integration hinzufügen** → „Poker Home Games“

### Manuell

Den Ordner `custom_components/poker_home_games` nach `/config/custom_components/` kopieren und Home Assistant neu starten.

## Einrichtung

Beim Hinzufügen fragt die Integration nach

- **CSV-Datei für den Import** (optional): bisherige Ergebnisse, siehe [Beispiel](beispiel/poker_import_beispiel.csv)
- **Spieler** (optional, kommagetrennt), falls ohne Import gestartet wird

CSV-Format (Semikolon getrennt, Dezimalpunkt oder -komma):

```
datum;bezeichnung;spieler;einsatz;endstand;gewinn
2026-01-17;;anna;40;72.5;32.5
```

Optionale Spalten: `beginn`, `ende` (HH:MM), `ort`, `name` (Anzeigename). Fehlt `gewinn`, wird er aus `endstand − einsatz` berechnet. Aufeinanderfolgende Zeilen mit gleichem Datum und gleicher Bezeichnung bilden einen Spieltag.

## Dashboard-Karte

Die Karte wird von der Integration automatisch mitgeladen – ein Ressourcen-Eintrag ist nicht nötig. Neue Ansicht vom Typ **Panel** anlegen und als Karte eintragen:

```yaml
type: custom:mg-poker-dashboard
# optional:
# title: Pokerrunde
# standard_einsatz: 20
# entity: sensor.poker_home_games_rangliste   # wird sonst automatisch gefunden
# ich: Marco                # blendet die Seite „Meine Spiele“ für diesen Spieler ein
# ich_titel: Meine Spiele
```

Oben rechts wechselt der Umschalter zwischen **Übersicht** und **Alle Spiele**.

Über **Spieltag eintragen** öffnet sich direkt in der Karte ein Dialog für Datum, Uhrzeiten, Teilnehmer, Einsatz und Gewinn. Der ±-Knopf neben dem Gewinnfeld macht Verluste negativ (praktisch auf dem Handy). Jeder Spieltag lässt sich über ✎ in „Alle Spiele“ (oder „Bearbeiten“ beim letzten Spieltag) im selben Dialog ändern oder löschen. Für den Ort schlägt die Karte bisher verwendete Orte vor; „Alle Spiele“ lässt sich nach Ort filtern.

## Weitere Wege zum Eintragen

- **Einstellungen → Geräte & Dienste → Poker Home Games → Konfigurieren**: Spieltag eintragen, Spieler hinzufügen, aktive Spieler festlegen, letzten Spieltag löschen
- **Aktion** `poker_home_games.spieltag_eintragen`:

```yaml
action: poker_home_games.spieltag_eintragen
data:
  datum: "2026-11-21"
  beginn: "19:30"
  ende: "01:00"
  ort: Bei Marco
  ergebnisse:
    - {spieler: Anna, einsatz: 40, gewinn: 30}
    - {spieler: Ben, einsatz: 40, gewinn: -20}
    - {spieler: Chris, einsatz: 20, gewinn: -10}
```

- **Aktion** `poker_home_games.spieltag_bearbeiten` – wie `spieltag_eintragen`, zusätzlich mit `id`; ersetzt den Spieltag komplett
- **Aktion** `poker_home_games.spieltag_loeschen` – löscht den Spieltag mit der angegebenen `id`
- **Aktion** `poker_home_games.letzten_spieltag_loeschen`
- **Import aus Tracking-App:** In „Meine Spiele“ → „Aus App importieren“ den Export (Tabelle mit `id`, `starttime`, `endtime`, `location`, `type`, `cashout`, `totalprofit` …) einfügen. Bereits importierte IDs werden übersprungen; Einsatz = Cashout − Ergebnis (inkl. Rebuys). Als Aktion: `poker_home_games.sessions_importieren` mit `text`.
- **Aktionen** `poker_home_games.session_eintragen`, `session_bearbeiten`, `session_loeschen`, `sessions_abrufen` für eigene Sessions außerhalb der Runde (Felder: `datum`, `beginn`, `ende`, `art` = casino/home_game/online/sonstiges, `spielart` = cash/turnier, `blinds`, `ort`, `einsatz`, `gewinn`, `notiz`)
- **Aktion** `poker_home_games.spieltage_abrufen` liefert alle Spieltage mit Einzelergebnissen als Antwort (nutzt die Karte für „Alle Spiele“)

## Entitäten

| Entität | Zustand | Attribute |
|---|---|---|
| `sensor.poker_home_games_rangliste` | Anzahl Spieltage | `rangliste`, `letzter_spieltag`, `verlauf`, `spieler_liste`, `orte`, `teilnahmen`, `einsatz_gesamt`, `stunden_gesamt` |
| `sensor.poker_home_games_<spieler>` | Gesamtgewinn in € | `einsatz`, `endstand`, `spiele`, `plus`, `minus`, `gewinn_avg`, `roi`, `quote`, `stunden`, `gewinn_pro_stunde`, `bester_spieltag`, `schlechtester_spieltag`, `platz` |

Nach jedem Speichern wird das Event `poker_home_games_spieltag_gespeichert` ausgelöst (nach Änderungen `poker_home_games_spieltag_geaendert`) – z. B. um automatisch eine Nachricht an die Runde zu schicken.

## Daten

- Datenbestand: `/config/.storage/poker_home_games.<entry_id>` (Teil des normalen HA-Backups)
- Excel-Export: `/config/poker_spieltage.csv` und `/config/poker_eigene_sessions.csv` (Semikolon, Dezimalkomma), werden nach jeder Änderung neu geschrieben
