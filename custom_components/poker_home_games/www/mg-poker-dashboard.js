/*
 * mg-poker-dashboard.js  –  Poker Home Games im Glow-Stil
 * Ablage:    /config/www/glow-dashboard/mg-poker-dashboard.js
 * Ressource: /local/glow-dashboard/mg-poker-dashboard.js?v=1   (Typ: JavaScript)
 * Benötigt:  Integration "Poker Home Games" (custom_components/poker_home_games)
 *
 * YAML (Panel-Ansicht):
 *   type: custom:mg-poker-dashboard
 *   # optional:
 *   # entity: sensor.poker_home_games_rangliste   (wird sonst automatisch gefunden)
 *   # title: Pokerrunde
 *   # standard_einsatz: 20
 */
(() => {
  const VERSION = "1.1.0";
  const TAG = "mg-poker-dashboard";

  const DEFAULTS = {
    entity: null,
    title: "Pokerrunde",
    standard_einsatz: 20,
  };

  // Farben wie im Glow-Dashboard
  const C = {
    bg: "#0e1015",
    card: "rgba(22,25,32,0.92)",
    cardBorder: "rgba(255,255,255,0.06)",
    tile: "rgba(255,255,255,0.035)",
    tileBorder: "rgba(255,255,255,0.07)",
    text: "#f2f4f8",
    muted: "#8a90a0",
    gold: "#f5b83d",
    cyan: "#4fc3f7",
    green: "#2fd1a0",
    violet: "#9b8cff",
    red: "#ff6b6b",
  };
  const LINIEN = ["#f5b83d", "#4fc3f7", "#2fd1a0", "#9b8cff", "#ff8a65", "#f472b6", "#cbd5e1", "#a3e635", "#38bdf8", "#fb7185"];

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const zahl = (v, d = 2) => Number(v || 0).toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });
  const eur = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + zahl(Math.abs(v)) + " €";
  const eurKurz = (v) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.round(Math.abs(v)).toLocaleString("de-DE") + " €";
  const datumDe = (iso) => (iso ? iso.split("-").reverse().join(".") : "");
  const vz = (v) => (v > 0.004 ? C.green : v < -0.004 ? C.red : C.muted);
  const parse = (t) => {
    const s = String(t ?? "").trim().replace(/\s/g, "").replace(",", ".");
    if (s === "" || s === "-" || s === "+") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  };
  const heute = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return { datum: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, zeit: `${p(d.getHours())}:${p(d.getMinutes())}` };
  };

  const STYLE = `
    :host { display:block; }
    * { box-sizing:border-box; }
    .wrap {
      min-height:100%; padding:22px; color:${C.text};
      background:
        radial-gradient(1200px 600px at 0% 0%, #2a2410 0%, transparent 60%),
        radial-gradient(900px 500px at 100% 100%, #0f2a22 0%, transparent 60%),
        ${C.bg};
      font-family: var(--primary-font-family, inherit);
    }
    .inner { max-width:1380px; margin:0 auto; display:flex; flex-direction:column; gap:18px; }
    .card { background:${C.card}; border:1px solid ${C.cardBorder}; border-radius:26px; padding:20px 22px; min-width:0; }
    .h { font-size:13px; font-weight:600; letter-spacing:1.5px; text-transform:uppercase; color:${C.muted}; margin:0 0 14px; display:flex; justify-content:space-between; align-items:baseline; gap:10px; }
    .h small { text-transform:none; letter-spacing:0; font-weight:400; font-size:13px; color:${C.muted}; }
    .tile { background:${C.tile}; border:1px solid ${C.tileBorder}; border-radius:16px; padding:10px 14px; min-width:0; }
    .tl { font-size:11px; letter-spacing:1px; text-transform:uppercase; color:${C.muted}; }
    .tv { font-size:20px; font-weight:700; margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .ts { font-size:12px; color:${C.muted}; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    .kopf { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; flex-wrap:wrap; }
    .titel { font-size:30px; font-weight:700; letter-spacing:-0.5px; display:flex; align-items:center; gap:12px; }
    .titel .suits { color:${C.gold}; font-size:22px; letter-spacing:2px; }
    .stand { color:${C.muted}; font-size:13px; margin-top:4px; }
    .btn { font:inherit; cursor:pointer; border-radius:14px; padding:11px 18px; font-size:14px; font-weight:600; color:${C.text};
      background:${C.tile}; border:1px solid ${C.tileBorder}; display:inline-flex; align-items:center; gap:8px; }
    .btn:hover { border-color:rgba(255,255,255,0.18); }
    .btn:focus-visible, input:focus-visible, .chip:focus-visible, .pm:focus-visible, .link:focus-visible { outline:2px solid ${C.gold}; outline-offset:2px; }
    .btn.gold { background:linear-gradient(160deg, ${C.gold}38, ${C.gold}0a); border-color:${C.gold}aa; color:${C.gold}; }
    .btn[disabled] { opacity:.5; cursor:default; }
    .stats { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:12px; }

    .grid { display:grid; grid-template-columns:minmax(0,1.1fr) minmax(0,1fr); gap:18px; align-items:start; }
    .col { display:flex; flex-direction:column; gap:18px; min-width:0; }

    /* Podium – das eine auffällige Element */
    .podium { display:grid; grid-template-columns:1fr 1.25fr 1fr; gap:12px; align-items:end; }
    .platz { position:relative; overflow:hidden; border-radius:20px; padding:16px 12px 14px; text-align:center;
      background:${C.tile}; border:1px solid ${C.tileBorder}; }
    .platz .nr { position:absolute; right:10px; top:2px; font-size:54px; font-weight:800; line-height:1; opacity:.08; }
    .platz .av { width:46px; height:46px; border-radius:50%; margin:0 auto 8px; display:flex; align-items:center; justify-content:center;
      font-weight:700; font-size:17px; color:#15171c; }
    .platz .n { font-weight:600; font-size:15px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .platz .g { font-weight:700; font-size:16px; margin-top:2px; }
    .platz .s { font-size:11.5px; color:${C.muted}; margin-top:4px; }
    .platz.p1 { padding-top:26px; padding-bottom:22px; border-color:${C.gold}aa;
      background:linear-gradient(160deg, ${C.gold}30, ${C.gold}06 70%);
      box-shadow:0 0 0 1px ${C.gold}22, 0 0 36px ${C.gold}2e; }
    .platz.p1 .av { width:58px; height:58px; font-size:21px; box-shadow:0 0 22px ${C.gold}88; }
    .platz.p1 .n { font-size:17px; }
    .platz.p1 .g { font-size:19px; }
    .krone { color:${C.gold}; font-size:18px; line-height:1; margin-bottom:4px; }

    .row { padding:11px 0; border-top:1px solid ${C.tileBorder}; }
    .row:first-child { border-top:none; padding-top:2px; }
    .rz { display:flex; align-items:center; gap:12px; }
    .rnr { width:22px; color:${C.muted}; font-size:13px; font-variant-numeric:tabular-nums; }
    .rn { flex:1; font-weight:600; font-size:15px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .rn .inaktiv { color:${C.muted}; font-weight:400; font-size:12px; margin-left:6px; }
    .rg { font-weight:700; font-size:15px; font-variant-numeric:tabular-nums; }
    .bar { margin:7px 0 0 34px; height:6px; border-radius:3px; background:rgba(255,255,255,0.05); position:relative; }
    .bar i { position:absolute; top:0; height:6px; border-radius:3px; }
    .bar b { position:absolute; left:50%; top:-3px; width:1px; height:12px; background:rgba(255,255,255,0.25); }
    .rs { margin:6px 0 0 34px; font-size:12px; color:${C.muted}; display:flex; flex-wrap:wrap; gap:4px 14px; }

    .chips { display:flex; flex-wrap:wrap; gap:8px; }
    .erg { border-radius:12px; padding:7px 12px; font-size:13.5px; font-weight:600; display:inline-flex; gap:8px; align-items:baseline; }
    .erg span { font-weight:400; font-variant-numeric:tabular-nums; }
    .meta { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-top:14px; }
    .link { font:inherit; font-size:12px; color:${C.muted}; background:none; border:none; cursor:pointer; padding:0; text-decoration:underline; text-underline-offset:3px; }
    .link:hover { color:${C.red}; }
    .rekorde { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }

    svg text { font-family:inherit; }
    .leer { color:${C.muted}; font-size:14px; padding:6px 0; }

    /* Dialog */
    .overlay { position:fixed; inset:0; z-index:9; background:rgba(5,6,9,0.66); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);
      display:flex; align-items:flex-start; justify-content:center; padding:4vh 14px; overflow:auto; }
    .dlg { width:100%; max-width:620px; background:#161920; border:1px solid ${C.cardBorder}; border-radius:26px; padding:22px; color:${C.text};
      box-shadow:0 30px 80px rgba(0,0,0,0.5); font-family: var(--primary-font-family, inherit); }
    .dlg h2 { margin:0 0 4px; font-size:20px; }
    .dlg .sub { color:${C.muted}; font-size:13px; margin-bottom:18px; }
    .f4 { display:grid; grid-template-columns:1.3fr 1fr 1fr; gap:10px; }
    label.fl { display:flex; flex-direction:column; gap:6px; font-size:12px; color:${C.muted}; min-width:0; }
    input { font:inherit; font-size:15px; color:${C.text}; background:${C.tile}; border:1px solid ${C.tileBorder}; border-radius:12px;
      padding:10px 12px; width:100%; min-width:0; color-scheme:dark; }
    input:focus { border-color:${C.gold}88; outline:none; }
    input.fehler { border-color:${C.red}; }
    .sec { margin-top:18px; font-size:12px; color:${C.muted}; margin-bottom:8px; display:flex; justify-content:space-between; }
    .chip { font:inherit; cursor:pointer; border-radius:12px; padding:8px 13px; font-size:14px; font-weight:600; color:${C.muted};
      background:${C.tile}; border:1px solid ${C.tileBorder}; }
    .chip.an { color:${C.gold}; border-color:${C.gold}aa; background:linear-gradient(160deg, ${C.gold}30, ${C.gold}08); }
    .eing { display:grid; grid-template-columns:minmax(80px,1fr) 110px 150px; gap:8px 10px; align-items:center; }
    .eing .kh { font-size:11px; color:${C.muted}; text-transform:uppercase; letter-spacing:1px; }
    .eing .nm { font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .gw { display:flex; gap:6px; }
    .pm { font:inherit; cursor:pointer; width:42px; flex:none; border-radius:12px; border:1px solid ${C.tileBorder}; background:${C.tile}; color:${C.text}; font-size:17px; }
    .summe { margin-top:16px; border-radius:16px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
    .summe.ok { background:${C.green}14; border:1px solid ${C.green}66; }
    .summe.nok { background:${C.red}12; border:1px solid ${C.red}66; }
    .cb { display:flex; align-items:center; gap:8px; font-size:13px; color:${C.text}; cursor:pointer; }
    .cb input { width:18px; height:18px; padding:0; }
    .msg { margin-top:12px; color:${C.red}; font-size:13.5px; }
    .fuss { display:flex; justify-content:flex-end; gap:10px; margin-top:18px; }
    .toast { position:fixed; left:50%; bottom:28px; transform:translateX(-50%); z-index:10; background:#161920; border:1px solid ${C.green}88;
      color:${C.text}; border-radius:14px; padding:12px 18px; font-size:14px; box-shadow:0 10px 40px rgba(0,0,0,0.5); }

    /* Seitenumschalter */
    .tabs { display:inline-flex; background:${C.tile}; border:1px solid ${C.tileBorder}; border-radius:14px; padding:4px; gap:4px; }
    .tab { font:inherit; cursor:pointer; border:none; background:none; color:${C.muted}; font-size:14px; font-weight:600; padding:8px 14px; border-radius:10px; }
    .tab.an { color:${C.gold}; background:linear-gradient(160deg, ${C.gold}30, ${C.gold}08); box-shadow:inset 0 0 0 1px ${C.gold}88; }
    .kopf-r { display:flex; gap:12px; align-items:center; flex-wrap:wrap; }

    /* Alle Spiele */
    .filter { display:flex; flex-direction:column; gap:12px; }
    .frow { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .flab { font-size:11px; letter-spacing:1px; text-transform:uppercase; color:${C.muted}; width:78px; flex:none; }
    .fchips { display:flex; flex-wrap:wrap; gap:6px; flex:1; min-width:0; }
    .fc { font:inherit; cursor:pointer; border-radius:10px; padding:6px 11px; font-size:13px; font-weight:600; color:${C.muted};
      background:${C.tile}; border:1px solid ${C.tileBorder}; }
    .fc.an { color:${C.gold}; border-color:${C.gold}aa; background:linear-gradient(160deg, ${C.gold}2a, ${C.gold}06); }
    .fc .pf { margin-left:4px; }
    .tab:focus-visible, .fc:focus-visible { outline:2px solid ${C.gold}; outline-offset:2px; }
    .tbl { width:100%; border-collapse:collapse; font-variant-numeric:tabular-nums; color:${C.text}; font-size:14px; font-family:inherit; }
    .tbl th { text-align:left; font-size:11px; letter-spacing:1px; text-transform:uppercase; color:${C.muted}; font-weight:600; padding:0 10px 10px; white-space:nowrap; }
    .tbl th.num, .tbl td.num { text-align:right; }
    .tbl th button { font:inherit; color:inherit; letter-spacing:inherit; text-transform:inherit; background:none; border:none; cursor:pointer; padding:0; }
    .tbl th button.an { color:${C.gold}; }
    .tbl td { padding:10px; border-top:1px solid ${C.tileBorder}; font-size:14px; vertical-align:middle; }
    .tbl tr.neu td { border-top-color:rgba(255,255,255,0.16); }
    .tbl td .klein { display:block; font-size:12px; color:${C.muted}; margin-top:2px; }
    .tbl td.sp { font-weight:600; }
    .tbl tr.top td.sp::after { content:" ♛"; color:${C.gold}; font-size:12px; }
    .scroll { overflow-x:auto; margin:0 -10px; }
    .tbl .mob { display:none; }
    .mehr { margin-top:14px; text-align:center; }

    @media (max-width: 980px) { .grid { grid-template-columns:minmax(0,1fr); } }
    @media (max-width: 640px) {
      .wrap { padding:12px; }
      .card { padding:16px; border-radius:22px; }
      .stats { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .titel { font-size:24px; }
      .podium { gap:8px; }
      .platz { padding:12px 6px; }
      .platz .roi { display:none; }
      .f4 { grid-template-columns:1fr 1fr; }
      .f4 label:first-child { grid-column:1 / -1; }
      .eing { grid-template-columns:minmax(60px,1fr) 84px 128px; }
      .meta { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .flab { width:100%; }
      .tbl .hm { display:none; }
      .tbl .mob { display:block; }
      .tbl td, .tbl th { padding-left:6px; padding-right:6px; }
    }
    @media (prefers-reduced-motion: no-preference) {
      .platz.p1 { animation: glow 3.2s ease-in-out infinite alternate; }
      @keyframes glow { from { box-shadow:0 0 0 1px ${C.gold}22, 0 0 24px ${C.gold}22; } to { box-shadow:0 0 0 1px ${C.gold}33, 0 0 44px ${C.gold}3a; } }
    }
  `;

  class MgPokerDashboard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._config = { ...DEFAULTS };
      this._sig = null;
      this._form = null;
      this._seite = "uebersicht";
      this._spieltage = null;
      this._spieltageSig = null;
      this._ladeFehler = "";
      this._listeSort = { key: "datum", ab: true };
      this._listeSpieler = "alle";
      this._listeJahr = "alle";
      this._listeLimit = 150;
      this._entityId = null;
    }

    static getStubConfig() { return {}; }
    getCardSize() { return 14; }
    getGridOptions() { return { columns: "full" }; }

    setConfig(config) {
      this._config = { ...DEFAULTS, ...(config || {}) };
      this._sig = null;
      if (this._hass) this._renderMain();
    }

    _findeEntity(hass) {
      if (this._config.entity) return this._config.entity;
      if (this._entityId && hass.states[this._entityId]) return this._entityId;
      const id = Object.keys(hass.states).find((e) => {
        if (!e.startsWith("sensor.")) return false;
        const a = hass.states[e].attributes;
        return a && Array.isArray(a.rangliste) && Array.isArray(a.spieler_liste);
      });
      this._entityId = id || null;
      return id || "sensor.poker_home_games_rangliste";
    }

    set hass(hass) {
      this._hass = hass;
      this._ent = this._findeEntity(hass);
      const s = hass.states[this._ent];
      const sig = s ? s.last_updated + "|" + s.state : "fehlt";
      if (sig !== this._sig) {
        this._sig = sig;
        this._renderMain();
      }
    }

    // ------------------------------------------------------------ Daten
    _daten() {
      const s = this._hass && this._hass.states[this._ent];
      if (!s) return null;
      const a = s.attributes || {};
      return {
        spieltage: parseInt(s.state, 10) || 0,
        teilnahmen: a.teilnahmen || 0,
        einsatz: a.einsatz_gesamt || 0,
        stunden: a.stunden_gesamt || 0,
        rangliste: a.rangliste || [],
        letzter: a.letzter_spieltag || null,
        verlauf: a.verlauf || [],
        spieler: a.spieler_liste || [],
      };
    }

    _geruest() {
      if (this._root) return;
      this.shadowRoot.innerHTML = `<style>${STYLE}</style><div class="wrap"><div class="inner" id="main"></div></div><div id="modal"></div><div id="toast"></div>`;
      this._root = this.shadowRoot.getElementById("main");
      this._modal = this.shadowRoot.getElementById("modal");
      this._toastEl = this.shadowRoot.getElementById("toast");
    }

    // ------------------------------------------------------------ Hauptansicht
    _renderMain() {
      this._geruest();
      const d = this._daten();
      if (!d) {
        this._root.innerHTML = `<div class="card"><div class="h">Poker</div>
          <div class="leer">Sensor <b>${esc(this._ent)}</b> nicht gefunden. Ist die Integration „Poker Home Games“ eingerichtet?</div></div>`;
        return;
      }
      const stand = d.letzter ? `Stand nach dem Spieltag vom ${datumDe(d.letzter.datum)}` : "Noch kein Spieltag gespeichert";
      this._root.innerHTML = `
        <div class="kopf">
          <div>
            <div class="titel">${esc(this._config.title)} <span class="suits">♠ ♥ ♦ ♣</span></div>
            <div class="stand">${stand}</div>
          </div>
          <div class="kopf-r">
            <div class="tabs" role="tablist">
              <button class="tab ${this._seite === "uebersicht" ? "an" : ""}" role="tab" aria-selected="${this._seite === "uebersicht"}" data-seite="uebersicht">Übersicht</button>
              <button class="tab ${this._seite === "spiele" ? "an" : ""}" role="tab" aria-selected="${this._seite === "spiele"}" data-seite="spiele">Alle Spiele</button>
            </div>
            <button class="btn gold" id="neu">＋ Spieltag eintragen</button>
          </div>
        </div>
        ${this._seite === "spiele" ? this._seiteSpiele(d) : this._seiteUebersicht(d)}`;
      this._root.querySelector("#neu").addEventListener("click", () => this._oeffneForm());
      this._root.querySelectorAll("[data-seite]").forEach((b) => b.addEventListener("click", () => {
        if (this._seite === b.dataset.seite) return;
        this._seite = b.dataset.seite;
        this._renderMain();
      }));
      if (this._seite === "spiele") this._bindeSpiele();
      const del = this._root.querySelector("#loeschen");
      if (del) del.addEventListener("click", () => this._loescheLetzten());
    }

    _seiteUebersicht(d) {
      return `
        <div class="stats">
          ${this._tile("Spieltage", d.spieltage, d.verlauf.length ? `seit ${datumDe(d.verlauf[0].datum).slice(3)}` : "")}
          ${this._tile("Teilnahmen", d.teilnahmen, d.spieltage ? `Ø ${zahl(d.teilnahmen / d.spieltage, 1)} Spieler pro Abend` : "")}
          ${this._tile("Eingesetzt", Math.round(d.einsatz).toLocaleString("de-DE") + " €", d.spieltage ? `Ø ${Math.round(d.einsatz / d.spieltage)} € im Topf` : "")}
          ${this._tile("Gespielt", d.stunden ? zahl(d.stunden, 1) + " h" : "–", d.stunden ? "mit erfassten Uhrzeiten" : "Uhrzeiten beim Eintragen angeben")}
        </div>
        <div class="grid">
          <div class="col">
            <div class="card">${this._podium(d)}</div>
            <div class="card"><div class="h">Ewige Tabelle <small>${d.rangliste.length} Spieler</small></div>${this._tabelle(d)}</div>
          </div>
          <div class="col">
            <div class="card">${this._letzter(d)}</div>
            <div class="card"><div class="h">Verlauf <small>Kontostand über alle Spieltage</small></div>${this._chart(d)}</div>
            <div class="card"><div class="h">Rekorde</div>${this._rekorde(d)}</div>
          </div>
        </div>`;
    }

    // ------------------------------------------------------------ Alle Spiele
    _seiteSpiele(d) {
      // bei Änderungen am Sensor neu laden
      if (this._spieltageSig !== this._sig && !this._laedt) this._ladeSpieltage();
      if (!this._spieltage) {
        return `<div class="card"><div class="leer">${this._ladeFehler ? esc(this._ladeFehler) : "Lade alle Spiele …"}</div></div>`;
      }
      const tage = this._spieltage;
      // Einzelergebnisse aufbauen
      let zeilen = [];
      tage.forEach((t) => {
        const maxG = Math.max(...t.ergebnisse.map((e) => e.gewinn));
        t.ergebnisse.forEach((e) => zeilen.push({
          tag: t.id, datum: t.datum, beginn: t.beginn, ende: t.ende, bez: t.bezeichnung,
          topf: t.topf, anzahl: t.ergebnisse.length, spieler: e.spieler, name: e.name,
          einsatz: e.einsatz, gewinn: e.gewinn, sieger: e.gewinn === maxG && maxG > 0,
        }));
      });
      const jahre = [...new Set(tage.map((t) => t.datum.slice(0, 4)))].sort().reverse();
      const namen = new Map();
      zeilen.forEach((z) => namen.set(z.spieler, z.name));
      if (this._listeSpieler !== "alle") zeilen = zeilen.filter((z) => z.spieler === this._listeSpieler);
      if (this._listeJahr !== "alle") zeilen = zeilen.filter((z) => z.datum.startsWith(this._listeJahr));

      const { key, ab } = this._listeSort;
      const wert = {
        datum: (z) => z.datum + (z.beginn || ""),
        gewinn: (z) => z.gewinn,
        verlust: (z) => -z.gewinn,
        einsatz: (z) => z.einsatz,
        topf: (z) => z.topf,
      }[key];
      zeilen.sort((a, b) => {
        const va = wert(a), vb = wert(b);
        const c = va < vb ? -1 : va > vb ? 1 : 0;
        if (c) return ab ? -c : c;
        return a.datum < b.datum ? 1 : a.datum > b.datum ? -1 : b.gewinn - a.gewinn;
      });

      // Kennzahlen zur Auswahl
      const n = zeilen.length;
      const sumG = zeilen.reduce((a, z) => a + z.gewinn, 0);
      const sumE = zeilen.reduce((a, z) => a + z.einsatz, 0);
      const spieltage = new Set(zeilen.map((z) => z.tag)).size;
      const plus = zeilen.filter((z) => z.gewinn > 0).length;
      const einzeln = this._listeSpieler !== "alle";

      const sortBtn = (k, label) => {
        const an = key === k;
        const pfeil = an ? (ab ? " ↓" : " ↑") : "";
        return `<button class="fc ${an ? "an" : ""}" data-sort="${k}" aria-pressed="${an}">${label}<span class="pf">${pfeil}</span></button>`;
      };
      const th = (k, label, cls = "") => `<th class="${cls}"><button class="${key === k ? "an" : ""}" data-sort="${k}">${label}${key === k ? (ab ? " ↓" : " ↑") : ""}</button></th>`;

      const sichtbar = zeilen.slice(0, this._listeLimit);
      let letzterTag = null;
      const rows = sichtbar.map((z) => {
        const neu = key === "datum" && z.tag !== letzterTag && letzterTag !== null;
        letzterTag = z.tag;
        const zeit = z.beginn && z.ende ? `${z.beginn}–${z.ende}` : "";
        const info = [z.bez, zeit].filter(Boolean).join(" · ");
        return `<tr class="${neu ? "neu" : ""} ${z.sieger ? "top" : ""}">
          <td>${datumDe(z.datum)}${info ? `<span class="klein">${esc(info)}</span>` : ""}<span class="klein mob">Topf ${zahl(z.topf, 0)} €</span></td>
          <td class="sp">${esc(z.name)}</td>
          <td class="num">${zahl(z.einsatz, 2)} €</td>
          <td class="num" style="color:${vz(z.gewinn)};font-weight:700">${eur(z.gewinn)}</td>
          <td class="num hm">${zahl(z.topf, 0)} €<span class="klein">${z.anzahl} Spieler</span></td>
        </tr>`;
      }).join("");

      return `
        <div class="card filter">
          <div class="frow"><div class="flab">Sortieren</div><div class="fchips">
            ${sortBtn("datum", "Datum")}${sortBtn("gewinn", "Gewinn")}${sortBtn("verlust", "Verlust")}${sortBtn("einsatz", "Einsatz")}${sortBtn("topf", "Gesamteinsatz")}
          </div></div>
          <div class="frow"><div class="flab">Spieler</div><div class="fchips">
            <button class="fc ${this._listeSpieler === "alle" ? "an" : ""}" data-spieler="alle">Alle</button>
            ${[...namen].sort((a, b) => a[1].localeCompare(b[1], "de")).map(([id, nm]) => `<button class="fc ${this._listeSpieler === id ? "an" : ""}" data-spieler="${esc(id)}">${esc(nm)}</button>`).join("")}
          </div></div>
          <div class="frow"><div class="flab">Jahr</div><div class="fchips">
            <button class="fc ${this._listeJahr === "alle" ? "an" : ""}" data-jahr="alle">Alle</button>
            ${jahre.map((j) => `<button class="fc ${this._listeJahr === j ? "an" : ""}" data-jahr="${j}">${j}</button>`).join("")}
          </div></div>
        </div>
        <div class="stats">
          ${this._tile(einzeln ? "Spiele" : "Ergebnisse", n, `${spieltage} Spieltage`)}
          ${this._tile("Gewinn / Verlust", `<span style="color:${vz(sumG)}">${eurKurz(sumG)}</span>`, einzeln ? `Ø ${eur(n ? sumG / n : 0)} pro Spiel` : "sollte über alle Spieler ≈ 0 sein")}
          ${this._tile("Einsatz", Math.round(sumE).toLocaleString("de-DE") + " €", `Ø ${zahl(n ? sumE / n : 0, 2)} € pro ${einzeln ? "Spiel" : "Ergebnis"}`)}
          ${this._tile("Im Plus", n ? Math.round((plus / n) * 100) + " %" : "–", `${plus} von ${n}`)}
        </div>
        <div class="card">
          <div class="h">Alle Spiele <small>${n} ${n === 1 ? "Ergebnis" : "Ergebnisse"}</small></div>
          ${n ? `<div class="scroll"><table class="tbl">
            <thead><tr>${th("datum", "Datum")}<th>Spieler</th>${th("einsatz", "Einsatz", "num")}${th(key === "verlust" ? "verlust" : "gewinn", key === "verlust" ? "Verlust" : "Gewinn", "num")}${th("topf", "Gesamteinsatz", "num hm")}</tr></thead>
            <tbody>${rows}</tbody></table></div>
            ${n > this._listeLimit ? `<div class="mehr"><button class="btn" id="mehr">Weitere ${Math.min(150, n - this._listeLimit)} anzeigen</button></div>` : ""}`
          : `<div class="leer">Keine Spiele für diese Auswahl.</div>`}
        </div>`;
    }

    _bindeSpiele() {
      const r = this._root;
      const DEFAULT_AB = { datum: true, gewinn: true, verlust: true, einsatz: true, topf: true };
      r.querySelectorAll("[data-sort]").forEach((b) => b.addEventListener("click", () => {
        const k = b.dataset.sort;
        if (this._listeSort.key === k) this._listeSort.ab = !this._listeSort.ab;
        else this._listeSort = { key: k, ab: DEFAULT_AB[k] };
        this._listeLimit = 150;
        this._renderMain();
      }));
      r.querySelectorAll("[data-spieler]").forEach((b) => b.addEventListener("click", () => {
        this._listeSpieler = b.dataset.spieler; this._listeLimit = 150; this._renderMain();
      }));
      r.querySelectorAll("[data-jahr]").forEach((b) => b.addEventListener("click", () => {
        this._listeJahr = b.dataset.jahr; this._listeLimit = 150; this._renderMain();
      }));
      const mehr = r.querySelector("#mehr");
      if (mehr) mehr.addEventListener("click", () => { this._listeLimit += 150; this._renderMain(); });
    }

    async _ladeSpieltage() {
      this._laedt = true;
      const sig = this._sig;
      try {
        const res = await this._hass.callWS({
          type: "call_service", domain: "poker_home_games", service: "spieltage_abrufen",
          service_data: {}, return_response: true,
        });
        this._spieltage = (res && res.response && res.response.spieltage) || [];
        this._ladeFehler = "";
      } catch (err) {
        this._ladeFehler = "Spiele konnten nicht geladen werden: " + ((err && err.message) || err);
      }
      this._spieltageSig = sig;
      this._laedt = false;
      if (this._seite === "spiele") this._renderMain();
    }

    _tile(l, v, s) {
      return `<div class="tile"><div class="tl">${l}</div><div class="tv">${v}</div><div class="ts">${s || "&nbsp;"}</div></div>`;
    }

    _podium(d) {
      if (!d.rangliste.length) return `<div class="h">Podium</div><div class="leer">Noch keine Ergebnisse.</div>`;
      const farbe = [C.gold, "#cfd6e0", "#d08a55"];
      const platz = (i) => {
        const x = d.rangliste[i];
        if (!x) return "<div></div>";
        return `<div class="platz p${i + 1}">
          <div class="nr" style="color:${farbe[i]}">${i + 1}</div>
          ${i === 0 ? '<div class="krone">♛</div>' : ""}
          <div class="av" style="background:${farbe[i]}">${esc(x.name.slice(0, 1).toUpperCase())}</div>
          <div class="n">${esc(x.name)}</div>
          <div class="g" style="color:${vz(x.gewinn)}">${eur(x.gewinn)}</div>
          <div class="s">${x.spiele} Spiele<span class="roi"> · ROI ${zahl(x.roi, 1)} %</span></div>
        </div>`;
      };
      return `<div class="h">Podium</div><div class="podium">${platz(1)}${platz(0)}${platz(2)}</div>`;
    }

    _tabelle(d) {
      if (!d.rangliste.length) return `<div class="leer">Trag den ersten Spieltag ein, dann erscheint hier die Tabelle.</div>`;
      const mx = Math.max(1, ...d.rangliste.map((x) => Math.abs(x.gewinn)));
      return d.rangliste.map((x) => {
        const w = Math.max(1.5, (Math.abs(x.gewinn) / mx) * 50);
        const pos = x.gewinn >= 0;
        const proStd = x.gewinn_pro_stunde != null ? `<span>${eur(x.gewinn_pro_stunde)}/h</span>` : "";
        return `<div class="row">
          <div class="rz">
            <div class="rnr">${x.platz}</div>
            <div class="rn">${esc(x.name)}${x.aktiv === false ? '<span class="inaktiv">inaktiv</span>' : ""}</div>
            <div class="rg" style="color:${vz(x.gewinn)}">${eur(x.gewinn)}</div>
          </div>
          <div class="bar"><b></b><i style="left:${pos ? 50 : 50 - w}%;width:${w}%;background:${pos ? C.green : C.red};box-shadow:0 0 10px ${pos ? C.green : C.red}66"></i></div>
          <div class="rs"><span>${x.spiele} Spiele</span><span>Ø ${eur(x.gewinn_avg)}</span>${proStd}<span>ROI ${zahl(x.roi, 1)} %</span><span>${Math.round(x.quote)} % gewonnen</span></div>
        </div>`;
      }).join("");
    }

    _letzter(d) {
      const l = d.letzter;
      if (!l) return `<div class="h">Letzter Spieltag</div><div class="leer">Noch kein Spieltag gespeichert.</div>`;
      const zeit = l.beginn && l.ende ? `${l.beginn}–${l.ende} Uhr` : "";
      const kopf = [datumDe(l.datum), zeit, l.bezeichnung].filter(Boolean).join(" · ");
      const chips = l.ergebnisse.map((e) => {
        const c = vz(e.gewinn);
        return `<div class="erg" style="background:${c}18;border:1px solid ${c}55;color:${c}">${esc(e.name)} <span>${eur(e.gewinn)}</span></div>`;
      }).join("");
      const sieger = l.ergebnisse[0];
      return `<div class="h">Letzter Spieltag <small>${esc(kopf)}</small></div>
        <div class="chips">${chips}</div>
        <div class="meta">
          ${this._tile("Im Topf", zahl(l.topf, 0) + " €", `${l.ergebnisse.length} Spieler`)}
          ${this._tile("Dauer", l.dauer_h ? zahl(l.dauer_h, 1) + " h" : "–", zeit || "keine Uhrzeit")}
          ${this._tile("Abendsieger", sieger ? esc(sieger.name) : "–", sieger ? eur(sieger.gewinn) : "")}
        </div>
        <div style="margin-top:12px;text-align:right"><button class="link" id="loeschen">Letzten Spieltag löschen</button></div>`;
    }

    _chart(d) {
      const v = d.verlauf;
      if (v.length < 2) return `<div class="leer">Der Verlauf erscheint ab dem zweiten Spieltag.</div>`;
      const W = 640, H = 260, L = 46, R = 92, T = 14, B = 26;
      const spieler = d.rangliste.map((x) => x.id);
      const namen = Object.fromEntries(d.rangliste.map((x) => [x.id, x.name]));
      let min = 0, max = 0;
      v.forEach((p) => spieler.forEach((id) => { const w = p.werte[id]; if (w != null) { min = Math.min(min, w); max = Math.max(max, w); } }));
      const pad = (max - min) * 0.06 || 10; min -= pad; max += pad;
      const x = (i) => L + (i / (v.length - 1)) * (W - L - R);
      const y = (w) => T + (1 - (w - min) / (max - min)) * (H - T - B);
      // Raster
      const schritt = [50, 100, 200, 250, 500, 1000, 2000].find((s) => (max - min) / s <= 6) || 5000;
      let grid = "";
      for (let g = Math.ceil(min / schritt) * schritt; g <= max; g += schritt) {
        grid += `<line x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}" stroke="rgba(255,255,255,${g === 0 ? 0.28 : 0.06})" ${g === 0 ? 'stroke-dasharray="4 4"' : ""}/>
          <text x="${L - 8}" y="${y(g) + 4}" text-anchor="end" font-size="11" fill="${C.muted}">${g.toLocaleString("de-DE")}</text>`;
      }
      // Jahreswechsel
      let jahre = "", letztesJahr = "", letztesX = -99;
      v.forEach((p, i) => {
        const j = p.datum.slice(0, 4);
        if (j !== letztesJahr && x(i) - letztesX >= 34) {
          letztesJahr = j; letztesX = x(i);
          jahre += `<line x1="${x(i)}" x2="${x(i)}" y1="${T}" y2="${H - B}" stroke="rgba(255,255,255,0.05)"/>
            <text x="${x(i) + 3}" y="${H - 8}" font-size="11" fill="${C.muted}">${j}</text>`;
        }
      });
      // Linien
      const farbe = (i) => LINIEN[i % LINIEN.length];
      let linien = "";
      const enden = [];
      spieler.forEach((id, si) => {
        let pfad = "", gestartet = false, letzter = null;
        v.forEach((p, i) => {
          const w = p.werte[id];
          if (w == null) return;
          pfad += `${gestartet ? "L" : "M"}${x(i).toFixed(1)},${y(w).toFixed(1)}`;
          gestartet = true; letzter = { i, w };
        });
        if (!pfad) return;
        const breit = si === 0 ? 2.6 : 1.8;
        linien += `<path d="${pfad}" fill="none" stroke="${farbe(si)}" stroke-width="${breit}" stroke-linejoin="round" stroke-linecap="round" ${si === 0 ? `style="filter:drop-shadow(0 0 5px ${farbe(si)}aa)"` : 'opacity="0.85"'}/>`;
        enden.push({ id, si, w: letzter.w, py: y(letzter.w), px: x(letzter.i) });
      });
      // Beschriftung am Ende ohne Überlappung
      enden.sort((a, b) => a.py - b.py);
      for (let i = 1; i < enden.length; i++) if (enden[i].py - enden[i - 1].py < 13) enden[i].py = enden[i - 1].py + 13;
      const ueber = enden.length ? enden[enden.length - 1].py - (H - B) : 0;
      if (ueber > 0) enden.forEach((e) => (e.py -= ueber));
      const labels = enden.map((e) => `<circle cx="${e.px}" cy="${y(e.w)}" r="3" fill="${farbe(e.si)}"/>
        <text x="${W - R + 8}" y="${e.py + 4}" font-size="11.5" font-weight="600" fill="${farbe(e.si)}">${esc(namen[e.id])}</text>`).join("");
      return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Kumulierter Gewinn je Spieler über alle Spieltage">${grid}${jahre}${linien}${labels}</svg>`;
    }

    _rekorde(d) {
      const r = d.rangliste;
      if (!r.length) return `<div class="leer">Noch keine Rekorde.</div>`;
      const best = (key, fn, filter = () => true) => r.filter(filter).filter((x) => x[key] != null).sort(fn)[0];
      const hoch = best("bester_spieltag", (a, b) => b.bester_spieltag - a.bester_spieltag);
      const tief = best("schlechtester_spieltag", (a, b) => a.schlechtester_spieltag - b.schlechtester_spieltag);
      const quote = best("quote", (a, b) => b.quote - a.quote, (x) => x.spiele >= 10);
      const std = best("gewinn_pro_stunde", (a, b) => b.gewinn_pro_stunde - a.gewinn_pro_stunde, (x) => x.stunden >= 6);
      const treu = best("spiele", (a, b) => b.spiele - a.spiele);
      const t = (l, x, wert) => this._tile(l, x ? esc(x.name) : "–", x ? wert(x) : "");
      return `<div class="rekorde">
        ${t("Höchster Abendgewinn", hoch, (x) => eur(x.bester_spieltag))}
        ${t("Höchster Abendverlust", tief, (x) => eur(x.schlechtester_spieltag))}
        ${t("Beste Gewinnquote", quote, (x) => `${zahl(x.quote, 1)} % (ab 10 Spielen)`)}
        ${std ? t("Bester Stundenlohn", std, (x) => `${eur(x.gewinn_pro_stunde)}/h`) : t("Immer dabei", treu, (x) => `${x.spiele} Spieltage`)}
      </div>`;
    }

    // ------------------------------------------------------------ Eintragen
    _oeffneForm() {
      const d = this._daten() || { spieler: [] };
      const jetzt = heute();
      const aktive = d.spieler.filter((s) => s.aktiv !== false);
      const werte = {};
      aktive.forEach((s) => (werte[s.id] = { e: String(this._config.standard_einsatz), g: "" }));
      this._form = {
        datum: jetzt.datum, beginn: "19:00", ende: jetzt.zeit, bez: "",
        alle: aktive, sel: new Set(aktive.map((s) => s.id)), werte,
        ignorieren: false, fehler: "", busy: false,
      };
      this._renderForm();
    }

    _schliesseForm() {
      this._form = null;
      this._modal.innerHTML = "";
    }

    _renderForm() {
      const f = this._form;
      if (!f) return;
      const chips = f.alle.map((s) => `<button class="chip ${f.sel.has(s.id) ? "an" : ""}" data-chip="${esc(s.id)}" aria-pressed="${f.sel.has(s.id)}">${esc(s.name)}</button>`).join("");
      const zeilen = f.alle.filter((s) => f.sel.has(s.id)).map((s) => `
        <div class="nm">${esc(s.name)}</div>
        <input inputmode="decimal" data-e="${esc(s.id)}" value="${esc(f.werte[s.id].e)}" aria-label="Einsatz ${esc(s.name)}">
        <div class="gw"><button class="pm" data-pm="${esc(s.id)}" aria-label="Vorzeichen umschalten">±</button>
        <input inputmode="decimal" data-g="${esc(s.id)}" value="${esc(f.werte[s.id].g)}" placeholder="0" aria-label="Gewinn ${esc(s.name)}"></div>`).join("");
      this._modal.innerHTML = `
        <div class="overlay" id="ov">
          <div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dt">
            <h2 id="dt">Spieltag eintragen</h2>
            <div class="sub">Gewinn = Endstand minus Einsatz. Verluste mit ± negativ machen.</div>
            <div class="f4">
              <label class="fl">Datum<input type="date" id="f-datum" value="${f.datum}"></label>
              <label class="fl">Beginn<input type="time" id="f-beginn" value="${f.beginn}"></label>
              <label class="fl">Ende<input type="time" id="f-ende" value="${f.ende}"></label>
            </div>
            <label class="fl" style="margin-top:10px">Bezeichnung (optional)<input id="f-bez" value="${esc(f.bez)}" placeholder="z. B. Malle 2027"></label>
            <div class="sec"><span>Wer war dabei?</span><span>${f.sel.size} ausgewählt</span></div>
            <div class="chips">${chips || '<span class="leer">Keine aktiven Spieler.</span>'}</div>
            ${f.sel.size ? `<div class="sec"><span>Ergebnisse</span></div>
              <div class="eing"><div class="kh">Spieler</div><div class="kh">Einsatz €</div><div class="kh">Gewinn €</div>${zeilen}</div>` : ""}
            <div id="summe"></div>
            <div class="msg" id="msg">${esc(f.fehler)}</div>
            <div class="fuss">
              <button class="btn" id="abbr">Abbrechen</button>
              <button class="btn gold" id="speichern" ${f.busy ? "disabled" : ""}>${f.busy ? "Speichert …" : "Spieltag speichern"}</button>
            </div>
          </div>
        </div>`;
      const $ = (s) => this._modal.querySelector(s);
      $("#ov").addEventListener("click", (ev) => { if (ev.target.id === "ov" && !f.busy) this._schliesseForm(); });
      $("#abbr").addEventListener("click", () => this._schliesseForm());
      $("#speichern").addEventListener("click", () => this._speichern());
      $("#f-datum").addEventListener("input", (ev) => (f.datum = ev.target.value));
      $("#f-beginn").addEventListener("input", (ev) => (f.beginn = ev.target.value));
      $("#f-ende").addEventListener("input", (ev) => (f.ende = ev.target.value));
      $("#f-bez").addEventListener("input", (ev) => (f.bez = ev.target.value));
      this._modal.querySelectorAll("[data-chip]").forEach((b) => b.addEventListener("click", () => {
        const id = b.dataset.chip;
        f.sel.has(id) ? f.sel.delete(id) : f.sel.add(id);
        this._renderForm();
      }));
      this._modal.querySelectorAll("[data-e]").forEach((i) => i.addEventListener("input", () => { f.werte[i.dataset.e].e = i.value; this._summe(); }));
      this._modal.querySelectorAll("[data-g]").forEach((i) => i.addEventListener("input", () => { f.werte[i.dataset.g].g = i.value; this._summe(); }));
      this._modal.querySelectorAll("[data-pm]").forEach((b) => b.addEventListener("click", () => {
        const id = b.dataset.pm;
        const t = f.werte[id].g.trim();
        f.werte[id].g = t.startsWith("-") ? t.slice(1) : "-" + (t || "");
        this._modal.querySelector(`[data-g="${CSS.escape(id)}"]`).value = f.werte[id].g;
        this._summe();
      }));
      this._summe();
    }

    _summe() {
      const f = this._form;
      const box = this._modal.querySelector("#summe");
      if (!f || !box) return;
      if (f.fehler) { f.fehler = ""; const m = this._modal.querySelector("#msg"); if (m) m.textContent = ""; }
      if (!f.sel.size) { box.innerHTML = ""; return; }
      let summe = 0, topf = 0;
      f.sel.forEach((id) => { summe += parse(f.werte[id].g) || 0; topf += parse(f.werte[id].e) || 0; });
      summe = Math.round(summe * 100) / 100;
      const ok = Math.abs(summe) < 0.005;
      box.innerHTML = `<div class="summe ${ok ? "ok" : "nok"}">
        <div><b>Summe der Gewinne: ${eur(summe)}</b><div style="font-size:12px;color:${C.muted};margin-top:2px">${ok ? `Passt. ${zahl(topf, 2)} € im Topf.` : "Sollte 0 € ergeben – bitte prüfen."}</div></div>
        ${ok ? "" : `<label class="cb"><input type="checkbox" id="ign" ${f.ignorieren ? "checked" : ""}>Trotzdem speichern</label>`}
      </div>`;
      const ign = box.querySelector("#ign");
      if (ign) ign.addEventListener("change", () => (f.ignorieren = ign.checked));
    }

    _zeigeFehler(text) {
      this._form.fehler = text;
      const m = this._modal.querySelector("#msg");
      if (m) m.textContent = text;
    }

    async _speichern() {
      const f = this._form;
      if (!f || f.busy) return;
      this._modal.querySelectorAll("input.fehler").forEach((i) => i.classList.remove("fehler"));
      if (!f.datum) return this._zeigeFehler("Bitte ein Datum angeben.");
      if (!f.sel.size) return this._zeigeFehler("Wähle mindestens einen Spieler aus.");
      const ergebnisse = [];
      let fehler = "";
      for (const s of f.alle.filter((s) => f.sel.has(s.id))) {
        const e = parse(f.werte[s.id].e);
        const g = parse(f.werte[s.id].g) ?? 0;
        if (!(e > 0)) { fehler = fehler || `${s.name}: Einsatz fehlt.`; this._modal.querySelector(`[data-e="${CSS.escape(s.id)}"]`)?.classList.add("fehler"); continue; }
        if (Number.isNaN(g)) { fehler = fehler || `${s.name}: Gewinn ist keine Zahl.`; this._modal.querySelector(`[data-g="${CSS.escape(s.id)}"]`)?.classList.add("fehler"); continue; }
        if (g < -e) { fehler = fehler || `${s.name}: Verlust größer als der Einsatz.`; this._modal.querySelector(`[data-g="${CSS.escape(s.id)}"]`)?.classList.add("fehler"); continue; }
        ergebnisse.push({ spieler: s.id, einsatz: e, gewinn: g });
      }
      if (fehler) return this._zeigeFehler(fehler);
      const summe = Math.round(ergebnisse.reduce((a, x) => a + x.gewinn, 0) * 100) / 100;
      if (Math.abs(summe) >= 0.005 && !f.ignorieren) return this._zeigeFehler(`Die Gewinne ergeben ${eur(summe)} statt 0 €. Korrigieren oder „Trotzdem speichern“ anhaken.`);

      const daten = { datum: f.datum, bezeichnung: f.bez.trim(), ergebnisse, summe_ignorieren: !!f.ignorieren };
      if (f.beginn) daten.beginn = f.beginn;
      if (f.ende) daten.ende = f.ende;
      f.busy = true; f.fehler = "";
      const btn = this._modal.querySelector("#speichern");
      if (btn) { btn.disabled = true; btn.textContent = "Speichert …"; }
      try {
        await this._hass.callService("poker_home_games", "spieltag_eintragen", daten);
        this._schliesseForm();
        this._toast("Spieltag gespeichert");
      } catch (err) {
        f.busy = false;
        if (btn) { btn.disabled = false; btn.textContent = "Spieltag speichern"; }
        this._zeigeFehler((err && err.message) || "Speichern fehlgeschlagen.");
      }
    }

    async _loescheLetzten() {
      const d = this._daten();
      if (!d || !d.letzter) return;
      const l = d.letzter;
      const text = `Spieltag vom ${datumDe(l.datum)}${l.bezeichnung ? " (" + l.bezeichnung + ")" : ""} wirklich löschen?\n\n` +
        l.ergebnisse.map((e) => `${e.name}: ${eur(e.gewinn)}`).join("\n");
      if (!window.confirm(text)) return;
      try {
        await this._hass.callService("poker_home_games", "letzten_spieltag_loeschen", {});
        this._toast("Spieltag gelöscht");
      } catch (err) {
        window.alert((err && err.message) || "Löschen fehlgeschlagen.");
      }
    }

    _toast(text) {
      this._toastEl.innerHTML = `<div class="toast" role="status">${esc(text)}</div>`;
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => (this._toastEl.innerHTML = ""), 2600);
    }
  }

  if (!customElements.get(TAG)) customElements.define(TAG, MgPokerDashboard);
  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === TAG)) {
    window.customCards.push({ type: TAG, name: "MG Poker Dashboard", description: "Poker Home Games im Glow-Stil (Panel-Ansicht)", preview: false });
  }
  console.info(`%c MG-POKER-DASHBOARD %c v${VERSION} `, "background:#f5b83d;color:#15171c;font-weight:700", "background:#161920;color:#f5b83d");
})();
