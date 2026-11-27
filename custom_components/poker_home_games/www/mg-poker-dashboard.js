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
 *   # ich: Marco                  (blendet die Seite „Meine Spiele“ ein)
 *   # ich_titel: Meine Spiele
 */
(() => {
  const VERSION = "1.11.0";
  const TAG = "mg-poker-dashboard";

  const DEFAULTS = {
    entity: null,
    title: "Pokerrunde",
    standard_einsatz: 20,
    ich: null,
    ich_titel: "Meine Spiele",
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
  const ueberMitternacht = (b, e) => !!(b && e && e <= b);
  const zeitText = (b, e, uhr = false) => (b && e ? `${b}–${e}${uhr ? " Uhr" : ""}${ueberMitternacht(b, e) ? " +1" : ""}` : "");
  const WT = ["So.", "Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa."];
  const mitternachtHinweis = (datum, b, e) => {
    if (!b || !e) return "";
    const [bh, bm] = b.split(":").map(Number), [eh, em] = e.split(":").map(Number);
    let min = eh * 60 + em - (bh * 60 + bm);
    const folgetag = min <= 0;
    if (folgetag) min += 1440;
    const dauer = (min / 60).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " h";
    if (!folgetag) return `Dauer ${dauer}`;
    let ende = "";
    if (datum) {
      const d = new Date(datum + "T12:00:00");
      d.setDate(d.getDate() + 1);
      ende = ` (${WT[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()})`;
    }
    return `<b>Ende am Folgetag${ende}</b> · Dauer ${dauer}`;
  };
  const isoPlus = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const tageZwischen = (von, bis) => Math.round((new Date(bis + "T12:00:00") - new Date(von + "T12:00:00")) / 86400000);
  const tagKurz = (iso) => { const d = new Date(iso + "T12:00:00"); return `${WT[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`; };
  const datumBereich = (von, bis) => (bis && bis > von ? `${datumDe(von).slice(0, 6)}–${datumDe(bis)}` : datumDe(von));
  const zeitHinweis = (datum, endeDatum, b, e) => {
    if (!(datum && endeDatum && endeDatum > datum)) return mitternachtHinweis(datum, b, e);
    const n = tageZwischen(datum, endeDatum) + 1;
    if (b && e) {
      const [bh, bm] = b.split(":").map(Number), [eh, em] = e.split(":").map(Number);
      const h = (tageZwischen(datum, endeDatum) * 1440 + eh * 60 + em - (bh * 60 + bm)) / 60;
      if (h > 0 && h <= 36) return `<b>Ende am ${tagKurz(endeDatum)}${endeDatum.slice(0, 4)}</b> · Dauer ${h.toLocaleString("de-DE", { maximumFractionDigits: 1 })} h`;
    }
    return `<b>${n} Tage</b> · für die Spieldauer Tagesergebnisse mit Uhrzeiten eintragen`;
  };
  const heute = () => {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return { datum: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, zeit: `${p(d.getHours())}:${p(d.getMinutes())}` };
  };

  const STYLE = `
    :host { display:block; min-width:0; max-width:100%; contain:inline-size; }
    * { box-sizing:border-box; }
    .wrap {
      min-height:100%; padding:22px; color:${C.text};
      background:
        radial-gradient(1200px 600px at 0% 0%, #2a2410 0%, transparent 60%),
        radial-gradient(900px 500px at 100% 100%, #0f2a22 0%, transparent 60%),
        ${C.bg};
      font-family: var(--primary-font-family, inherit);
    }
    .inner { max-width:1800px; margin:0 auto; display:flex; flex-direction:column; gap:18px; }
    .card { background:${C.card}; border:1px solid ${C.cardBorder}; border-radius:26px; padding:20px 22px; min-width:0; }
    .h { font-size:13px; font-weight:600; letter-spacing:1.5px; text-transform:uppercase; color:${C.muted}; margin:0 0 14px; display:flex; justify-content:space-between; align-items:baseline; gap:10px; }
    .h small { text-transform:none; letter-spacing:0; font-weight:400; font-size:13px; color:${C.muted}; }
    .tile { background:${C.tile}; border:1px solid ${C.tileBorder}; border-radius:16px; padding:10px 14px; min-width:0; }
    .tl { font-size:11px; letter-spacing:1px; text-transform:uppercase; color:${C.muted}; }
    .tv { font-size:20px; font-weight:700; margin-top:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .ts { font-size:12px; color:${C.muted}; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    .kopf { display:grid; grid-template-columns:auto minmax(0,1fr) auto; align-items:center; gap:18px; }
    .ktitel { min-width:0; }
    .kstats { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:10px; min-width:0; }
    .kstats:empty { display:none; }
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

    .grid { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1.25fr); gap:16px; align-items:start; }
    .col { display:flex; flex-direction:column; gap:16px; min-width:0; }
    .paar { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr); gap:16px; }
    .fill { display:flex; flex-direction:column; }
    .fillbody { min-height:0; }
    .chartbox { height:280px; overflow:hidden; }

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
    .tend { width:30px; flex:none; font-size:11.5px; font-weight:700; font-variant-numeric:tabular-nums; text-align:center; border-radius:6px; padding:1px 0; }
    .tend.auf { color:${C.green}; background:${C.green}18; }
    .tend.ab { color:${C.red}; background:${C.red}18; }
    .tend.gleich { color:${C.muted}; font-size:9px; }
    .tend.neu { color:${C.cyan}; background:${C.cyan}18; font-size:10px; font-weight:600; }
    .rnr { width:22px; color:${C.muted}; font-size:13px; font-variant-numeric:tabular-nums; }
    .rn { flex:1; font-weight:600; font-size:15px; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .rn .inaktiv { color:${C.muted}; font-weight:400; font-size:12px; margin-left:6px; }
    .rg { font-weight:700; font-size:15px; font-variant-numeric:tabular-nums; }
    .bar { margin:7px 0 0 76px; height:6px; border-radius:3px; background:rgba(255,255,255,0.05); position:relative; }
    .bar i { position:absolute; top:0; height:6px; border-radius:3px; }
    .bar b { position:absolute; left:50%; top:-3px; width:1px; height:12px; background:rgba(255,255,255,0.25); }
    .rs { margin:6px 0 0 76px; font-size:12px; color:${C.muted}; display:flex; flex-wrap:wrap; gap:4px 14px; }
    .grid.ich .bar, .grid.ich .rs { margin-left:22px; }

    .chips { display:flex; flex-wrap:wrap; gap:8px; }
    .erg { border-radius:12px; padding:7px 12px; font-size:13.5px; font-weight:600; display:inline-flex; gap:8px; align-items:baseline; }
    .erg span { font-weight:400; font-variant-numeric:tabular-nums; }
    .meta { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin-top:12px; }
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

    .f2 { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px; }
    .f5 { display:grid; grid-template-columns:1.2fr 1.2fr 1fr 1fr; gap:10px; }
    .f5.ohnezeit { grid-template-columns:1fr 1fr; }
    .opt { font-size:11px; color:${C.muted}; font-weight:400; opacity:.8; }
    .tagschalter { margin-top:8px; }
    .tagtabs .tg { position:relative; padding:6px 11px; font-size:13px; }
    .tagtabs .pkt { position:absolute; top:4px; right:4px; width:6px; height:6px; border-radius:50%; background:${C.green}; }
    .auf { font:inherit; font-size:11.5px; font-weight:600; cursor:pointer; color:${C.gold}; background:${C.gold}12; border:1px solid ${C.gold}44; border-radius:7px; padding:1px 7px; margin-top:3px; display:inline-block; }
    .mx tr.unter td { background:rgba(255,255,255,0.02); font-size:12.5px; border-top-color:rgba(255,255,255,0.04); }
    .mx tr.unter td.stk { background:#171a20; }
    .mx tr.unter .einr { padding-left:12px; border-left:2px solid ${C.gold}55; display:inline-block; }
    .tagbox { margin-top:10px; border:1px solid ${C.tileBorder}; border-radius:14px; padding:12px; }
    .hr { display:inline-flex; gap:14px; align-items:baseline; }
    .dlg.breit { max-width:680px; }
    .zeitknopf { color:${C.gold}; border-color:${C.gold}66; }
    .vorlage { display:flex; align-items:center; gap:8px; flex-wrap:wrap; background:${C.gold}0f; border:1px solid ${C.gold}44; border-radius:14px; padding:10px 12px; margin-bottom:12px; }
    .vorlage span { font-size:12px; color:${C.gold}; font-weight:600; letter-spacing:1px; text-transform:uppercase; margin-right:4px; }
    .vorlage input { width:120px; }
    .zliste { max-height:52vh; overflow:auto; border:1px solid ${C.tileBorder}; border-radius:14px; padding:4px 10px; }
    .zr { display:grid; grid-template-columns:minmax(0,1fr) 112px 112px 92px; gap:8px; align-items:center; padding:7px 0; border-top:1px solid ${C.tileBorder}; }
    .zr:first-child { border-top:none; }
    .zr input { padding:7px 8px; font-size:14px; }
    .zd { min-width:0; display:flex; flex-direction:column; }
    .zd b { font-weight:600; font-size:14px; }
    .zd span { font-size:11.5px; color:${C.muted}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .zh { font-size:11.5px; color:${C.muted}; white-space:nowrap; }
    .zstand { font-size:12.5px; color:${C.muted}; align-self:center; }
    .hint { font-size:12.5px; color:${C.muted}; margin-top:6px; min-height:16px; }
    .hint b { color:${C.gold}; font-weight:600; }
    .segs { display:inline-flex; gap:4px; align-items:center; flex-wrap:wrap; justify-content:flex-end; text-transform:none; letter-spacing:0; }
    .sg { font:inherit; font-size:12px; font-weight:600; cursor:pointer; color:${C.muted}; background:none; border:1px solid transparent; border-radius:9px; padding:4px 9px; }
    .sg.an { color:${C.gold}; border-color:${C.gold}88; background:${C.gold}14; }
    .sg:focus-visible, .ortwahl:focus-visible { outline:2px solid ${C.gold}; outline-offset:2px; }
    .ortwahl { font:inherit; font-size:12px; color:${C.text}; background:${C.tile}; border:1px solid ${C.tileBorder}; border-radius:9px; padding:3px 8px; max-width:150px; color-scheme:dark; }
    .ergl { display:grid; grid-template-columns:repeat(2, minmax(0,1fr)); gap:4px 14px; }
    .el { display:flex; justify-content:space-between; gap:8px; font-size:13.5px; padding:4px 8px; border-radius:8px; }
    .el .en { font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .el .ew { font-weight:700; font-variant-numeric:tabular-nums; white-space:nowrap; }
    .el.sieg { background:${C.gold}14; box-shadow:inset 0 0 0 1px ${C.gold}55; }
    .el.sieg .en::after { content:" ♛"; color:${C.gold}; font-size:11px; }
    .ltab-wrap { overflow-x:auto; }
    .ltab { width:100%; border-collapse:separate; border-spacing:0; font-variant-numeric:tabular-nums; color:${C.text}; font-size:14px; font-family:inherit; }
    .ltab th { font-size:10.5px; letter-spacing:1px; text-transform:uppercase; color:${C.muted}; font-weight:600; padding:0 8px 6px; text-align:right; }
    .ltab td.num { text-align:right; }
    .ltab th.links, .ltab td.links { text-align:left; }
    .ltab td { padding:6px 8px; border-top:1px solid ${C.tileBorder}; white-space:nowrap; }
    .ltab td.n { font-weight:600; }
    .ltab td.ein { color:#b9bfcb; }
    .ltab td.g { font-weight:700; }
    .ltab tr.sieg td { background:${C.gold}12; }
    .ltab tr.sieg td:first-child { box-shadow:inset 2px 0 0 ${C.gold}; }
    .ltab tr.sieg td.n::after { content:" ♛"; color:${C.gold}; font-size:11px; }
    .lstats { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:8px; margin-top:12px; }
    .ls { background:${C.tile}; border:1px solid ${C.tileBorder}; border-radius:12px; padding:7px 10px; min-width:0; }
    .lsl { font-size:10px; letter-spacing:1px; text-transform:uppercase; color:${C.muted}; }
    .lsv { font-size:16px; font-weight:700; margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .lss { font-size:11px; color:${C.muted}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    textarea { font:inherit; font-family:ui-monospace, Menlo, Consolas, monospace; font-size:12px; color:${C.text}; background:${C.tile};
      border:1px solid ${C.tileBorder}; border-radius:12px; padding:10px 12px; width:100%; resize:vertical; white-space:pre; overflow:auto; color-scheme:dark; }
    textarea:focus { border-color:${C.gold}88; outline:none; }
    .f3 { display:grid; grid-template-columns:1.2fr 1fr 1.2fr; gap:10px; margin-top:10px; }
    .dot { width:10px; height:10px; border-radius:50%; flex:none; }
    .art { display:inline-block; font-size:12px; font-weight:600; border:1px solid; border-radius:8px; padding:2px 8px; white-space:nowrap; }
    .rekorde.r3 { grid-template-columns:repeat(3,minmax(0,1fr)); }
    .rekorde.r6 { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .tile.rk .rkh { display:flex; align-items:baseline; justify-content:space-between; gap:8px; margin-top:3px; min-width:0; }
    .tile.rk .tv { margin-top:0; font-size:17px; }
    .tile.rk .tv { flex:0 1 auto; min-width:3.5em; }
    .tile.rk .rkw { font-weight:700; font-size:14px; white-space:nowrap; font-variant-numeric:tabular-nums; overflow:hidden; text-overflow:ellipsis; min-width:0; flex:0 1 auto; }
    .grid.ich .chartbox { height:300px; }
    .tbl tfoot td { border-top:1px solid rgba(255,255,255,0.22); font-weight:700; }
    .btn.rot { color:${C.red}; border-color:${C.red}66; background:${C.red}10; }
    .aktionen { margin-top:12px; display:flex; justify-content:flex-end; gap:16px; }
    .link.edit:hover { color:${C.gold}; }
    .dz { display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .ed { font:inherit; cursor:pointer; background:none; border:1px solid transparent; color:${C.muted}; border-radius:8px; width:28px; height:28px; flex:none; font-size:14px; }
    .ed:hover, .ed:focus-visible { color:${C.gold}; border-color:${C.gold}66; outline:none; }
    .hinweis { font-size:12px; color:${C.muted}; align-self:center; margin-left:4px; }
    .mx { border-collapse:separate; border-spacing:0; width:100%; font-variant-numeric:tabular-nums; color:${C.text}; font-size:13px; font-family:inherit; }
    .mx th, .mx td { padding:7px 8px; white-space:nowrap; text-align:right; border-top:1px solid ${C.tileBorder}; }
    .mx thead th { border-top:none; font-size:11px; color:${C.muted}; font-weight:600; letter-spacing:.5px; padding-bottom:8px; }
    .mx thead th button { font:inherit; color:inherit; letter-spacing:inherit; background:none; border:none; cursor:pointer; padding:0; text-transform:uppercase; }
    .mx thead th button.an { color:${C.gold}; }
    .mx thead th button:focus-visible { outline:2px solid ${C.gold}; outline-offset:2px; }
    .mx th.pn { text-align:center; color:${C.text}; font-size:13px; letter-spacing:0; border-bottom:1px solid ${C.tileBorder}; padding-bottom:6px; }
    .mx .grp { border-left:1px solid rgba(255,255,255,0.09); }
    .mx .links { text-align:left; }
    .mx .stk { position:sticky; left:0; z-index:1; background:#15181e; }
    .mx td .klein { display:block; font-size:11px; color:${C.muted}; font-weight:400; margin-top:1px; }
    .mx td.ein { color:#b9bfcb; }
    .mx td.gew { font-weight:700; }
    .mx td.sieg { background:${C.gold}1c; box-shadow:inset 0 0 0 1px ${C.gold}66; }
    .mx td.sieg::after { content:" ♛"; color:${C.gold}; font-size:10px; }
    .mx td.nix { color:rgba(255,255,255,0.18); text-align:center; }
    .mx tbody tr:hover td { background-color:rgba(255,255,255,0.035); }
    .mx tbody tr:hover td.stk { background-color:#1b1e25; }
    .mx tfoot td { border-top:1px solid rgba(255,255,255,0.22); font-weight:700; background:#15181e00; }
    .mx tfoot tr.fz td { border-top:none; font-weight:400; font-size:12px; color:${C.muted}; text-align:center; }
    .mx tfoot tr.fz td.links { text-align:left; }

    /* Übersicht auf einen Bildschirm (Browser) */
    @media (min-width: 1100px) and (min-height: 640px) {
      .wrap { height:calc(100vh - var(--header-height, 56px)); padding:16px 20px; overflow:hidden; }
      .wrap:has(.seite-spiele), .wrap:has(.seite-ich) { height:auto; min-height:calc(100vh - var(--header-height, 56px)); overflow:visible; }
      .inner.seite-uebersicht { height:100%; gap:14px; }
      .seite-uebersicht .grid { flex:1; min-height:0; grid-template-rows:minmax(0,1fr); align-items:stretch; }
      .seite-uebersicht .col { min-height:0; gap:14px; }
      .seite-uebersicht .card { padding:14px 18px; border-radius:22px; }
      .seite-uebersicht .h { margin-bottom:10px; }
      .seite-uebersicht .fill { flex:1; min-height:0; }
      .seite-uebersicht .fillbody { flex:1; overflow:auto; }
      .seite-uebersicht .chartbox { height:auto; overflow:hidden; }
      .seite-uebersicht .paar { gap:14px; flex:1.5; min-height:0; }
      .seite-uebersicht .col:last-child > .fill { flex:1; }
      .seite-uebersicht .paar > .card { display:flex; flex-direction:column; min-height:0; overflow:auto; }
      .seite-uebersicht .paar > .card > * { flex-shrink:0; }
      .seite-uebersicht .paar .ltab td { padding:7px 8px; }
      .seite-uebersicht .paar .aktionen { margin-top:auto; padding-top:10px; }
      .seite-uebersicht .rekorde.r6 { gap:8px; }
      .seite-uebersicht .row { padding:6px 0; }
      .seite-uebersicht .rn, .seite-uebersicht .rg { font-size:14px; }
      .seite-uebersicht .bar { margin-top:5px; }
      .seite-uebersicht .rs { margin-top:4px; font-size:11.5px; }
      .seite-uebersicht .podium { align-items:stretch; gap:10px; }
      .seite-uebersicht .platz, .seite-uebersicht .platz.p1 { display:grid; grid-template-columns:auto minmax(0,1fr); grid-template-rows:auto auto;
        column-gap:10px; align-items:center; text-align:left; padding:8px 12px; border-radius:16px; }
      .seite-uebersicht .platz .av, .seite-uebersicht .platz.p1 .av { grid-row:1 / 3; width:34px; height:34px; font-size:14px; margin:0; }
      .seite-uebersicht .platz.p1 .av { box-shadow:0 0 14px ${C.gold}88; }
      .seite-uebersicht .platz .n, .seite-uebersicht .platz.p1 .n { font-size:14px; }
      .seite-uebersicht .platz .g, .seite-uebersicht .platz.p1 .g { font-size:14px; margin:0; }
      .seite-uebersicht .platz .s, .seite-uebersicht .krone { display:none; }
      .seite-uebersicht .platz .nr { font-size:34px; top:0; right:8px; }
      .seite-uebersicht .meta { margin-top:10px; }
      .seite-uebersicht .meta .tile, .seite-uebersicht .rekorde .tile { padding:8px 10px; }
      .seite-uebersicht .meta .tv, .seite-uebersicht .rekorde .tv { font-size:16px; }
      .kstats .tile { padding:8px 12px; }
      .kstats .tv { font-size:18px; }
      .titel { font-size:26px; }
    }

    /* niedrige Fenster (Laptop): weiter verdichten */
    @media (min-width: 1100px) and (min-height: 640px) and (max-height: 900px) {
      .seite-uebersicht .rs { display:none; }
      .seite-uebersicht .row { padding:6px 0; }
      .seite-uebersicht .meta .ts { display:none; }
      .seite-uebersicht .paar { flex:2.1; }
      .seite-uebersicht .paar .ltab { font-size:13px; }
      .seite-uebersicht .paar .ltab td { padding:3px 6px; }
      .seite-uebersicht .paar .ltab th { padding:0 6px 4px; }
      .seite-uebersicht .paar .lstats { margin-top:8px; gap:6px; }
      .seite-uebersicht .paar .ls { padding:5px 8px; }
      .seite-uebersicht .paar .lsv { font-size:14px; }
      .seite-uebersicht .paar .lss { display:none; }
      .seite-uebersicht .paar .aktionen { padding-top:6px; }
      .seite-uebersicht .tile.rk { padding:6px 10px; }
      .seite-uebersicht .tile.rk .tv { font-size:15px; }
      .seite-uebersicht .tile.rk .tl { font-size:10px; }
      .seite-uebersicht .tile.rk .ts { font-size:11px; }
    }
    @media (max-width: 1280px) { .hinweis { display:none; } }
    @media (max-width: 1099px) {
      .kopf { grid-template-columns:minmax(0,1fr) auto; }
      .kstats { grid-column:1 / -1; order:3; }
    }
    @media (max-width: 980px) { .grid { grid-template-columns:minmax(0,1fr); } }
    @media (max-width: 640px) {
      .wrap { padding:12px; }
      .card { padding:16px; border-radius:22px; }
      .stats, .kstats { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .kopf { grid-template-columns:minmax(0,1fr); }
      .kopf-r { justify-content:space-between; }
      .paar { grid-template-columns:minmax(0,1fr); }
      .titel { font-size:24px; }
      .podium { gap:8px; }
      .platz { padding:12px 6px; }
      .platz .roi { display:none; }
      .f4 { grid-template-columns:1fr 1fr; }
      .f4 label:first-child { grid-column:1 / -1; }
      .f2, .f3 { grid-template-columns:1fr; }
      .f5 { grid-template-columns:1fr 1fr; }
      .lstats { grid-template-columns:repeat(2, minmax(0,1fr)); }
      .zr { grid-template-columns:minmax(0,1fr) 92px 92px; }
      .zh { display:none; }
      .rekorde.r3 { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .grid.ich .chartbox { height:240px; }
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
      this._listeJahr = "alle";
      this._zeigeEndstand = false;
      this._listeOrt = "alle";
      this._aufgeklappt = new Set();
      this._sessions = null;
      this._sessionsSig = null;
      this._ichSort = { key: "datum", ab: true };
      this._ichArt = "alle";
      this._ichJahr = "alle";
      this._ichBlinds = "alle";
      this._podiumModus = "gesamt";
      this._tabJahr = "gesamt";
      this._podiumOrt = null;
      this._sform = null;
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
        orte: a.orte || [],
        nachOrt: a.nach_ort || {},
        rekordeG: a.rekorde || {},
        nachJahr: a.nach_jahr || {},
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
      if (this._seite === "ich" && !this._config.ich) this._seite = "uebersicht";
      const seite = this._seite === "spiele" ? this._seiteSpiele(d) : this._seite === "ich" ? this._seiteIch(d) : this._seiteUebersicht(d);
      this._root.className = `inner seite-${this._seite}`;
      this._root.innerHTML = `
        <div class="kopf">
          <div class="ktitel">
            <div class="titel">${esc(this._config.title)} <span class="suits">♠ ♥ ♦ ♣</span></div>
            <div class="stand">${stand}</div>
          </div>
          <div class="kstats">${seite.stats}</div>
          <div class="kopf-r">
            <div class="tabs" role="tablist">
              <button class="tab ${this._seite === "uebersicht" ? "an" : ""}" role="tab" aria-selected="${this._seite === "uebersicht"}" data-seite="uebersicht">Übersicht</button>
              <button class="tab ${this._seite === "spiele" ? "an" : ""}" role="tab" aria-selected="${this._seite === "spiele"}" data-seite="spiele">Alle Spiele</button>
              ${this._config.ich ? `<button class="tab ${this._seite === "ich" ? "an" : ""}" role="tab" aria-selected="${this._seite === "ich"}" data-seite="ich">${esc(this._config.ich_titel)}</button>` : ""}
            </div>
            <button class="btn gold" id="neu">${this._seite === "ich" ? "＋ Session" : "＋ Spieltag"}</button>
          </div>
        </div>
        ${seite.body}`;
      this._root.querySelector("#neu").addEventListener("click", () => (this._seite === "ich" ? this._oeffneSession() : this._oeffneForm()));
      this._root.querySelectorAll("[data-seite]").forEach((b) => b.addEventListener("click", () => {
        if (this._seite === b.dataset.seite) return;
        this._seite = b.dataset.seite;
        this._renderMain();
      }));
      if (this._seite === "spiele") this._bindeSpiele();
      else if (this._seite === "ich") this._bindeIch();
      else this._beobachteChart((w, h) => this._chart(d, w, h));
      this._root.querySelectorAll("[data-podium]").forEach((b) => b.addEventListener("click", () => {
        this._podiumModus = b.dataset.podium; this._renderMain();
      }));
      const tj = this._root.querySelector("#tab-jahr");
      if (tj) tj.addEventListener("change", () => { this._tabJahr = tj.value; this._renderMain(); });
      const ow = this._root.querySelector("#podium-ort");
      if (ow) ow.addEventListener("change", () => { this._podiumOrt = ow.value; this._renderMain(); });
      const del = this._root.querySelector("#loeschen");
      if (del) del.addEventListener("click", () => this._loescheLetzten());
      const bea = this._root.querySelector("#bearbeiten");
      if (bea) bea.addEventListener("click", () => { const l = this._daten().letzter; if (l) this._oeffneForm(l); });
    }

    _seiteUebersicht(d) {
      const stats = `
          ${this._tile("Spieltage", d.spieltage, d.verlauf.length ? `seit ${datumDe(d.verlauf[0].datum).slice(3)}` : "")}
          ${this._tile("Teilnahmen", d.teilnahmen, d.spieltage ? `Ø ${zahl(d.teilnahmen / d.spieltage, 1)} pro Abend` : "")}
          ${this._tile("Eingesetzt", Math.round(d.einsatz).toLocaleString("de-DE") + " €", d.spieltage ? `Ø ${Math.round(d.einsatz / d.spieltage)} € im Topf` : "")}
          ${this._tile("Gespielt", d.stunden ? zahl(d.stunden, 1) + " h" : "–", d.stunden ? "mit Uhrzeiten" : "keine Uhrzeiten")}`;
      const body = `
        <div class="grid ueb">
          <div class="col">
            <div class="card">${this._podium(d)}</div>
            <div class="card fill">${this._tabelleKopf(d)}<div class="fillbody">${this._tabelle(d)}</div></div>
          </div>
          <div class="col">
            <div class="card fill"><div class="h">Verlauf <small>Kontostand über alle Spieltage</small></div><div class="fillbody chartbox" id="chartbox"></div></div>
            <div class="paar">
              <div class="card">${this._letzter(d)}</div>
              <div class="card"><div class="h">Rekorde</div>${this._rekorde(d)}</div>
            </div>
          </div>
        </div>`;
      return { stats, body };
    }

    _beobachteChart(zeichneFn) {
      const box = this._root.querySelector("#chartbox");
      if (!box) return;
      if (this._ro) this._ro.disconnect();
      const zeichne = () => {
        const w = Math.round(box.clientWidth), h = Math.round(box.clientHeight);
        if (w < 50 || h < 50) return;
        if (box._mass === `${w}x${h}|${this._sig}`) return;
        box._mass = `${w}x${h}|${this._sig}`;
        box.innerHTML = zeichneFn(w, h);
      };
      this._ro = new ResizeObserver(zeichne);
      this._ro.observe(box);
      zeichne();
    }

    // ------------------------------------------------------------ Alle Spiele (wie Excel)
    _seiteSpiele(d) {
      if (this._spieltageSig !== this._sig && !this._laedt) this._ladeSpieltage();
      if (!this._spieltage) {
        return { stats: "", body: `<div class="card"><div class="leer">${this._ladeFehler ? esc(this._ladeFehler) : "Lade alle Spiele …"}</div></div>` };
      }
      let tage = this._spieltage.slice();
      const jahre = [...new Set(tage.map((t) => t.datum.slice(0, 4)))].sort().reverse();
      if (this._listeJahr !== "alle") tage = tage.filter((t) => t.datum.startsWith(this._listeJahr));
      const orte = [...new Set(this._spieltage.map((t) => t.ort).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de"));
      const ohneZeit = this._spieltage.filter((t) => (!t.beginn || !t.ende) && !(t.tage && t.tage.length)).length;
      if (this._listeOrt !== "alle") tage = tage.filter((t) => (t.ort || "") === this._listeOrt);

      const namen = new Map();
      tage.forEach((t) => t.ergebnisse.forEach((e) => namen.set(e.spieler, e.name)));
      const spieler = [...namen].sort((a, b) => a[1].localeCompare(b[1], "de"));
      const zeilen = tage.map((t) => {
        const m = {};
        t.ergebnisse.forEach((e) => (m[e.spieler] = e));
        const g = t.ergebnisse.map((e) => e.gewinn);
        return { t, m, maxg: Math.max(...g), ming: Math.min(...g) };
      });

      // Sortierung
      const { key, ab } = this._listeSort;
      let wert;
      if (key === "datum") wert = (z) => z.t.datum + (z.t.beginn || "");
      else if (key === "topf") wert = (z) => z.t.topf;
      else if (key === "maxg") wert = (z) => z.maxg;
      else if (key === "maxv") wert = (z) => -z.ming;
      else {
        const [, pid, f] = key.split(":");
        wert = (z) => { const e = z.m[pid]; if (!e) return null; return f === "e" ? e.einsatz : f === "s" ? e.endstand : e.gewinn; };
      }
      zeilen.sort((a, b) => {
        const va = wert(a), vb = wert(b);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        const c = va < vb ? -1 : va > vb ? 1 : 0;
        if (c) return ab ? -c : c;
        return a.t.datum < b.t.datum ? 1 : a.t.datum > b.t.datum ? -1 : 0;
      });

      const end = this._zeigeEndstand;
      const felder = end ? [["e", "Einsatz"], ["s", "Endstand"], ["g", "Gewinn"]] : [["e", "Einsatz"], ["g", "Gewinn"]];
      const pfeil = (k) => (key === k ? (ab ? " ↓" : " ↑") : "");
      const sortBtn = (k, label) => `<button class="fc ${key === k ? "an" : ""}" data-sort="${k}" aria-pressed="${key === k}">${label}<span class="pf">${pfeil(k)}</span></button>`;
      const thS = (k, label, cls = "") => `<th class="${cls}"><button class="${key === k ? "an" : ""}" data-sort="${k}">${label}${pfeil(k)}</button></th>`;

      const kopf1 = `<tr>${thS("datum", "Datum", "stk links")}${thS("topf", "Gesamt&shy;einsatz")}
        ${spieler.map(([, nm]) => `<th class="pn grp" colspan="${felder.length}">${esc(nm)}</th>`).join("")}</tr>`;
      const kopf2 = `<tr><th class="stk"></th><th></th>${spieler.map(([id]) => felder.map(([f, l], i) =>
        thS(`p:${id}:${f}`, l, i === 0 ? "grp" : "")).join("")).join("")}</tr>`;

      const body = zeilen.map((z) => {
        const zeit = zeitText(z.t.beginn, z.t.ende);
        const info = [z.t.ort, z.t.bezeichnung, z.t.blinds, zeit].filter(Boolean).join(" · ");
        const zellen = spieler.map(([id]) => {
          const e = z.m[id];
          if (!e) return felder.map((_, i) => `<td class="${i === 0 ? "grp " : ""}nix">·</td>`).join("");
          const sieg = e.gewinn === z.maxg && z.maxg > 0;
          return felder.map(([f], i) => {
            const cls = i === 0 ? "grp " : "";
            if (f === "e") return `<td class="${cls}ein">${zahl(e.einsatz, 2)}</td>`;
            if (f === "s") return `<td class="${cls}ein">${zahl(e.endstand, 2)}</td>`;
            return `<td class="${cls}gew ${sieg ? "sieg" : ""}" style="color:${vz(e.gewinn)}">${eur(e.gewinn).replace(" €", "")}</td>`;
          }).join("");
        }).join("");
        const tl = z.t.tage || [];
        const offen = tl.length && this._aufgeklappt.has(z.t.id);
        const auf = tl.length ? `<button class="auf" data-auf="${esc(z.t.id)}" aria-expanded="${!!offen}">${offen ? "▾" : "▸"} ${tl.length} Tage</button>` : "";
        let unter = "";
        if (offen) {
          unter = tl.map((t) => {
            const m = {};
            t.ergebnisse.forEach((e) => (m[e.spieler] = e));
            const mx = Math.max(...t.ergebnisse.map((e) => e.gewinn));
            const zz = spieler.map(([id]) => {
              const e = m[id];
              if (!e) return felder.map((_, i) => `<td class="${i === 0 ? "grp " : ""}nix">·</td>`).join("");
              return felder.map(([fx], i) => {
                const cls = i === 0 ? "grp " : "";
                if (fx === "e") return `<td class="${cls}ein">${zahl(e.einsatz, 2)}</td>`;
                if (fx === "s") return `<td class="${cls}ein">${zahl(e.endstand, 2)}</td>`;
                return `<td class="${cls}gew ${e.gewinn === mx && mx > 0 ? "sieg" : ""}" style="color:${vz(e.gewinn)}">${eur(e.gewinn).replace(" €", "")}</td>`;
              }).join("");
            }).join("");
            const tz = zeitText(t.beginn, t.ende);
            return `<tr class="unter"><td class="stk links"><span class="einr">${tagKurz(t.datum)}</span>${tz ? `<span class="klein">${tz}</span>` : ""}</td>
              <td>${zahl(t.topf, 0)} €<span class="klein">${t.ergebnisse.length} Spieler</span></td>${zz}</tr>`;
          }).join("");
        }
        return `<tr class="${offen ? "offen" : ""}"><td class="stk links"><div class="dz"><div>${datumBereich(z.t.datum, z.t.ende_datum)}${info ? `<span class="klein">${esc(info)}</span>` : ""}${auf}</div>
          <button class="ed" data-edit="${esc(z.t.id)}" aria-label="Spieltag vom ${datumDe(z.t.datum)} bearbeiten" title="Bearbeiten">✎</button></div></td>
          <td><b>${zahl(z.t.topf, 0)} €</b><span class="klein">${z.t.ergebnisse.length} Spieler</span></td>${zellen}</tr>${unter}`;
      }).join("");

      // Summen wie in der Excel-Kopfzeile
      const sum = {};
      spieler.forEach(([id]) => (sum[id] = { e: 0, s: 0, g: 0, n: 0, plus: 0 }));
      zeilen.forEach((z) => Object.values(z.m).forEach((e) => {
        const x = sum[e.spieler]; x.e += e.einsatz; x.s += e.endstand; x.g += e.gewinn; x.n++; if (e.gewinn > 0) x.plus++;
      }));
      const topfSumme = zeilen.reduce((a, z) => a + z.t.topf, 0);
      const fuss1 = `<tr><td class="stk links">Summe</td><td>${Math.round(topfSumme).toLocaleString("de-DE")} €</td>${spieler.map(([id]) => felder.map(([f], i) => {
        const x = sum[id], cls = i === 0 ? "grp" : "";
        if (f === "e") return `<td class="${cls}">${zahl(x.e, 2)}</td>`;
        if (f === "s") return `<td class="${cls}">${zahl(x.s, 2)}</td>`;
        return `<td class="${cls}" style="color:${vz(x.g)}">${eur(x.g).replace(" €", "")}</td>`;
      }).join("")).join("")}</tr>`;
      const fuss2 = `<tr class="fz"><td class="stk links">Spiele · Ø · ROI</td><td>${zeilen.length} Abende</td>${spieler.map(([id]) => {
        const x = sum[id];
        return `<td class="grp" colspan="${felder.length}">${x.n} · <span style="color:${vz(x.g)}">${eur(x.n ? x.g / x.n : 0)}</span> · ${x.e ? zahl((x.s / x.e) * 100, 1) : "0,0"} %</td>`;
      }).join("")}</tr>`;

      const n = zeilen.length;
      const teiln = zeilen.reduce((a, z) => a + z.t.ergebnisse.length, 0);
      const groesster = zeilen.reduce((a, z) => (z.t.topf > (a ? a.t.topf : -1) ? z : a), null);
      const stats = `
          ${this._tile("Spieltage", n, this._listeJahr === "alle" ? "alle Jahre" : this._listeJahr)}
          ${this._tile("Gesamteinsatz", Math.round(topfSumme).toLocaleString("de-DE") + " €", `Ø ${n ? Math.round(topfSumme / n) : 0} € pro Abend`)}
          ${this._tile("Ø Spieler", n ? zahl(teiln / n, 1) : "–", `${teiln} Teilnahmen`)}
          ${this._tile("Größter Topf", groesster ? zahl(groesster.t.topf, 0) + " €" : "–", groesster ? datumDe(groesster.t.datum) + (groesster.t.bezeichnung ? " · " + esc(groesster.t.bezeichnung) : "") : "")}`;

      const html = `
        <div class="card filter">
          <div class="frow"><div class="flab">Sortieren</div><div class="fchips">
            ${sortBtn("datum", "Datum")}${sortBtn("maxg", "Höchster Gewinn")}${sortBtn("maxv", "Höchster Verlust")}${sortBtn("topf", "Gesamteinsatz")}
            <span class="hinweis">oder Spaltenkopf eines Spielers anklicken</span>
          </div></div>
          <div class="frow"><div class="flab">Jahr</div><div class="fchips">
            <button class="fc ${this._listeJahr === "alle" ? "an" : ""}" data-jahr="alle">Alle</button>
            ${jahre.map((j) => `<button class="fc ${this._listeJahr === j ? "an" : ""}" data-jahr="${j}">${j}</button>`).join("")}
            <button class="fc ${end ? "an" : ""}" id="endstand" aria-pressed="${end}" style="margin-left:auto">Endstand anzeigen</button>
            ${ohneZeit ? `<button class="fc zeitknopf" id="zeiten">Uhrzeiten nachtragen (${ohneZeit})</button>` : ""}
          </div></div>
          ${orte.length ? `<div class="frow"><div class="flab">Ort</div><div class="fchips">
            <button class="fc ${this._listeOrt === "alle" ? "an" : ""}" data-ort="alle">Alle</button>
            ${orte.map((o) => `<button class="fc ${this._listeOrt === o ? "an" : ""}" data-ort="${esc(o)}">${esc(o)}</button>`).join("")}
          </div></div>` : ""}
        </div>
        <div class="card">
          <div class="h">Tagesübersicht <small>${n} ${n === 1 ? "Spieltag" : "Spieltage"} · ♛ Abendsieger</small></div>
          ${n ? `<div class="scroll"><table class="mx">
            <thead>${kopf1}${kopf2}</thead><tbody>${body}</tbody><tfoot>${fuss1}${fuss2}</tfoot>
          </table></div>` : `<div class="leer">Keine Spieltage für diese Auswahl.</div>`}
        </div>`;
      return { stats, body: html };
    }

    _bindeSpiele() {
      const r = this._root;
      r.querySelectorAll("[data-sort]").forEach((b) => b.addEventListener("click", () => {
        const k = b.dataset.sort;
        if (this._listeSort.key === k) this._listeSort.ab = !this._listeSort.ab;
        else this._listeSort = { key: k, ab: true };
        this._renderMain();
      }));
      r.querySelectorAll("[data-jahr]").forEach((b) => b.addEventListener("click", () => {
        this._listeJahr = b.dataset.jahr; this._renderMain();
      }));
      r.querySelectorAll("[data-ort]").forEach((b) => b.addEventListener("click", () => {
        this._listeOrt = b.dataset.ort; this._renderMain();
      }));
      r.querySelectorAll("[data-auf]").forEach((b) => b.addEventListener("click", () => {
        const id = b.dataset.auf;
        this._aufgeklappt.has(id) ? this._aufgeklappt.delete(id) : this._aufgeklappt.add(id);
        this._renderMain();
      }));
      r.querySelectorAll("[data-edit]").forEach((b) => b.addEventListener("click", () => {
        const tag = (this._spieltage || []).find((t) => t.id === b.dataset.edit);
        if (tag) this._oeffneForm(tag);
      }));
      const zb = r.querySelector("#zeiten");
      if (zb) zb.addEventListener("click", () => this._oeffneZeiten());
      const end = r.querySelector("#endstand");
      if (end) end.addEventListener("click", () => { this._zeigeEndstand = !this._zeigeEndstand; this._renderMain(); });
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
      if (this._seite !== "uebersicht") this._renderMain();
    }

    async _ladeSessions() {
      this._laedtS = true;
      const sig = this._sig;
      try {
        const res = await this._hass.callWS({
          type: "call_service", domain: "poker_home_games", service: "sessions_abrufen",
          service_data: {}, return_response: true,
        });
        this._sessions = (res && res.response && res.response.sessions) || [];
        this._ladeFehlerS = "";
      } catch (err) {
        this._ladeFehlerS = "Eigene Sessions konnten nicht geladen werden: " + ((err && err.message) || err);
      }
      this._sessionsSig = sig;
      this._laedtS = false;
      if (this._seite === "ich") this._renderMain();
    }

    // ------------------------------------------------------------ Meine Spiele
    _ichId(d) {
      const ich = String(this._config.ich || "").trim().toLowerCase();
      if (!ich) return null;
      const sp = d.spieler.find((s) => s.id === ich || s.name.toLowerCase() === ich);
      return sp ? sp.id : null;
    }

    _arten() {
      return {
        runde: { label: this._config.title, farbe: C.gold },
        casino: { label: "Casino", farbe: C.violet },
        home_game: { label: "Home Game", farbe: C.cyan },
        online: { label: "Online", farbe: C.green },
        sonstiges: { label: "Sonstiges", farbe: "#cbd5e1" },
      };
    }

    _ichEintraege(ich) {
      const runde = (this._spieltage || []).filter((t) => t.ergebnisse.some((e) => e.spieler === ich)).map((t) => {
        const e = t.ergebnisse.find((x) => x.spieler === ich);
        return { quelle: "runde", id: t.id, datum: t.datum, ende_datum: t.ende_datum, beginn: t.beginn, ende: t.ende, dauer: t.dauer_h, art: "runde", spielart: "cash",
          blinds: t.blinds || "", ort: t.ort || "", einsatz: e.einsatz, gewinn: e.gewinn, notiz: t.bezeichnung || "", tag: t };
      });
      const eigene = (this._sessions || []).map((x) => ({ quelle: "eigen", id: x.id, datum: x.datum, ende_datum: x.ende_datum, beginn: x.beginn, ende: x.ende, dauer: x.dauer_h,
        art: x.art, spielart: x.spielart, blinds: x.blinds || "", ort: x.ort || "", einsatz: x.einsatz, gewinn: x.gewinn, notiz: x.notiz || "", session: x }));
      return [...runde, ...eigene].sort((a, b) => (a.datum + (a.beginn || "")).localeCompare(b.datum + (b.beginn || "")));
    }

    _seiteIch(d) {
      const ich = this._ichId(d);
      if (!ich) return { stats: "", body: `<div class="card"><div class="leer">Spieler „${esc(this._config.ich)}“ gibt es in der Integration nicht. Prüfe <b>ich:</b> in der Kartenkonfiguration.</div></div>` };
      if (this._spieltageSig !== this._sig && !this._laedt) this._ladeSpieltage();
      if (this._sessionsSig !== this._sig && !this._laedtS) this._ladeSessions();
      if (!this._spieltage || !this._sessions) {
        const f = this._ladeFehler || this._ladeFehlerS;
        return { stats: "", body: `<div class="card"><div class="leer">${f ? esc(f) : "Lade deine Spiele …"}</div></div>` };
      }
      const ARTEN = this._arten();
      const alle = this._ichEintraege(ich);
      this._ichAlle = alle;
      const summe = (l, k) => l.reduce((a, x) => a + (x[k] || 0), 0);
      const mitZeit = alle.filter((x) => x.dauer);
      const stunden = summe(mitZeit, "dauer");
      const gesG = summe(alle, "gewinn"), gesE = summe(alle, "einsatz");
      const orteAnz = new Set(alle.map((x) => x.ort).filter(Boolean)).size;
      const stats = `
          ${this._tile("Bilanz", `<span style="color:${vz(gesG)}">${eurKurz(gesG)}</span>`, alle.length ? `Ø ${eur(gesG / alle.length)} pro Session` : "")}
          ${this._tile("Sessions", alle.length, `${orteAnz} ${orteAnz === 1 ? "Ort" : "Orte"}`)}
          ${this._tile("Spielzeit", stunden ? zahl(stunden, 1) + " h" : "–", stunden ? `${eur(summe(mitZeit, "gewinn") / stunden)}/h` : "keine Uhrzeiten")}
          ${this._tile("ROI", gesE ? zahl(((gesE + gesG) / gesE) * 100, 1) + " %" : "–", `${Math.round(gesE).toLocaleString("de-DE")} € eingesetzt`)}`;

      // Bilanz nach Art
      const proArt = Object.keys(ARTEN).map((k) => {
        const l = alle.filter((x) => x.art === k);
        const z = l.filter((x) => x.dauer);
        const h = summe(z, "dauer");
        return { k, n: l.length, g: summe(l, "gewinn"), e: summe(l, "einsatz"), ph: h ? summe(z, "gewinn") / h : null, plus: l.filter((x) => x.gewinn > 0).length };
      }).filter((x) => x.n);
      const mx = Math.max(1, ...proArt.map((x) => Math.abs(x.g)));
      const artZeilen = proArt.map((x) => {
        const w = Math.max(1.5, (Math.abs(x.g) / mx) * 50), pos = x.g >= 0, a = ARTEN[x.k];
        return `<div class="row">
          <div class="rz"><span class="dot" style="background:${a.farbe};box-shadow:0 0 8px ${a.farbe}88"></span>
            <div class="rn">${esc(a.label)}</div><div class="rg" style="color:${vz(x.g)}">${eur(x.g)}</div></div>
          <div class="bar"><b></b><i style="left:${pos ? 50 : 50 - w}%;width:${w}%;background:${pos ? C.green : C.red}"></i></div>
          <div class="rs"><span>${x.n} ${x.n === 1 ? "Session" : "Sessions"}</span><span>Ø ${eur(x.g / x.n)}</span>${x.ph != null ? `<span>${eur(x.ph)}/h</span>` : ""}<span>${Math.round((x.plus / x.n) * 100)} % im Plus</span></div>
        </div>`;
      }).join("");

      // Rekorde
      const best = alle.length ? alle.reduce((a, x) => (x.gewinn > a.gewinn ? x : a)) : null;
      const worst = alle.length ? alle.reduce((a, x) => (x.gewinn < a.gewinn ? x : a)) : null;
      const lang = mitZeit.length ? mitZeit.reduce((a, x) => (x.dauer > a.dauer ? x : a)) : null;
      const gruppe = (key) => {
        const m = new Map();
        alle.forEach((x) => { const k = x[key]; if (!k) return; const v = m.get(k) || { n: 0, g: 0 }; v.n++; v.g += x.gewinn; m.set(k, v); });
        return [...m.entries()];
      };
      const lieblingsort = gruppe("ort").sort((a, b) => b[1].n - a[1].n || b[1].g - a[1].g)[0];
      const besteBlinds = gruppe("blinds").sort((a, b) => b[1].g - a[1].g)[0];
      const plus = alle.filter((x) => x.gewinn > 0).length, minus = alle.filter((x) => x.gewinn < 0).length;
      const beschr = (x) => [`${WT[new Date(x.datum + "T12:00:00").getDay()]} ${datumDe(x.datum)}`, x.ort || ARTEN[x.art].label].map(esc).join(" · ");
      const rekorde = `<div class="rekorde r3">
        ${this._tile("Beste Session", best ? `<span style="color:${vz(best.gewinn)}">${eur(best.gewinn)}</span>` : "–", best ? beschr(best) : "")}
        ${this._tile("Schlechteste Session", worst ? `<span style="color:${vz(worst.gewinn)}">${eur(worst.gewinn)}</span>` : "–", worst ? beschr(worst) : "")}
        ${this._tile("Längste Session", lang ? zahl(lang.dauer, 1) + " h" : "–", lang ? beschr(lang) : "")}
        ${this._tile("Lieblingsort", lieblingsort ? esc(lieblingsort[0]) : "–", lieblingsort ? `${lieblingsort[1].n}× · ${eur(lieblingsort[1].g)}` : "Ort beim Eintragen angeben")}
        ${this._tile("Beste Blinds", besteBlinds ? esc(besteBlinds[0]) : "–", besteBlinds ? `${besteBlinds[1].n}× · ${eur(besteBlinds[1].g)}` : "Blinds beim Eintragen angeben")}
        ${this._tile("Siegquote", plus + minus ? Math.round((plus / (plus + minus)) * 100) + " %" : "–", `${plus} Plus · ${minus} Minus`)}
      </div>`;

      // Pro Jahr
      const jahreAlle = [...new Set(alle.map((x) => x.datum.slice(0, 4)))].sort().reverse();
      const proJahr = jahreAlle.map((j) => {
        const l = alle.filter((x) => x.datum.startsWith(j));
        return `<tr><td class="links">${j}</td><td class="num">${l.length}</td><td class="num">${Math.round(summe(l, "einsatz")).toLocaleString("de-DE")} €</td>
          <td class="num" style="color:${vz(summe(l, "gewinn"))};font-weight:700">${eur(summe(l, "gewinn"))}</td></tr>`;
      }).join("");

      // Liste mit Filtern
      let liste = alle.slice();
      if (this._ichArt !== "alle") liste = liste.filter((x) => x.art === this._ichArt);
      if (this._ichJahr !== "alle") liste = liste.filter((x) => x.datum.startsWith(this._ichJahr));
      if (this._ichBlinds !== "alle") liste = liste.filter((x) => x.blinds === this._ichBlinds);
      const { key, ab } = this._ichSort;
      const wert = { datum: (x) => x.datum + (x.beginn || ""), gewinn: (x) => x.gewinn, verlust: (x) => -x.gewinn, einsatz: (x) => x.einsatz, dauer: (x) => x.dauer }[key];
      liste.sort((a, b) => {
        const va = wert(a), vb = wert(b);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        const c = va < vb ? -1 : va > vb ? 1 : 0;
        return c ? (ab ? -c : c) : b.datum.localeCompare(a.datum);
      });
      const pf = (k) => (key === k ? (ab ? " ↓" : " ↑") : "");
      const sortBtn = (k, l) => `<button class="fc ${key === k ? "an" : ""}" data-isort="${k}" aria-pressed="${key === k}">${l}<span class="pf">${pf(k)}</span></button>`;
      const th = (k, l, cls = "") => `<th class="${cls}"><button class="${key === k ? "an" : ""}" data-isort="${k}">${l}${pf(k)}</button></th>`;
      const artenDa = Object.keys(ARTEN).filter((k) => alle.some((x) => x.art === k));
      const blindsDa = [...new Set(alle.map((x) => x.blinds).filter(Boolean))].sort((a, b) => a.localeCompare(b, "de", { numeric: true }));
      const zeilen = liste.map((x) => {
        const a = ARTEN[x.art];
        const zeit = zeitText(x.beginn, x.ende);
        const ph = x.dauer ? x.gewinn / x.dauer : null;
        return `<tr>
          <td>${datumBereich(x.datum, x.ende_datum)}${zeit ? `<span class="klein">${x.ende_datum ? `${x.beginn}–${x.ende}` : zeit}</span>` : ""}</td>
          <td><span class="art" style="color:${a.farbe};border-color:${a.farbe}66;background:${a.farbe}14">${esc(a.label)}</span>${x.art !== "runde" ? `<span class="klein">${x.spielart === "turnier" ? "Turnier" : "Cash Game"}</span>` : ""}</td>
          <td class="hm">${esc(x.ort) || "–"}${x.notiz ? `<span class="klein">${esc(x.notiz)}</span>` : ""}</td>
          <td>${esc(x.blinds) || "–"}</td>
          <td class="num hm">${x.dauer ? zahl(x.dauer, 1) + " h" : "–"}</td>
          <td class="num">${zahl(x.einsatz, 2)} €</td>
          <td class="num" style="color:${vz(x.gewinn)};font-weight:700">${eur(x.gewinn)}</td>
          <td class="num hm">${ph != null ? eur(ph) : "–"}</td>
          <td><button class="ed" data-iedit="${x.quelle}:${esc(x.id)}" aria-label="Bearbeiten" title="${x.quelle === "runde" ? "Spieltag der Runde bearbeiten" : "Session bearbeiten"}">✎</button></td>
        </tr>`;
      }).join("");
      const lz = liste.filter((x) => x.dauer), lh = summe(lz, "dauer");
      const fuss = liste.length ? `<tfoot><tr>
          <td>Summe</td><td>${liste.length} ${liste.length === 1 ? "Session" : "Sessions"}</td><td class="hm"></td><td></td>
          <td class="num hm">${lh ? zahl(lh, 1) + " h" : ""}</td>
          <td class="num">${zahl(summe(liste, "einsatz"), 2)} €</td>
          <td class="num" style="color:${vz(summe(liste, "gewinn"))}">${eur(summe(liste, "gewinn"))}</td>
          <td class="num hm">${lh ? eur(summe(lz, "gewinn") / lh) : ""}</td><td></td></tr></tfoot>` : "";

      const body = `
        <div class="grid ich">
          <div class="col">
            <div class="card"><div class="h">Nach Spielart</div>${artZeilen || '<div class="leer">Noch keine Sessions.</div>'}</div>
            <div class="card"><div class="h">Rekorde</div>${rekorde}</div>
          </div>
          <div class="col">
            <div class="card"><div class="h">Verlauf <small>Kontostand über alle Sessions</small></div><div class="chartbox" id="chartbox"></div></div>
            <div class="card"><div class="h">Pro Jahr</div>${proJahr ? `<table class="tbl"><thead><tr><th class="links">Jahr</th><th class="num">Sessions</th><th class="num">Einsatz</th><th class="num">Bilanz</th></tr></thead><tbody>${proJahr}</tbody></table>` : '<div class="leer">–</div>'}</div>
          </div>
        </div>
        <div class="card filter">
          <div class="frow"><div class="flab">Sortieren</div><div class="fchips">
            ${sortBtn("datum", "Datum")}${sortBtn("gewinn", "Gewinn")}${sortBtn("verlust", "Verlust")}${sortBtn("einsatz", "Einsatz")}${sortBtn("dauer", "Dauer")}
          </div></div>
          <div class="frow"><div class="flab">Art</div><div class="fchips">
            <button class="fc ${this._ichArt === "alle" ? "an" : ""}" data-iart="alle">Alle</button>
            ${artenDa.map((k) => `<button class="fc ${this._ichArt === k ? "an" : ""}" data-iart="${k}">${esc(ARTEN[k].label)}</button>`).join("")}
          </div></div>
          <div class="frow"><div class="flab">Jahr</div><div class="fchips">
            <button class="fc ${this._ichJahr === "alle" ? "an" : ""}" data-ijahr="alle">Alle</button>
            ${jahreAlle.map((j) => `<button class="fc ${this._ichJahr === j ? "an" : ""}" data-ijahr="${j}">${j}</button>`).join("")}
          </div></div>
          ${blindsDa.length ? `<div class="frow"><div class="flab">Blinds</div><div class="fchips">
            <button class="fc ${this._ichBlinds === "alle" ? "an" : ""}" data-iblinds="alle">Alle</button>
            ${blindsDa.map((b) => `<button class="fc ${this._ichBlinds === b ? "an" : ""}" data-iblinds="${esc(b)}">${esc(b)}</button>`).join("")}
          </div></div>` : ""}
        </div>
        <div class="card">
          <div class="h">Alle Sessions <span class="hr"><small>${liste.length} von ${alle.length}</small><button class="link edit" id="import">Aus App importieren</button></span></div>
          ${liste.length ? `<div class="scroll"><table class="tbl liste">
            <thead><tr>${th("datum", "Datum")}<th>Art</th><th class="hm">Ort</th><th>Blinds</th>${th("dauer", "Dauer", "num hm")}${th("einsatz", "Einsatz", "num")}${th(key === "verlust" ? "verlust" : "gewinn", key === "verlust" ? "Verlust" : "Gewinn", "num")}<th class="num hm">€/h</th><th></th></tr></thead>
            <tbody>${zeilen}</tbody>${fuss}</table></div>` : '<div class="leer">Keine Sessions für diese Auswahl.</div>'}
        </div>`;
      return { stats, body };
    }

    _bindeIch() {
      const r = this._root;
      r.querySelectorAll("[data-isort]").forEach((b) => b.addEventListener("click", () => {
        const k = b.dataset.isort;
        if (this._ichSort.key === k) this._ichSort.ab = !this._ichSort.ab;
        else this._ichSort = { key: k, ab: true };
        this._renderMain();
      }));
      r.querySelectorAll("[data-iart]").forEach((b) => b.addEventListener("click", () => { this._ichArt = b.dataset.iart; this._renderMain(); }));
      r.querySelectorAll("[data-ijahr]").forEach((b) => b.addEventListener("click", () => { this._ichJahr = b.dataset.ijahr; this._renderMain(); }));
      r.querySelectorAll("[data-iblinds]").forEach((b) => b.addEventListener("click", () => { this._ichBlinds = b.dataset.iblinds; this._renderMain(); }));
      r.querySelectorAll("[data-iedit]").forEach((b) => b.addEventListener("click", () => {
        const [quelle, id] = b.dataset.iedit.split(":");
        const x = (this._ichAlle || []).find((e) => e.quelle === quelle && e.id === id);
        if (!x) return;
        if (quelle === "runde") this._oeffneForm(x.tag);
        else this._oeffneSession(x.session);
      }));
      const imp = r.querySelector("#import");
      if (imp) imp.addEventListener("click", () => this._oeffneImport());
      const alle = this._ichAlle || [];
      if (alle.length) this._beobachteChart((w, h) => this._chartIch(alle, w, h));
    }

    _chartIch(alle, W, H) {
      if (alle.length < 2) return `<div class="leer">Der Verlauf erscheint ab der zweiten Session.</div>`;
      const ARTEN = this._arten();
      const L = 50, R = 16, T = 12, B = 24;
      let kum = 0;
      const pkt = alle.map((x) => ({ x, w: (kum = Math.round((kum + x.gewinn) * 100) / 100) }));
      let min = Math.min(0, ...pkt.map((p) => p.w)), max = Math.max(0, ...pkt.map((p) => p.w));
      const pad = (max - min) * 0.08 || 10; min -= pad; max += pad;
      const px = (i) => L + (i / (pkt.length - 1)) * (W - L - R);
      const py = (w) => T + (1 - (w - min) / (max - min)) * (H - T - B);
      const zeilenMax = Math.max(3, Math.min(7, Math.floor(H / 45)));
      const schritt = [50, 100, 200, 250, 500, 1000, 2000, 5000].find((s) => (max - min) / s <= zeilenMax) || 10000;
      let grid = "";
      for (let g = Math.ceil(min / schritt) * schritt; g <= max; g += schritt) {
        grid += `<line x1="${L}" x2="${W - R}" y1="${py(g)}" y2="${py(g)}" stroke="rgba(255,255,255,${g === 0 ? 0.28 : 0.06})" ${g === 0 ? 'stroke-dasharray="4 4"' : ""}/>
          <text x="${L - 8}" y="${py(g) + 4}" text-anchor="end" font-size="11" fill="${C.muted}">${(g || 0).toLocaleString("de-DE")}</text>`;
      }
      let jahre = "", lj = "", lx = -99;
      pkt.forEach((p, i) => {
        const j = p.x.datum.slice(0, 4);
        if (j !== lj && px(i) - lx >= 34) { lj = j; lx = px(i); jahre += `<text x="${px(i) + 2}" y="${H - 7}" font-size="11" fill="${C.muted}">${j}</text>`; }
      });
      const pfad = pkt.map((p, i) => `${i ? "L" : "M"}${px(i).toFixed(1)},${py(p.w).toFixed(1)}`).join("");
      const flaeche = `${pfad}L${px(pkt.length - 1).toFixed(1)},${py(0).toFixed(1)}L${px(0).toFixed(1)},${py(0).toFixed(1)}Z`;
      const r = pkt.length > 120 ? 2 : 3;
      const punkte = pkt.map((p, i) => `<circle cx="${px(i).toFixed(1)}" cy="${py(p.w).toFixed(1)}" r="${r}" fill="${ARTEN[p.x.art].farbe}"><title>${datumDe(p.x.datum)} · ${esc(ARTEN[p.x.art].label)} · ${eur(p.x.gewinn)}</title></circle>`).join("");
      const leg = Object.keys(ARTEN).filter((k) => alle.some((x) => x.art === k)).map((k, i) =>
        `<g transform="translate(${L + 4 + i * 110},${T + 4})"><circle r="4" cx="4" cy="0" fill="${ARTEN[k].farbe}"/><text x="13" y="4" font-size="11" fill="${C.muted}">${esc(ARTEN[k].label)}</text></g>`).join("");
      return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block" role="img" aria-label="Kumulierter Gewinn über alle eigenen Sessions">
        <defs><linearGradient id="gi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.gold}" stop-opacity="0.22"/><stop offset="1" stop-color="${C.gold}" stop-opacity="0"/></linearGradient></defs>
        ${grid}${jahre}<path d="${flaeche}" fill="url(#gi)"/>
        <path d="${pfad}" fill="none" stroke="${C.gold}" stroke-width="2.4" stroke-linejoin="round" style="filter:drop-shadow(0 0 5px ${C.gold}99)"/>
        ${punkte}${leg}</svg>`;
    }

    // ------------------------------------------------------------ Session-Dialog
    _oeffneSession(x = null) {
      const jetzt = heute();
      const eig = this._sessions || [];
      const letzte = eig.length ? eig[eig.length - 1] : null;
      const d = this._daten() || { orte: [] };
      const alsText = (v) => String(Math.round(v * 100) / 100).replace(".", ",");
      const orte = [...new Set([...eig.map((e) => e.ort), ...(d.orte || [])].filter(Boolean))];
      const blinds = [...new Set([...eig.map((e) => e.blinds), ...(this._spieltage || []).map((t) => t.blinds)].filter(Boolean))];
      this._form = null;
      this._sform = x
        ? { id: x.id, datum: x.datum, ende_datum: x.ende_datum || "", beginn: x.beginn || "", ende: x.ende || "", art: x.art, spielart: x.spielart, blinds: x.blinds || "", ort: x.ort || "",
            einsatz: alsText(x.einsatz), gewinn: x.gewinn ? alsText(x.gewinn) : "", notiz: x.notiz || "", orte, blindsListe: blinds, fehler: "", busy: false }
        : { id: null, datum: jetzt.datum, ende_datum: "", beginn: "", ende: "", art: letzte ? letzte.art : "casino", spielart: letzte ? letzte.spielart : "cash",
            blinds: letzte ? letzte.blinds : "", ort: letzte ? letzte.ort : "", einsatz: "", gewinn: "", notiz: "", orte, blindsListe: blinds, fehler: "", busy: false };
      this._renderSession();
    }

    _renderSession() {
      const f = this._sform;
      if (!f) return;
      const ARTEN = this._arten();
      const artChips = ["casino", "home_game", "online", "sonstiges"].map((k) =>
        `<button class="chip ${f.art === k ? "an" : ""}" data-sart="${k}" aria-pressed="${f.art === k}">${ARTEN[k].label}</button>`).join("");
      const spChips = [["cash", "Cash Game"], ["turnier", "Turnier"]].map(([k, l]) =>
        `<button class="chip ${f.spielart === k ? "an" : ""}" data-sspiel="${k}" aria-pressed="${f.spielart === k}">${l}</button>`).join("");
      this._modal.innerHTML = `
        <div class="overlay" id="ov">
          <div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dt">
            <h2 id="dt">${f.id ? "Session bearbeiten" : "Session eintragen"}</h2>
            <div class="sub">Für Spiele außerhalb der Runde. Gewinn = Endstand minus Einsatz.</div>
            <div class="f5">
              <label class="fl">Datum<input type="date" id="s-datum" value="${f.datum}"></label>
              <label class="fl"><span>Enddatum <span class="opt">optional</span></span><input type="date" id="s-endedatum" value="${f.ende_datum}" min="${f.datum}"></label>
              <label class="fl">Beginn<input type="time" id="s-beginn" value="${f.beginn}"></label>
              <label class="fl">Ende<input type="time" id="s-ende" value="${f.ende}"></label>
            </div>
            <div class="hint" id="s-mn">${zeitHinweis(f.datum, f.ende_datum, f.beginn, f.ende)}</div>
            <div class="sec"><span>Art</span></div>
            <div class="chips">${artChips}</div>
            <div class="chips" style="margin-top:8px">${spChips}</div>
            <div class="f2">
              <label class="fl">Ort<input id="s-ort" list="s-orte" value="${esc(f.ort)}" placeholder="z. B. Spielbank Duisburg" autocomplete="off"></label>
              <label class="fl">Blinds<input id="s-blinds" list="s-blindsl" value="${esc(f.blinds)}" placeholder="z. B. 1/2" autocomplete="off"></label>
            </div>
            <datalist id="s-orte">${f.orte.map((o) => `<option value="${esc(o)}"></option>`).join("")}</datalist>
            <datalist id="s-blindsl">${f.blindsListe.map((o) => `<option value="${esc(o)}"></option>`).join("")}</datalist>
            <div class="f2">
              <label class="fl">Einsatz € (inkl. Rebuys)<input id="s-einsatz" inputmode="decimal" value="${esc(f.einsatz)}" placeholder="0"></label>
              <label class="fl">Gewinn €<div class="gw"><button class="pm" id="s-pm" aria-label="Vorzeichen umschalten">±</button><input id="s-gewinn" inputmode="decimal" value="${esc(f.gewinn)}" placeholder="0"></div></label>
            </div>
            <label class="fl" style="margin-top:10px">Notiz (optional)<input id="s-notiz" value="${esc(f.notiz)}" placeholder="z. B. Turniername, Tischbesonderheiten"></label>
            <div id="s-info"></div>
            <div class="msg" id="msg">${esc(f.fehler)}</div>
            <div class="fuss">
              ${f.id ? '<button class="btn rot" id="s-loeschen">Löschen</button><span style="flex:1"></span>' : ""}
              <button class="btn" id="abbr">Abbrechen</button>
              <button class="btn gold" id="s-speichern" ${f.busy ? "disabled" : ""}>${f.id ? "Änderungen speichern" : "Session speichern"}</button>
            </div>
          </div>
        </div>`;
      const $ = (q) => this._modal.querySelector(q);
      const schliessen = () => { this._sform = null; this._modal.innerHTML = ""; };
      $("#ov").addEventListener("click", (ev) => { if (ev.target.id === "ov" && !f.busy) schliessen(); });
      $("#abbr").addEventListener("click", schliessen);
      [["#s-datum", "datum"], ["#s-endedatum", "ende_datum"], ["#s-beginn", "beginn"], ["#s-ende", "ende"], ["#s-ort", "ort"], ["#s-blinds", "blinds"], ["#s-notiz", "notiz"]].forEach(([q, k]) =>
        $(q).addEventListener("input", (ev) => { f[k] = ev.target.value; this._sessionInfo(); $("#s-mn").innerHTML = zeitHinweis(f.datum, f.ende_datum, f.beginn, f.ende); }));
      $("#s-einsatz").addEventListener("input", (ev) => { f.einsatz = ev.target.value; this._sessionInfo(); });
      $("#s-gewinn").addEventListener("input", (ev) => { f.gewinn = ev.target.value; this._sessionInfo(); });
      $("#s-pm").addEventListener("click", () => {
        const t = f.gewinn.trim();
        f.gewinn = t.startsWith("-") ? t.slice(1) : "-" + t;
        $("#s-gewinn").value = f.gewinn; this._sessionInfo();
      });
      this._modal.querySelectorAll("[data-sart]").forEach((b) => b.addEventListener("click", () => { f.art = b.dataset.sart; this._renderSession(); }));
      this._modal.querySelectorAll("[data-sspiel]").forEach((b) => b.addEventListener("click", () => { f.spielart = b.dataset.sspiel; this._renderSession(); }));
      $("#s-speichern").addEventListener("click", () => this._speichereSession());
      if (f.id) $("#s-loeschen").addEventListener("click", () => this._loescheSession());
      this._sessionInfo();
    }

    _oeffneImport() {
      this._form = null; this._sform = null;
      this._modal.innerHTML = `
        <div class="overlay" id="ov">
          <div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dt">
            <h2 id="dt">Sessions aus App importieren</h2>
            <div class="sub">Export deiner Poker-Tracking-App inklusive Kopfzeile hier einfügen (Spalten wie id, starttime, endtime, location, type, cashout, totalprofit). Bereits importierte Sessions werden anhand der id übersprungen – du kannst also jederzeit den kompletten Export erneut einfügen.</div>
            <textarea id="imp-text" rows="10" spellcheck="false" placeholder="id&#9;starttime&#9;endtime&#9;…"></textarea>
            <div class="sub" style="margin:8px 0 0">Einsatz wird als Cashout minus Ergebnis berechnet und enthält damit auch Rebuys.</div>
            <div id="imp-info"></div>
            <div class="msg" id="msg"></div>
            <div class="fuss">
              <button class="btn" id="abbr">Abbrechen</button>
              <button class="btn gold" id="imp-los">Importieren</button>
            </div>
          </div>
        </div>`;
      const $ = (q) => this._modal.querySelector(q);
      const zu = () => { this._modal.innerHTML = ""; };
      $("#ov").addEventListener("click", (ev) => { if (ev.target.id === "ov") zu(); });
      $("#abbr").addEventListener("click", zu);
      const ta = $("#imp-text");
      ta.addEventListener("input", () => {
        const n = ta.value.split("\n").filter((z) => z.trim()).length - 1;
        $("#imp-info").innerHTML = n > 0 ? `<div class="sub" style="margin:8px 0 0">${n} ${n === 1 ? "Zeile" : "Zeilen"} erkannt</div>` : "";
        $("#msg").textContent = "";
      });
      $("#imp-los").addEventListener("click", async () => {
        const btn = $("#imp-los");
        if (btn.dataset.fertig) return zu();
        if (!ta.value.trim()) { $("#msg").textContent = "Bitte zuerst den Export einfügen."; return; }
        btn.disabled = true; btn.textContent = "Importiert …";
        try {
          const res = await this._hass.callWS({ type: "call_service", domain: "poker_home_games", service: "sessions_importieren",
            service_data: { text: ta.value }, return_response: true });
          const r = (res && res.response) || {};
          const f = r.fehler || [];
          $("#imp-info").innerHTML = `<div class="summe ${f.length ? "nok" : "ok"}"><div><b>${r.importiert || 0} ${r.importiert === 1 ? "Session" : "Sessions"} importiert</b>
            <div style="font-size:12px;color:${C.muted};margin-top:2px">${r.uebersprungen || 0} schon vorhanden${f.length ? ` · ${f.length} Zeilen mit Fehlern: ${esc(f.slice(0, 3).join("; "))}${f.length > 3 ? " …" : ""}` : ""}</div></div></div>`;
          btn.disabled = false; btn.textContent = "Fertig"; btn.dataset.fertig = "1";
          $("#abbr").style.display = "none";
          if (r.importiert) this._toast(`${r.importiert} Sessions importiert`);
        } catch (err) {
          btn.disabled = false; btn.textContent = "Importieren";
          $("#msg").textContent = (err && err.message) || "Import fehlgeschlagen.";
        }
      });
      setTimeout(() => ta.focus(), 50);
    }

    // ------------------------------------------------------------ Uhrzeiten nachtragen
    _oeffneZeiten() {
      const ohne = (this._spieltage || []).filter((t) => (!t.beginn || !t.ende) && !(t.tage && t.tage.length))
        .sort((a, b) => b.datum.localeCompare(a.datum));
      this._form = null; this._sform = null;
      this._zform = {
        vb: "19:30", ve: "01:00", fehler: "",
        rows: ohne.map((t) => ({ id: t.id, datum: t.datum, info: [t.ort, t.bezeichnung].filter(Boolean).join(" · "),
          n: t.ergebnisse.length, beginn: t.beginn || "", ende: t.ende || "" })),
      };
      this._renderZeiten();
    }

    _renderZeiten() {
      const z = this._zform;
      const wt = (iso) => WT[new Date(iso + "T12:00:00").getDay()];
      const zeilen = z.rows.map((r, i) => `
        <div class="zr" data-zi="${i}">
          <div class="zd"><b>${wt(r.datum)} ${datumDe(r.datum)}</b><span>${esc(r.info || `${r.n} Spieler`)}</span></div>
          <input type="time" data-zb="${i}" value="${r.beginn}" aria-label="Beginn ${datumDe(r.datum)}">
          <input type="time" data-ze="${i}" value="${r.ende}" aria-label="Ende ${datumDe(r.datum)}">
          <div class="zh" id="zh-${i}">${r.beginn && r.ende ? mitternachtHinweis("", r.beginn, r.ende).replace("<b>Ende am Folgetag</b> · ", "+1 · ") : ""}</div>
        </div>`).join("");
      this._modal.innerHTML = `
        <div class="overlay" id="ov">
          <div class="dlg breit" role="dialog" aria-modal="true" aria-labelledby="dt">
            <h2 id="dt">Uhrzeiten nachtragen</h2>
            <div class="sub">${z.rows.length} Spieltage ohne Uhrzeit, neueste zuerst. Ende vor Beginn heißt: nach Mitternacht.</div>
            <div class="vorlage">
              <span>Vorlage</span>
              <input type="time" id="z-vb" value="${z.vb}" aria-label="Vorlage Beginn">
              <input type="time" id="z-ve" value="${z.ve}" aria-label="Vorlage Ende">
              <button class="btn" id="z-fuellen">In alle leeren Felder</button>
            </div>
            <div class="zliste">${zeilen}</div>
            <div class="msg" id="msg">${esc(z.fehler)}</div>
            <div class="fuss">
              <span class="zstand" id="z-stand"></span><span style="flex:1"></span>
              <button class="btn" id="abbr">Abbrechen</button>
              <button class="btn gold" id="z-speichern">Speichern</button>
            </div>
          </div>
        </div>`;
      const $ = (q) => this._modal.querySelector(q);
      const zu = () => { this._zform = null; this._modal.innerHTML = ""; };
      const stand = () => {
        const voll = z.rows.filter((r) => r.beginn && r.ende).length;
        $("#z-stand").textContent = `${voll} von ${z.rows.length} ausgefüllt`;
      };
      const hinweis = (i) => {
        const r = z.rows[i];
        $(`#zh-${i}`).innerHTML = r.beginn && r.ende ? mitternachtHinweis("", r.beginn, r.ende).replace("<b>Ende am Folgetag</b> · ", "+1 · ") : "";
      };
      $("#ov").addEventListener("click", (ev) => { if (ev.target.id === "ov") zu(); });
      $("#abbr").addEventListener("click", zu);
      $("#z-vb").addEventListener("input", (ev) => (z.vb = ev.target.value));
      $("#z-ve").addEventListener("input", (ev) => (z.ve = ev.target.value));
      this._modal.querySelectorAll("[data-zb]").forEach((inp) => inp.addEventListener("input", () => {
        const i = +inp.dataset.zb; z.rows[i].beginn = inp.value; hinweis(i); stand(); $("#msg").textContent = "";
      }));
      this._modal.querySelectorAll("[data-ze]").forEach((inp) => inp.addEventListener("input", () => {
        const i = +inp.dataset.ze; z.rows[i].ende = inp.value; hinweis(i); stand(); $("#msg").textContent = "";
      }));
      $("#z-fuellen").addEventListener("click", () => {
        z.rows.forEach((r, i) => {
          if (!r.beginn && z.vb) { r.beginn = z.vb; this._modal.querySelector(`[data-zb="${i}"]`).value = z.vb; }
          if (!r.ende && z.ve) { r.ende = z.ve; this._modal.querySelector(`[data-ze="${i}"]`).value = z.ve; }
          hinweis(i);
        });
        stand();
        $("#msg").textContent = "";
      });
      $("#z-speichern").addEventListener("click", async () => {
        const halb = z.rows.find((r) => !!r.beginn !== !!r.ende);
        if (halb) { $("#msg").textContent = `${datumDe(halb.datum)}: bitte Beginn und Ende angeben oder beide leer lassen.`; return; }
        const zeiten = z.rows.filter((r) => r.beginn && r.ende).map((r) => ({ id: r.id, beginn: r.beginn, ende: r.ende }));
        if (!zeiten.length) { $("#msg").textContent = "Noch keine Uhrzeit eingetragen."; return; }
        const btn = $("#z-speichern"); btn.disabled = true; btn.textContent = "Speichert …";
        try {
          await this._hass.callService("poker_home_games", "zeiten_setzen", { zeiten });
          zu();
          this._toast(`Uhrzeiten für ${zeiten.length} Spieltage gespeichert`);
        } catch (err) {
          btn.disabled = false; btn.textContent = "Speichern";
          $("#msg").textContent = (err && err.message) || "Speichern fehlgeschlagen.";
        }
      });
      stand();
    }

    _sessionInfo() {
      const f = this._sform;
      const box = this._modal.querySelector("#s-info");
      if (!f || !box) return;
      if (f.fehler) { f.fehler = ""; const m = this._modal.querySelector("#msg"); if (m) m.textContent = ""; }
      const e = parse(f.einsatz), g = parse(f.gewinn) ?? 0;
      if (e == null || Number.isNaN(e) || Number.isNaN(g)) { box.innerHTML = ""; return; }
      const dauer = f.beginn && f.ende ? (() => {
        const [bh, bm] = f.beginn.split(":").map(Number), [eh, em] = f.ende.split(":").map(Number);
        if (f.ende_datum && f.datum && f.ende_datum > f.datum) {
          const h = (tageZwischen(f.datum, f.ende_datum) * 1440 + eh * 60 + em - (bh * 60 + bm)) / 60;
          return h > 0 && h <= 36 ? h : null;
        }
        let m = eh * 60 + em - (bh * 60 + bm); if (m <= 0) m += 1440; return m / 60;
      })() : null;
      const ok = g >= -e;
      box.innerHTML = `<div class="summe ${ok ? "ok" : "nok"}"><div><b>Endstand ${zahl(e + g, 2)} €</b>
        <div style="font-size:12px;color:${C.muted};margin-top:2px">${ok ? `Ergebnis ${eur(g)}${dauer ? ` · ${zahl(dauer, 1)} h · ${eur(g / dauer)}/h` : ""}` : "Der Verlust ist größer als der Einsatz."}</div></div></div>`;
    }

    async _speichereSession() {
      const f = this._sform;
      if (!f || f.busy) return;
      const fehler = (t) => { f.fehler = t; const m = this._modal.querySelector("#msg"); if (m) m.textContent = t; };
      const e = parse(f.einsatz), g = parse(f.gewinn) ?? 0;
      if (!f.datum) return fehler("Bitte ein Datum angeben.");
      if (e == null || Number.isNaN(e) || e < 0) return fehler("Bitte einen Einsatz angeben (0 für Freerolls).");
      if (Number.isNaN(g)) return fehler("Der Gewinn ist keine Zahl.");
      if (g < -e) return fehler("Der Verlust ist größer als der Einsatz.");
      if (f.ende_datum && f.ende_datum < f.datum) return fehler("Das Enddatum liegt vor dem Startdatum.");
      const daten = { datum: f.datum, art: f.art, spielart: f.spielart, blinds: f.blinds.trim(), ort: f.ort.trim(), einsatz: e, gewinn: g, notiz: f.notiz.trim() };
      if (f.ende_datum && f.ende_datum > f.datum) daten.ende_datum = f.ende_datum;
      if (f.beginn) daten.beginn = f.beginn;
      if (f.ende) daten.ende = f.ende;
      if (f.id) daten.id = f.id;
      f.busy = true;
      const btn = this._modal.querySelector("#s-speichern");
      if (btn) { btn.disabled = true; btn.textContent = "Speichert …"; }
      try {
        await this._hass.callService("poker_home_games", f.id ? "session_bearbeiten" : "session_eintragen", daten);
        const bearbeitet = !!f.id;
        this._sform = null; this._modal.innerHTML = "";
        this._toast(bearbeitet ? "Session geändert" : "Session gespeichert");
      } catch (err) {
        f.busy = false;
        if (btn) { btn.disabled = false; btn.textContent = f.id ? "Änderungen speichern" : "Session speichern"; }
        fehler((err && err.message) || "Speichern fehlgeschlagen.");
      }
    }

    async _loescheSession() {
      const f = this._sform;
      if (!f || !f.id) return;
      if (!window.confirm(`Session vom ${datumDe(f.datum)} wirklich löschen?`)) return;
      try {
        await this._hass.callService("poker_home_games", "session_loeschen", { id: f.id });
        this._sform = null; this._modal.innerHTML = "";
        this._toast("Session gelöscht");
      } catch (err) {
        f.fehler = (err && err.message) || "Löschen fehlgeschlagen.";
        const m = this._modal.querySelector("#msg"); if (m) m.textContent = f.fehler;
      }
    }

    _tile(l, v, s) {
      return `<div class="tile"><div class="tl">${l}</div><div class="tv">${v}</div><div class="ts">${s || "&nbsp;"}</div></div>`;
    }

    _podium(d) {
      const orte = Object.keys(d.nachOrt || {}).sort((a, b) => a.localeCompare(b, "de"));
      let modus = this._podiumModus;
      if (modus === "ort" && !orte.length) modus = "gesamt";
      const ort = modus === "ort" ? (orte.includes(this._podiumOrt) ? this._podiumOrt : orte[0]) : null;
      const MIN = 5;
      let liste = [], wert, info;
      if (modus === "gesamt") {
        liste = d.rangliste.slice();
        wert = (x) => eur(x.gewinn);
        info = (x) => `${x.spiele} Spiele<span class="roi"> · ROI ${zahl(x.roi, 1)} %</span>`;
      } else if (modus === "schnitt") {
        liste = d.rangliste.filter((x) => x.spiele >= MIN).sort((a, b) => b.gewinn_avg - a.gewinn_avg);
        wert = (x) => eur(x.gewinn_avg);
        info = (x) => `pro Spiel · ${x.spiele} Spiele`;
      } else {
        liste = (d.nachOrt[ort] || []).slice();
        wert = (x) => eur(x.gewinn);
        info = (x) => `${x.spiele} ${x.spiele === 1 ? "Spiel" : "Spiele"} hier`;
      }
      const farbe = [C.gold, "#cfd6e0", "#d08a55"];
      const zahlwert = (x) => (modus === "schnitt" ? x.gewinn_avg : x.gewinn);
      const platz = (i) => {
        const x = liste[i];
        if (!x) return "<div></div>";
        return `<div class="platz p${i + 1}">
          <div class="nr" style="color:${farbe[i]}">${i + 1}</div>
          ${i === 0 ? '<div class="krone">♛</div>' : ""}
          <div class="av" style="background:${farbe[i]}">${esc(x.name.slice(0, 1).toUpperCase())}</div>
          <div class="n">${esc(x.name)}</div>
          <div class="g" style="color:${vz(zahlwert(x))}">${wert(x)}</div>
          <div class="s">${info(x)}</div>
        </div>`;
      };
      const seg = (k, l) => `<button class="sg ${modus === k ? "an" : ""}" data-podium="${k}" aria-pressed="${modus === k}">${l}</button>`;
      const ortWahl = modus === "ort"
        ? `<select class="ortwahl" id="podium-ort" aria-label="Spielort">${orte.map((o) => `<option value="${esc(o)}" ${o === ort ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`
        : "";
      const kopf = `<div class="h">Podium <span class="segs">${seg("gesamt", "Gesamt")}${seg("schnitt", "Ø pro Spiel")}${orte.length ? seg("ort", "Nach Ort") : ""}${ortWahl}</span></div>`;
      if (!liste.length) {
        return `${kopf}<div class="leer">${modus === "schnitt" ? `Noch niemand mit mindestens ${MIN} Spielen.` : "Noch keine Ergebnisse."}</div>`;
      }
      return `${kopf}<div class="podium">${platz(1)}${platz(0)}${platz(2)}</div>`;
    }

    _tabellenDaten(d) {
      const jahre = Object.keys(d.nachJahr || {}).sort().reverse();
      const jahr = this._tabJahr !== "gesamt" && jahre.includes(this._tabJahr) ? this._tabJahr : "gesamt";
      if (jahr === "gesamt") return { jahr, jahre, liste: d.rangliste, spieltage: d.spieltage };
      const j = d.nachJahr[jahr];
      return { jahr, jahre, liste: j.rangliste || [], spieltage: j.spieltage || 0 };
    }

    _tabelleKopf(d) {
      const t = this._tabellenDaten(d);
      const wahl = t.jahre.length
        ? `<select class="ortwahl" id="tab-jahr" aria-label="Zeitraum der Tabelle">
            <option value="gesamt" ${t.jahr === "gesamt" ? "selected" : ""}>Gesamt</option>
            ${t.jahre.map((j) => `<option value="${j}" ${t.jahr === j ? "selected" : ""}>${j}</option>`).join("")}
          </select>`
        : "";
      const titel = t.jahr === "gesamt" ? "Ewige Tabelle" : `Tabelle ${t.jahr}`;
      return `<div class="h">${titel} <span class="segs"><small>${t.liste.length} Spieler · ${t.spieltage} Spieltage</small>${wahl}</span></div>`;
    }

    _tendenz(x) {
      if (x.neu) return `<span class="tend neu" title="vor drei Spieltagen noch nicht in der Tabelle">neu</span>`;
      if (x.tendenz == null) return `<span class="tend leer"></span>`;
      if (x.tendenz > 0) return `<span class="tend auf" title="${x.tendenz} ${x.tendenz === 1 ? "Platz" : "Plätze"} gewonnen in den letzten drei Spieltagen">▲${x.tendenz}</span>`;
      if (x.tendenz < 0) return `<span class="tend ab" title="${-x.tendenz} ${x.tendenz === -1 ? "Platz" : "Plätze"} verloren in den letzten drei Spieltagen">▼${-x.tendenz}</span>`;
      return `<span class="tend gleich" title="unverändert in den letzten drei Spieltagen">●</span>`;
    }

    _tabelle(d) {
      const t = this._tabellenDaten(d);
      const liste = t.liste;
      if (!liste.length) return `<div class="leer">Trag den ersten Spieltag ein, dann erscheint hier die Tabelle.</div>`;
      const mx = Math.max(1, ...liste.map((x) => Math.abs(x.gewinn)));
      return liste.map((x) => {
        const w = Math.max(1.5, (Math.abs(x.gewinn) / mx) * 50);
        const pos = x.gewinn >= 0;
        const proStd = x.gewinn_pro_stunde != null ? `<span>${eur(x.gewinn_pro_stunde)}/h</span>` : "";
        return `<div class="row">
          <div class="rz">
            <div class="rnr">${x.platz}</div>
            ${this._tendenz(x)}
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
      const kopf = [l.ende_datum ? datumBereich(l.datum, l.ende_datum) : `${WT[new Date(l.datum + "T12:00:00").getDay()]} ${datumDe(l.datum)}`, l.ort, l.bezeichnung].filter(Boolean).join(" · ");
      const maxG = Math.max(...l.ergebnisse.map((e) => e.gewinn));
      const zeilen = l.ergebnisse.map((e) => `<tr class="${e.gewinn === maxG && maxG > 0 ? "sieg" : ""}">
          <td class="links n">${esc(e.name)}</td>
          <td class="num ein">${zahl(e.einsatz, 2)}</td>
          <td class="num ein">${zahl(e.endstand, 2)}</td>
          <td class="num g" style="color:${vz(e.gewinn)}">${eur(e.gewinn).replace(" €", "")}</td></tr>`).join("");
      const stat = (label, wert, sub = "") => `<div class="ls"><div class="lsl">${label}</div><div class="lsv">${wert}</div>${sub ? `<div class="lss">${sub}</div>` : ""}</div>`;
      const stats = [
        stat("Topf", `${zahl(l.topf, 0)} €`, `Ø ${zahl(l.topf / l.ergebnisse.length, 0)} € p. P.`),
        stat("Spieler", l.ergebnisse.length, `${l.ergebnisse.filter((e) => e.gewinn > 0).length} im Plus`),
        stat("Dauer", l.dauer_h ? `${zahl(l.dauer_h, 1)} h` : "–", l.tage && l.tage.length ? `an ${l.tage.length} Tagen` : l.ende_datum ? `${tageZwischen(l.datum, l.ende_datum) + 1} Tage` : zeitText(l.beginn, l.ende) || "keine Uhrzeit"),
        stat("Blinds", l.blinds ? esc(l.blinds) : "–", sieger(l)),
      ].join("");
      function sieger(t) {
        const s = t.ergebnisse[0];
        return s && s.gewinn > 0 ? `♛ ${esc(s.name)}` : "";
      }
      return `<div class="h">Letzter Spieltag <span class="hr"><small>${esc(kopf)}</small></span></div>
        <div class="ltab-wrap"><table class="ltab">
          <thead><tr><th class="links">Spieler</th><th class="num">Einsatz</th><th class="num">Endstand</th><th class="num">Gewinn</th></tr></thead>
          <tbody>${zeilen}</tbody>
        </table></div>
        <div class="lstats">${stats}</div>
        <div class="aktionen"><button class="link edit" id="bearbeiten">Bearbeiten</button><button class="link" id="loeschen">Löschen</button></div>`;
    }

    _chart(d, W = 640, H = 260) {
      const v = d.verlauf;
      if (v.length < 2) return `<div class="leer">Der Verlauf erscheint ab dem zweiten Spieltag.</div>`;
      const L = 46, R = 92, T = 10, B = 24;
      const spieler = d.rangliste.map((x) => x.id);
      const namen = Object.fromEntries(d.rangliste.map((x) => [x.id, x.name]));
      let min = 0, max = 0;
      v.forEach((p) => spieler.forEach((id) => { const w = p.werte[id]; if (w != null) { min = Math.min(min, w); max = Math.max(max, w); } }));
      const pad = (max - min) * 0.06 || 10; min -= pad; max += pad;
      const x = (i) => L + (i / (v.length - 1)) * (W - L - R);
      const y = (w) => T + (1 - (w - min) / (max - min)) * (H - T - B);
      // Raster
      const zeilenMax = Math.max(3, Math.min(7, Math.floor(H / 45)));
      const schritt = [50, 100, 200, 250, 500, 1000, 2000].find((s) => (max - min) / s <= zeilenMax) || 5000;
      let grid = "";
      for (let g = Math.ceil(min / schritt) * schritt; g <= max; g += schritt) {
        grid += `<line x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}" stroke="rgba(255,255,255,${g === 0 ? 0.28 : 0.06})" ${g === 0 ? 'stroke-dasharray="4 4"' : ""}/>
          <text x="${L - 8}" y="${y(g) + 4}" text-anchor="end" font-size="11" fill="${C.muted}">${(g || 0).toLocaleString("de-DE")}</text>`;
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
      return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block" role="img" aria-label="Kumulierter Gewinn je Spieler über alle Spieltage">${grid}${jahre}${linien}${labels}</svg>`;
    }

    _rekorde(d) {
      const r = d.rangliste;
      if (!r.length) return `<div class="leer">Noch keine Rekorde.</div>`;
      const g = d.rekordeG || {};
      const best = (key, fn, filter = () => true) => r.filter(filter).filter((x) => x[key] != null).sort(fn)[0];
      const hoch = best("bester_spieltag", (a, b) => b.bester_spieltag - a.bester_spieltag);
      const tief = best("schlechtester_spieltag", (a, b) => a.schlechtester_spieltag - b.schlechtester_spieltag);
      const quote = best("quote", (a, b) => b.quote - a.quote, (x) => x.spiele >= 10);
      const std = best("gewinn_pro_stunde", (a, b) => b.gewinn_pro_stunde - a.gewinn_pro_stunde, (x) => x.stunden >= 6);
      const wann = (datum, ort) => [datum ? `${WT[new Date(datum + "T12:00:00").getDay()]} ${datumDe(datum)}` : "", ort].filter(Boolean).map(esc).join(" · ");
      const kachel = (label, haupt, wert, wo, farbe) => `<div class="tile rk">
          <div class="tl">${label}</div>
          <div class="rkh"><span class="tv">${haupt}</span><span class="rkw" ${farbe ? `style="color:${farbe}"` : ""}>${wert}</span></div>
          <div class="ts">${wo || "&nbsp;"}</div></div>`;
      const t = g.groesster_topf, l = g.laengster_abend;
      return `<div class="rekorde r6">
        ${kachel("Höchster Abendgewinn", hoch ? esc(hoch.name) : "–", hoch ? eur(hoch.bester_spieltag) : "", hoch ? wann(hoch.bester_spieltag_datum, hoch.bester_spieltag_ort) : "", hoch ? vz(hoch.bester_spieltag) : "")}
        ${kachel("Höchster Abendverlust", tief ? esc(tief.name) : "–", tief ? eur(tief.schlechtester_spieltag) : "", tief ? wann(tief.schlechtester_spieltag_datum, tief.schlechtester_spieltag_ort) : "", tief ? vz(tief.schlechtester_spieltag) : "")}
        ${kachel("Größter Topf", t ? zahl(t.wert, 0) + " €" : "–", t ? `${t.spieler} Spieler` : "", t ? wann(t.datum, t.ort) : "")}
        ${kachel("Längster Abend", l ? zahl(l.wert, 1) + " h" : "–", l && l.beginn ? zeitText(l.beginn, l.ende) : "", l ? wann(l.datum, l.ort) : "Uhrzeiten nachtragen")}
        ${kachel("Beste Gewinnquote", quote ? esc(quote.name) : "–", quote ? zahl(quote.quote, 1) + " %" : "", quote ? `${quote.plus} von ${quote.plus + quote.minus} Abenden im Plus` : "ab 10 Spielen")}
        ${kachel("Bester Stundenlohn", std ? esc(std.name) : "–", std ? eur(std.gewinn_pro_stunde) + "/h" : "", std ? `über ${zahl(std.stunden, 0)} h Spielzeit` : "ab 6 h mit Uhrzeit")}
      </div>`;
    }

    // ------------------------------------------------------------ Eintragen
    _oeffneForm(tag = null) {
      const d = this._daten() || { spieler: [], orte: [] };
      const jetzt = heute();
      const aktive = d.spieler.filter((s) => s.aktiv !== false);
      const liste = aktive.map((s) => ({ id: s.id, name: s.name }));
      if (tag) {
        const alleErg = [...tag.ergebnisse, ...(tag.tage || []).flatMap((t) => t.ergebnisse)];
        alleErg.forEach((e) => {
          if (!liste.some((s) => s.id === e.spieler)) liste.push({ id: e.spieler, name: e.name });
        });
        liste.sort((a, b) => a.name.localeCompare(b.name, "de"));
      }
      const alsText = (v) => String(Math.round(v * 100) / 100).replace(".", ",");
      const werte = {};
      liste.forEach((s) => (werte[s.id] = { e: String(this._config.standard_einsatz), g: "" }));
      if (tag) tag.ergebnisse.forEach((e) => (werte[e.spieler] = { e: alsText(e.einsatz), g: e.gewinn ? alsText(e.gewinn) : "" }));
      const tage = {};
      (tag && tag.tage || []).forEach((t) => {
        const w = {};
        t.ergebnisse.forEach((e) => (w[e.spieler] = { e: alsText(e.einsatz), g: e.gewinn ? alsText(e.gewinn) : "" }));
        tage[t.datum] = { beginn: t.beginn || "", ende: t.ende || "", werte: w };
      });
      const basis = tag
        ? { id: tag.id, datum: tag.datum, ende_datum: tag.ende_datum || "", beginn: tag.beginn || "", ende: tag.ende || "", bez: tag.bezeichnung || "", ort: tag.ort || "", blinds: tag.blinds || "",
            sel: new Set(tag.ergebnisse.map((e) => e.spieler)), tageModus: !!(tag.tage && tag.tage.length) }
        : { id: null, datum: jetzt.datum, ende_datum: "", beginn: "19:00", ende: jetzt.zeit, bez: "", ort: (d.letzter && d.letzter.ort) || "", blinds: (d.letzter && d.letzter.blinds) || "",
            sel: new Set(aktive.map((s) => s.id)), tageModus: false };
      this._form = { ...basis, alle: liste, werte, tage, aktTag: null, orte: d.orte, ignorieren: false, fehler: "", busy: false };
      this._renderForm();
    }

    _formTage() {
      const f = this._form;
      if (!f.datum || !f.ende_datum || f.ende_datum <= f.datum) return [];
      const n = Math.min(tageZwischen(f.datum, f.ende_datum), 30);
      return Array.from({ length: n + 1 }, (_, i) => isoPlus(f.datum, i));
    }

    _tagDaten(iso) {
      const f = this._form;
      const t = (f.tage[iso] = f.tage[iso] || { beginn: "", ende: "", werte: {} });
      f.alle.forEach((s) => (t.werte[s.id] = t.werte[s.id] || { e: "", g: "" }));
      return t;
    }

    _tagesSummen() {
      const f = this._form;
      const sum = {};
      this._formTage().forEach((iso) => {
        const t = f.tage[iso];
        if (!t) return;
        f.sel.forEach((id) => {
          const w = t.werte[id];
          if (!w) return;
          const e = parse(w.e), g = parse(w.g);
          if (!(e > 0)) return;
          const x = (sum[id] = sum[id] || { e: 0, g: 0, n: 0 });
          x.e += e; x.g += Number.isNaN(g) || g == null ? 0 : g; x.n++;
        });
      });
      return sum;
    }

    _schliesseForm() {
      this._form = null;
      this._modal.innerHTML = "";
    }

    _renderForm() {
      const f = this._form;
      if (!f) return;
      const tageL = this._formTage();
      const mehrtaegig = tageL.length > 1;
      if (!mehrtaegig) f.tageModus = false;
      if (f.tageModus && !tageL.includes(f.aktTag) && f.aktTag !== "gesamt") f.aktTag = tageL[0];
      const chips = f.alle.map((s) => `<button class="chip ${f.sel.has(s.id) ? "an" : ""}" data-chip="${esc(s.id)}" aria-pressed="${f.sel.has(s.id)}">${esc(s.name)}</button>`).join("");
      const gew = f.alle.filter((s) => f.sel.has(s.id));
      const pmZeile = (s, w, de, dg, phE) => `
        <div class="nm">${esc(s.name)}</div>
        <input inputmode="decimal" ${de}="${esc(s.id)}" value="${esc(w.e)}" placeholder="${phE}" aria-label="Einsatz ${esc(s.name)}">
        <div class="gw"><button class="pm" data-pm="${esc(s.id)}" aria-label="Vorzeichen umschalten">±</button>
        <input inputmode="decimal" ${dg}="${esc(s.id)}" value="${esc(w.g)}" placeholder="0" aria-label="Gewinn ${esc(s.name)}"></div>`;

      let ergebnisHtml = "";
      if (f.sel.size && !f.tageModus) {
        ergebnisHtml = `<div class="sec"><span>Ergebnisse</span></div>
          <div class="eing"><div class="kh">Spieler</div><div class="kh">Einsatz €</div><div class="kh">Gewinn €</div>${gew.map((s) => pmZeile(s, f.werte[s.id], "data-e", "data-g", "")).join("")}</div>`;
      } else if (f.sel.size && f.tageModus) {
        const tabs = tageL.map((iso) => {
          const t = f.tage[iso];
          const hat = t && gew.some((s) => parse((t.werte[s.id] || {}).e) > 0);
          return `<button class="chip tg ${f.aktTag === iso ? "an" : ""}" data-tag="${iso}">${tagKurz(iso)}${hat ? '<span class="pkt"></span>' : ""}</button>`;
        }).join("") + `<button class="chip tg ${f.aktTag === "gesamt" ? "an" : ""}" data-tag="gesamt">Gesamt</button>`;
        let inhalt;
        if (f.aktTag === "gesamt") {
          const sum = this._tagesSummen();
          const zeilen = gew.filter((s) => sum[s.id]).map((s) => `<tr><td class="links n">${esc(s.name)}</td><td class="num">${sum[s.id].n}</td>
            <td class="num ein">${zahl(sum[s.id].e, 2)}</td><td class="num g" style="color:${vz(sum[s.id].g)}">${eur(sum[s.id].g)}</td></tr>`).join("");
          inhalt = zeilen ? `<table class="ltab"><thead><tr><th class="links">Spieler</th><th class="num">Tage</th><th class="num">Einsatz</th><th class="num">Gewinn</th></tr></thead><tbody>${zeilen}</tbody></table>`
            : `<div class="leer">Noch keine Tagesergebnisse eingetragen.</div>`;
        } else {
          const t = this._tagDaten(f.aktTag);
          inhalt = `<div class="f2" style="margin-top:0">
              <label class="fl">Beginn am ${tagKurz(f.aktTag)}<input type="time" id="t-beginn" value="${t.beginn}"></label>
              <label class="fl">Ende<input type="time" id="t-ende" value="${t.ende}"></label>
            </div>
            <div class="hint" id="t-mn">${mitternachtHinweis(f.aktTag, t.beginn, t.ende)}</div>
            <div class="eing" style="margin-top:8px"><div class="kh">Spieler</div><div class="kh">Einsatz €</div><div class="kh">Gewinn €</div>
              ${gew.map((s) => pmZeile(s, t.werte[s.id], "data-te", "data-tg", "nicht dabei")).join("")}</div>`;
        }
        ergebnisHtml = `<div class="sec"><span>Tagesergebnisse</span><span>leer = an dem Tag nicht gespielt</span></div>
          <div class="chips tagtabs">${tabs}</div><div class="tagbox">${inhalt}</div>`;
      }

      this._modal.innerHTML = `
        <div class="overlay" id="ov">
          <div class="dlg ${f.tageModus ? "breit" : ""}" role="dialog" aria-modal="true" aria-labelledby="dt">
            <h2 id="dt">${f.id ? "Spieltag bearbeiten" : "Spieltag eintragen"}</h2>
            <div class="sub">Gewinn = Endstand minus Einsatz. Verluste mit ± negativ machen.</div>
            <div class="f5 ${f.tageModus ? "ohnezeit" : ""}">
              <label class="fl">Datum<input type="date" id="f-datum" value="${f.datum}"></label>
              <label class="fl"><span>Enddatum <span class="opt">optional</span></span><input type="date" id="f-endedatum" value="${f.ende_datum}" min="${f.datum}"></label>
              ${f.tageModus ? "" : `<label class="fl">Beginn<input type="time" id="f-beginn" value="${f.beginn}"></label>
              <label class="fl">Ende<input type="time" id="f-ende" value="${f.ende}"></label>`}
            </div>
            <div class="hint" id="f-mn">${f.tageModus ? `<b>${tageL.length} Tage</b> · Uhrzeiten je Tag unten` : zeitHinweis(f.datum, f.ende_datum, f.beginn, f.ende)}</div>
            ${mehrtaegig ? `<label class="cb tagschalter"><input type="checkbox" id="f-tagemodus" ${f.tageModus ? "checked" : ""}>Tagesergebnisse eintragen <span class="opt">optional – sonst nur das Gesamtergebnis</span></label>` : ""}
            <div class="f3">
              <label class="fl">Ort (optional)<input id="f-ort" list="orte-liste" value="${esc(f.ort)}" placeholder="z. B. Bei Marco" autocomplete="off"></label>
              <label class="fl">Blinds (optional)<input id="f-blinds" value="${esc(f.blinds)}" placeholder="z. B. 0,10/0,20" autocomplete="off"></label>
              <label class="fl">Bezeichnung (optional)<input id="f-bez" value="${esc(f.bez)}" placeholder="z. B. Malle 2027"></label>
            </div>
            <datalist id="orte-liste">${(f.orte || []).map((o) => `<option value="${esc(o)}"></option>`).join("")}</datalist>
            <div class="sec"><span>Wer war dabei?</span><span>${f.sel.size} ausgewählt</span></div>
            <div class="chips">${chips || '<span class="leer">Keine aktiven Spieler.</span>'}</div>
            ${ergebnisHtml}
            <div id="summe"></div>
            <div class="msg" id="msg">${esc(f.fehler)}</div>
            <div class="fuss">
              ${f.id ? '<button class="btn rot" id="f-loeschen">Löschen</button><span style="flex:1"></span>' : ""}
              <button class="btn" id="abbr">Abbrechen</button>
              <button class="btn gold" id="speichern" ${f.busy ? "disabled" : ""}>${f.busy ? "Speichert …" : f.id ? "Änderungen speichern" : "Spieltag speichern"}</button>
            </div>
          </div>
        </div>`;
      const $ = (q) => this._modal.querySelector(q);
      const hinweis = () => { if (!f.tageModus) $("#f-mn").innerHTML = zeitHinweis(f.datum, f.ende_datum, f.beginn, f.ende); };
      $("#ov").addEventListener("click", (ev) => { if (ev.target.id === "ov" && !f.busy) this._schliesseForm(); });
      $("#abbr").addEventListener("click", () => this._schliesseForm());
      $("#speichern").addEventListener("click", () => this._speichern());
      // Datum/Enddatum ändern die Zahl der Tage -> neu zeichnen, wenn sich die Mehrtägigkeit ändert
      const datumGeaendert = () => {
        const vorher = mehrtaegig, nachher = this._formTage().length > 1;
        if (vorher !== nachher || f.tageModus) this._renderForm(); else hinweis();
      };
      $("#f-datum").addEventListener("change", (ev) => { f.datum = ev.target.value; if (f.ende_datum && f.ende_datum <= f.datum) f.ende_datum = ""; datumGeaendert(); });
      $("#f-endedatum").addEventListener("change", (ev) => { f.ende_datum = ev.target.value; datumGeaendert(); });
      if (!f.tageModus) {
        $("#f-beginn").addEventListener("input", (ev) => { f.beginn = ev.target.value; hinweis(); });
        $("#f-ende").addEventListener("input", (ev) => { f.ende = ev.target.value; hinweis(); });
      }
      const tm = $("#f-tagemodus");
      if (tm) tm.addEventListener("change", () => { f.tageModus = tm.checked; f.aktTag = null; this._renderForm(); });
      $("#f-bez").addEventListener("input", (ev) => (f.bez = ev.target.value));
      $("#f-ort").addEventListener("input", (ev) => (f.ort = ev.target.value));
      $("#f-blinds").addEventListener("input", (ev) => (f.blinds = ev.target.value));
      if (f.id) $("#f-loeschen").addEventListener("click", () => this._loescheTag(f.id));
      this._modal.querySelectorAll("[data-chip]").forEach((b) => b.addEventListener("click", () => {
        const id = b.dataset.chip;
        f.sel.has(id) ? f.sel.delete(id) : f.sel.add(id);
        this._renderForm();
      }));
      this._modal.querySelectorAll("[data-tag]").forEach((b) => b.addEventListener("click", () => { f.aktTag = b.dataset.tag; this._renderForm(); }));
      this._modal.querySelectorAll("[data-e]").forEach((i) => i.addEventListener("input", () => { f.werte[i.dataset.e].e = i.value; this._summe(); }));
      this._modal.querySelectorAll("[data-g]").forEach((i) => i.addEventListener("input", () => { f.werte[i.dataset.g].g = i.value; this._summe(); }));
      if (f.tageModus && f.aktTag && f.aktTag !== "gesamt") {
        const t = this._tagDaten(f.aktTag);
        this._modal.querySelectorAll("[data-te]").forEach((i) => i.addEventListener("input", () => { t.werte[i.dataset.te].e = i.value; this._summe(); }));
        this._modal.querySelectorAll("[data-tg]").forEach((i) => i.addEventListener("input", () => { t.werte[i.dataset.tg].g = i.value; this._summe(); }));
        const tmn = () => ($("#t-mn").innerHTML = mitternachtHinweis(f.aktTag, t.beginn, t.ende));
        $("#t-beginn").addEventListener("input", (ev) => { t.beginn = ev.target.value; tmn(); });
        $("#t-ende").addEventListener("input", (ev) => { t.ende = ev.target.value; tmn(); });
      }
      this._modal.querySelectorAll("[data-pm]").forEach((b) => b.addEventListener("click", () => {
        const id = b.dataset.pm;
        const w = f.tageModus && f.aktTag !== "gesamt" ? this._tagDaten(f.aktTag).werte[id] : f.werte[id];
        const t = w.g.trim();
        w.g = t.startsWith("-") ? t.slice(1) : "-" + (t || "");
        const inp = this._modal.querySelector(f.tageModus ? `[data-tg="${CSS.escape(id)}"]` : `[data-g="${CSS.escape(id)}"]`);
        if (inp) inp.value = w.g;
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
      let summe = 0, topf = 0, tagInfo = "";
      if (f.tageModus) {
        const sum = this._tagesSummen();
        Object.values(sum).forEach((x) => { summe += x.g; topf += x.e; });
        if (f.aktTag && f.aktTag !== "gesamt" && f.tage[f.aktTag]) {
          let ts = 0;
          f.sel.forEach((id) => { const w = f.tage[f.aktTag].werte[id]; if (w && parse(w.e) > 0) ts += parse(w.g) || 0; });
          ts = Math.round(ts * 100) / 100;
          tagInfo = ` · ${tagKurz(f.aktTag)}: <span style="color:${Math.abs(ts) < 0.005 ? C.green : C.red}">${eur(ts)}</span>`;
        }
      } else {
        f.sel.forEach((id) => { summe += parse(f.werte[id].g) || 0; topf += parse(f.werte[id].e) || 0; });
      }
      summe = Math.round(summe * 100) / 100;
      const ok = Math.abs(summe) < 0.005;
      box.innerHTML = `<div class="summe ${ok ? "ok" : "nok"}">
        <div><b>Summe der Gewinne${f.tageModus ? " (gesamt)" : ""}: ${eur(summe)}</b><div style="font-size:12px;color:${C.muted};margin-top:2px">${ok ? `Passt. ${zahl(topf, 2)} € im Topf.` : "Sollte 0 € ergeben – bitte prüfen."}${tagInfo}</div></div>
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

    _pruefeZeile(name, ew, gw, selE, selG) {
      const e = parse(ew), g = parse(gw) ?? 0;
      const mark = (q) => this._modal.querySelector(q)?.classList.add("fehler");
      if (!(e > 0)) { mark(selE); return { fehler: `${name}: Einsatz fehlt.` }; }
      if (Number.isNaN(g)) { mark(selG); return { fehler: `${name}: Gewinn ist keine Zahl.` }; }
      if (g < -e) { mark(selG); return { fehler: `${name}: Verlust größer als der Einsatz.` }; }
      return { e, g };
    }

    async _speichern() {
      const f = this._form;
      if (!f || f.busy) return;
      this._modal.querySelectorAll("input.fehler").forEach((i) => i.classList.remove("fehler"));
      if (!f.datum) return this._zeigeFehler("Bitte ein Datum angeben.");
      if (f.ende_datum && f.ende_datum < f.datum) return this._zeigeFehler("Das Enddatum liegt vor dem Startdatum.");
      if (!f.sel.size) return this._zeigeFehler("Wähle mindestens einen Spieler aus.");
      const gew = f.alle.filter((s) => f.sel.has(s.id));
      const daten = { datum: f.datum, bezeichnung: f.bez.trim(), ort: f.ort.trim(), blinds: (f.blinds || "").trim(), summe_ignorieren: !!f.ignorieren };
      if (f.ende_datum && f.ende_datum > f.datum) daten.ende_datum = f.ende_datum;
      let summe = 0;
      if (f.tageModus) {
        const tage = [];
        for (const iso of this._formTage()) {
          const t = f.tage[iso];
          if (!t) continue;
          const erg = [];
          for (const s of gew) {
            const w = t.werte[s.id] || { e: "", g: "" };
            const leer = !String(w.e).trim() && !String(w.g).trim();
            if (leer) continue;
            const r = this._pruefeZeile(`${tagKurz(iso)} ${s.name}`, w.e, w.g, `[data-te="${CSS.escape(s.id)}"]`, `[data-tg="${CSS.escape(s.id)}"]`);
            if (r.fehler) { f.aktTag !== iso && (f.aktTag = iso, this._renderForm()); return this._zeigeFehler(r.fehler); }
            erg.push({ spieler: s.id, einsatz: r.e, gewinn: r.g });
            summe += r.g;
          }
          if (!erg.length) continue;
          const tag = { datum: iso, ergebnisse: erg };
          if (t.beginn && t.ende) { tag.beginn = t.beginn; tag.ende = t.ende; }
          tage.push(tag);
        }
        if (!tage.length) return this._zeigeFehler("Noch an keinem Tag Ergebnisse eingetragen.");
        daten.tage = tage;
      } else {
        const ergebnisse = [];
        for (const s of gew) {
          const r = this._pruefeZeile(s.name, f.werte[s.id].e, f.werte[s.id].g, `[data-e="${CSS.escape(s.id)}"]`, `[data-g="${CSS.escape(s.id)}"]`);
          if (r.fehler) return this._zeigeFehler(r.fehler);
          ergebnisse.push({ spieler: s.id, einsatz: r.e, gewinn: r.g });
          summe += r.g;
        }
        daten.ergebnisse = ergebnisse;
        if (f.beginn) daten.beginn = f.beginn;
        if (f.ende) daten.ende = f.ende;
      }
      summe = Math.round(summe * 100) / 100;
      if (Math.abs(summe) >= 0.005 && !f.ignorieren) return this._zeigeFehler(`Die Gewinne ergeben ${eur(summe)} statt 0 €. Korrigieren oder „Trotzdem speichern“ anhaken.`);
      if (f.id) daten.id = f.id;
      f.busy = true; f.fehler = "";
      const btn = this._modal.querySelector("#speichern");
      if (btn) { btn.disabled = true; btn.textContent = "Speichert …"; }
      try {
        await this._hass.callService("poker_home_games", f.id ? "spieltag_bearbeiten" : "spieltag_eintragen", daten);
        const warBearbeiten = !!f.id;
        this._schliesseForm();
        this._toast(warBearbeiten ? "Änderungen gespeichert" : "Spieltag gespeichert");
      } catch (err) {
        f.busy = false;
        if (btn) { btn.disabled = false; btn.textContent = f.id ? "Änderungen speichern" : "Spieltag speichern"; }
        this._zeigeFehler((err && err.message) || "Speichern fehlgeschlagen.");
      }
    }

    async _loescheTag(id) {
      const f = this._form;
      const tag = (this._spieltage || []).find((t) => t.id === id) || ((this._daten() || {}).letzter && this._daten().letzter.id === id ? this._daten().letzter : null);
      const titel = tag ? `${datumDe(tag.datum)}${tag.bezeichnung ? " (" + tag.bezeichnung + ")" : ""}` : "";
      if (!window.confirm(`Spieltag ${titel} wirklich löschen?\n\nDas lässt sich nicht rückgängig machen.`)) return;
      try {
        await this._hass.callService("poker_home_games", "spieltag_loeschen", { id });
        if (f && f.id === id) this._schliesseForm();
        this._toast("Spieltag gelöscht");
      } catch (err) {
        if (f) this._zeigeFehler((err && err.message) || "Löschen fehlgeschlagen.");
        else window.alert((err && err.message) || "Löschen fehlgeschlagen.");
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
