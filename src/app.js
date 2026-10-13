/* FX Strategist concept prototype - UI layer. Synthetic data; not an official Razorpay product. */
(function () {
  const E = window.FXE, D = E.D;
  const KEY = "fxs-demo-v3";
  let S, UI;
  const UI0 = () => ({ view: "home", internal: false, phoneOpen: true, txFilter: "all", txSearch: "", txPage: 0, reportTab: "audit", ledgerBucket: "all",
    phone: { screen: "home", key: null, edit: null, chat: [] }, obOpen: true });

  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) { const o = JSON.parse(raw); if (o.S && o.S.v === 3) { S = o.S; UI = { ...UI0(), ...o.UI }; return; } } } catch (e) { }
    S = E.initState(); UI = UI0(); window.__fresh = true;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ S, UI })); } catch (e) { } }

  // ---------- format ----------
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const inr = (x) => (x < 0 ? "-" : "") + "₹" + Math.round(Math.abs(x)).toLocaleString("en-IN");
  const inrL = (x) => (x < 0 ? "-" : "") + "₹" + E.lakh(Math.abs(x));
  const usd = (x) => "$" + Math.round(x).toLocaleString("en-US");
  const usd2 = (x) => "$" + Number(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const P = E.pretty, SD = E.shortDate;
  const bandOf = (r) => E.band(r.conf, r.kind);
  const chip = (r) => { if (r.kind === "opportunity") return `<span class="chip market">📈 Market alert · not a prediction</span>`; const b = bandOf(r); const cls = b.toLowerCase(); const ico = { High: "●", Medium: "●", Low: "●", Locked: "🔒" }[b]; return `<span class="chip ${cls}"><span class="ico">${ico}</span>${b === "Locked" ? "Locked · RBI deadline" : b + " confidence · " + r.conf + "%"}</span>`; };
  const kindLabel = { locked: "Required · deadline rule", deadline: "Planned · deadline rule", fund: "Recommendation · convert", topup: "Recommendation · convert", hold: "Recommendation · hold USD", question: "Question · low confidence", alert: "Alert", opportunity: "Opportunity · rate trigger" };

  function toast(msg) { if (window.__tourFast) return; const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.getElementById("toasts").appendChild(t); const box = document.getElementById("toasts"); while (box.children.length > 2) box.firstChild.remove(); setTimeout(() => t.remove(), 2600); }

  // ---------- data views ----------
  const recs = () => E.plan(S);
  const activeRecs = () => recs().filter((r) => !r.skippedRec);
  const needsYou = () => activeRecs().filter((r) => r.kind !== "deadline" || true).length;
  const eefcTotal = () => S.buckets.reduce((s, b) => s + b.remaining, 0);
  const heldTotal = () => S.holds.filter((h) => !h.released).reduce((s, h) => s + h.remainingUsd, 0);
  const schedTotal = () => S.scheduled.filter((x) => !x.executed).reduce((s, x) => s + x.usd, 0);
  function allTx() { return S.newTx.slice().reverse().concat(D.tx.filter((t) => t.date <= D.meta.today)); }
  function allLedger() { return D.ledger.concat(S.newLedger).slice().reverse(); }

  // ---------- shell ----------
  function render() {
    document.getElementById("demobar").innerHTML = demobar();
    document.getElementById("side").innerHTML = side();
    const m = document.getElementById("main");
    const v = UI.internal ? "outcomes" : UI.view;
    m.innerHTML = ({ home, eefc, calendar, strategist, reports, settings, outcomes })[v]();
    if (v === "calendar") wireChart();
    if (v === "strategist") activeRecs().forEach((r) => (S.metrics.shown[r.key] = bandOf(r)));
    renderPhone();
    save();
  }
  function demobar() {
    const nx = E.nextEventDate(S);
    return `<span class="tag">DEMO CONTROLS</span><span class="hint">not part of the product</span>
      <span class="date">📅 ${P(S.date)} 2026</span>
      <button data-act="day">+1 day</button>
      <button data-act="next" ${S.date >= E.END ? "disabled" : ""}>Next event ▸ ${S.date >= E.END ? "" : SD(nx)}</button>
      <input type="date" id="godate" min="${S.date}" max="${E.END}" value="${S.date}"><button data-act="go">Go</button>
      <button data-act="reset">↺ Reset demo</button><button data-act="tour" style="background:#f5b301;color:#1b1f2a;border-color:#f5b301;font-weight:700">▶ Guided demo</button><button data-act="video">🎬 Video mode</button>
      <span class="sp"></span>
      <span class="seg"><button data-act="mode" data-v="m" class="${UI.internal ? "" : "on"}">Merchant View</button><button data-act="mode" data-v="i" class="${UI.internal ? "on" : ""}">Internal View</button></span>
      <button data-act="phone" title="${UI.phoneOpen ? "Hide" : "Show"} the phone">📱 ${UI.phoneOpen ? "Hide" : "Show"}</button>`;
  }
  function side() {
    const n = activeRecs().length;
    if (UI.internal) return `<div class="brand"><b>Razorpay</b><span>internal</span></div>
      <div class="merchant">Viewing merchant<b>Lumio Analytics Pvt Ltd</b>FX Strategist pilot</div>
      <div class="navsec">Product analytics</div>
      <button class="nav on">📈 FX Strategist outcomes</button>
      <div class="foot">Internal view for Razorpay product & risk teams - not visible to merchants.<br><br>Concept prototype · synthetic data</div>`;
    const nav = (id, label, cls = "", badge = "") => `<button class="nav ${cls} ${UI.view === id ? "on" : ""}" data-act="nav" data-v="${id}">${label}${badge}</button>`;
    return `<div class="brand"><b>Razorpay</b><span>concept prototype</span></div>
      <div class="merchant">Lumio Analytics Pvt Ltd<b>Rohan Mehta</b>Founder · Admin</div>
      ${nav("home", "🏠 Home & transactions")}
      <div class="navsec">Treasury</div>
      ${nav("eefc", "🌐 EEFC account", "sub")}
      ${nav("calendar", "🗓️ Cash calendar", "sub")}
      ${nav("strategist", "✦ FX Strategist", "sub", n ? `<span class="badge">${n}</span>` : "")}
      <div class="navsec">Account</div>
      ${nav("reports", "📄 Reports & audit log")}
      ${nav("settings", "⚙️ Settings")}
      <div class="foot">Concept prototype for the Razorpay AI PM Build Challenge. Synthetic data. Not an official Razorpay product.</div>`;
  }

  // ---------- HOME ----------
  function home() {
    const r = activeRecs();
    const next = r[0];
    const month = S.date.slice(0, 7);
    const collected = allTx().filter((t) => t.type === "Payment received" && t.date.slice(0, 7) === month).reduce((s, t) => s + t.amount, 0);
    const pay = E.obligationView(S, D.obligations[0]);
    const nextPay = pay.dates.find((d) => d > S.date);
    const types = { all: "All", "Payment received": "Payments received", Payout: "Payouts", "USD payment": "USD payments", Conversion: "Conversions", "Transfer to FD": "FD transfers" };
    let tx = allTx();
    if (UI.txFilter !== "all") tx = tx.filter((t) => t.type === UI.txFilter);
    if (UI.txSearch) { const q = UI.txSearch.toLowerCase(); tx = tx.filter((t) => (t.party + t.ref + t.note).toLowerCase().includes(q)); }
    const per = 25, pages = Math.max(1, Math.ceil(tx.length / per)); if (UI.txPage >= pages) UI.txPage = 0;
    const rows = tx.slice(UI.txPage * per, UI.txPage * per + per).map((t) => `<tr class="${t.isNew ? "new" : ""}"><td class="num">${SD(t.date)} ${t.date.slice(0, 4)}</td><td>${esc(t.type)} ${t.isNew ? '<span class="chip new">new</span>' : ""}</td><td>${esc(t.party)}</td><td>${esc(t.ref)}</td>
      <td class="r num ${t.dir === "in" ? "ok" : ""}">${t.dir === "in" ? "+" : t.dir === "out" ? "−" : "⇄ "}${t.ccy === "INR" ? inr(t.amount) : usd2(t.amount)}</td><td class="sub">${esc(t.note)}</td></tr>`).join("");
    return `<div class="ph"><div><h1>Good morning, Rohan</h1><p>Here's Lumio Analytics on ${P(S.date)}.</p></div></div>
      <div class="grid g4">
        <div class="card pad kpi"><div class="lab">INR current account</div><div class="val num ${S.inr < S.settings.buffer ? "warn" : ""}">${inr(S.inr)}</div><div class="foot">Buffer policy ${inrL(S.settings.buffer)}</div></div>
        <div class="card pad kpi"><div class="lab">EEFC balance (USD)</div><div class="val num">${usd2(eefcTotal())}</div><div class="foot">≈ ${inrL(eefcTotal() * E.rate(S.date))} at ${E.rate(S.date).toFixed(2)}</div></div>
        <div class="card pad kpi"><div class="lab">Collected this month</div><div class="val num">${usd(collected)}</div><div class="foot">International payments</div></div>
        <div class="card pad kpi"><div class="lab">Next payroll</div><div class="val num">${nextPay ? inrL(pay.est) : "-"}</div><div class="foot">${nextPay ? P(nextPay) : "None in view"}</div></div>
      </div>
      ${r.length ? `<div class="callout mt"><div class="ic">✦</div><div><b>FX Strategist has ${r.length} item${r.length > 1 ? "s" : ""} for you</b><div class="sub">Next: ${esc(next.title)} · ${P(next.date)}</div></div><span class="sp"></span><button class="btn primary" data-act="nav" data-v="strategist">Review plan</button></div>` : ""}
      <div class="card mt2" id="txcard"><div class="toolbar"><b>Transactions</b><span class="sub">${tx.length} records · 24 months</span><span style="flex:1"></span>
        <select data-act="txfilter">${Object.entries(types).map(([k, v]) => `<option value="${k}" ${UI.txFilter === k ? "selected" : ""}>${v}</option>`).join("")}</select>
        <input type="search" id="txsearch" placeholder="Search client, payee, reference" value="${esc(UI.txSearch)}"></div>
        <div class="tablewrap"><table class="t"><thead><tr><th>Date</th><th>Type</th><th>Counterparty</th><th>Reference</th><th class="r">Amount</th><th>Details</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div class="pager"><span>Page ${UI.txPage + 1} of ${pages}</span><span><button class="btn sm" data-act="txpage" data-v="-1" ${UI.txPage === 0 ? "disabled" : ""}>‹ Prev</button> <button class="btn sm" data-act="txpage" data-v="1" ${UI.txPage >= pages - 1 ? "disabled" : ""}>Next ›</button></span></div></div>`;
  }

  // ---------- EEFC ----------
  function eefc() {
    const fx = E.rate(S.date);
    const { free } = E.supply(S);
    const cards = S.buckets.slice().sort((a, b) => b.id.localeCompare(a.id)).map((b) => {
      const days = E.daysBetween(S.date, b.deadline);
      const done = b.remaining < 0.5;
      const status = done ? (b.autoConverted > 0 ? `<span class="chip low">Auto-converted by guardrail</span>` : `<span class="chip high">✓ Fully used / converted</span>`)
        : days < 0 ? `<span class="chip low">Past deadline</span>` : days <= 10 ? `<span class="chip medium">Convert by ${P(b.deadline)} · ${days} day${days === 1 ? "" : "s"}</span>` : `<span class="chip neutral">Convert by ${P(b.deadline)} · ${days} days</span>`;
      const tot = Math.max(b.received, 1);
      const al = E.allocation(S)[b.id] || { held: 0, scheduled: [] };
      return `<div class="card pad bucket" data-bucket="${b.id}"><div style="display:flex;justify-content:space-between;align-items:center"><h3>${E.monthName(b.id)} receipts</h3>${status}</div>
        <div class="sub">Received ${usd2(b.received)} · avg rate on receipt ${b.receiptRate.toFixed(2)}</div>
        <div class="bar"><i style="width:${(b.used / tot) * 100}%;background:#7d93b8"></i><i style="width:${(b.converted / tot) * 100}%;background:var(--series-1)"></i><i style="width:${(b.remaining / tot) * 100}%;background:#f0b44c"></i></div>
        <div class="legend"><span><span class="dot" style="background:#7d93b8"></span>Used for USD payments ${usd(b.used)}</span><span><span class="dot" style="background:var(--series-1)"></span>Converted ${usd(b.converted)}</span><span><span class="dot" style="background:#f0b44c"></span>Remaining ${usd2(b.remaining)}</span></div>
        ${S.newConv.filter((c) => c.bucket.split("+").includes(b.id)).map((c) => `<div class="note">✓ Converted ${usd(c.usd)} on ${P(c.date)} at ${c.rate.toFixed(2)}${c.approvedRate ? ` <span class="sub">(approved ${SD(c.approvedOn)} at ${c.approvedRate.toFixed(2)}${c.pulled ? `; early via ${c.pulled}, was due ${SD(c.origDate)}` : ""})</span>` : ` <span class="sub">(deadline guardrail)</span>`}</div>`).join("")}
        ${al.scheduled.length ? `<div class="note">⏳ Approved, converts on execution date: ${al.scheduled.map((s) => usd(s.usd) + " on " + P(s.date)).join(", ")}</div>` : ""}
        ${al.held > 0.5 ? `<div class="note">🔒 Held for USD bills: ${usd(al.held)}</div>` : ""}
        ${b.remaining > 0.5 ? `<div class="note">Free to plan: ${usd(Math.max(0, free[b.id]))}</div>` : ""}</div>`;
    }).join("");
    let L = allLedger(); if (UI.ledgerBucket !== "all") L = L.filter((l) => l.bucket === UI.ledgerBucket);
    const rows = L.map((l) => `<tr><td class="num">${SD(l.date)}</td><td>${esc(l.entry)}</td><td>${esc(l.ref)}</td><td>${E.monthName(l.bucket)}</td><td class="r num ${l.usd > 0 ? "ok" : ""}">${l.usd > 0 ? "+" : "−"}${usd2(Math.abs(l.usd))}</td></tr>`).join("");
    return `<div class="crumb">Treasury</div><div class="ph"><div><h1>EEFC account</h1><p>USD settlements held in foreign currency (Multi-Currency EEFC Account, enabled ${P(D.meta.eefcStart)}).</p></div></div>
      <div class="grid g4">
        <div class="card pad kpi"><div class="lab">Total EEFC balance</div><div class="val num">${usd2(eefcTotal())}</div><div class="foot">≈ ${inrL(eefcTotal() * fx)}</div></div>
        <div class="card pad kpi"><div class="lab">Held for USD bills</div><div class="val num">${usd(heldTotal())}</div><div class="foot">Approved holds</div></div>
        <div class="card pad kpi"><div class="lab">Scheduled to convert</div><div class="val num">${usd(schedTotal())}</div><div class="foot">${S.scheduled.filter((x) => !x.executed).length} approved conversion(s)</div></div>
        <div class="card pad kpi"><div class="lab">USD/INR today</div><div class="val num">${fx.toFixed(4)}</div><div class="foot">Live mid rate, 0% markup (synthetic)</div></div>
      </div>
      <div class="ccyrow mt" id="ccyrow"><span class="lab">Currencies held</span>
        <span class="ccy on"><b>USD</b> ${usd(eefcTotal())} <span class="chip high">FX Strategist · Pilot</span></span>
        ${["EUR", "GBP", "AED", "SGD"].map((c) => `<span class="ccy off" title="Supported by the Multi-Currency EEFC Account - FX Strategist planning arrives in v2"><b>${c}</b> - <span class="chip neutral">v2</span></span>`).join("")}
        <span class="sub">FX Strategist pilots on USD, where most export receipts are; other currencies follow once pilot metrics hold.</span></div>
      <div class="info mt">📘 <b>RBI rule:</b> the sum of receipts credited in a calendar month must be converted to INR by the last day of the following month, after USD used for permitted payments. Each card below is one month's "bucket".</div>
      <div class="grid g2 mt">${cards}</div>
      <div class="card mt2"><div class="toolbar"><b>EEFC ledger</b><span style="flex:1"></span><select data-act="ledgerbucket"><option value="all">All buckets</option>${S.buckets.map((b) => `<option value="${b.id}" ${UI.ledgerBucket === b.id ? "selected" : ""}>${E.monthName(b.id)}</option>`).join("")}</select></div>
      <div class="tablewrap"><table class="t"><thead><tr><th>Date</th><th>Entry</th><th>Reference</th><th>Bucket</th><th class="r">USD</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }

  // ---------- CASH CALENDAR ----------
  function calendar() {
    const past = D.daily.filter((d) => d.date >= E.addDays(D.meta.today, -30)).concat(S.newDaily).filter((d) => d.date <= S.date && d.date >= E.addDays(S.date, -30));
    const withP = E.project(S, true), without = E.project(S, false);
    const obs = [];
    const fxNow = E.rate(S.date);
    E.plan(S).filter((r) => !r.skippedRec).forEach((r) => (r.tranches || []).forEach((t) => obs.push({ date: t.date, kind: "Recommended conversion", what: r.title, amt: "+" + inrL(t.usd * fxNow), sub: usd(t.usd), conf: r })));
    S.scheduled.filter((x) => !x.executed).forEach((x) => obs.push({ date: x.date, kind: "Approved conversion", what: x.rationale, amt: "+" + inrL(x.usd * fxNow), sub: usd(x.usd), conf: { kind: "locked", conf: null, approved: true } }));
    D.obligations.forEach((o0) => { const o = E.obligationView(S, o0); if (o.status === "removed") return; o.dates.filter((d) => d > S.date && d <= E.END).forEach((d) => {
      if (o.id === "offsite" && S.answers.offsite !== "yes") { if (S.answers.offsite == null) obs.push({ date: d, kind: "Unconfirmed one-off", what: o.name + " - awaiting your answer", amt: "−" + inrL(o.estimate), sub: "seen once", conf: { conf: o.conf, kind: "question" } }); return; }
      obs.push({ date: d, kind: o.ccy === "USD" ? "USD bill (paid from EEFC)" : "Payment", what: o.name, amt: "−" + (o.ccy === "USD" ? usd(o.est) : inrL(o.est)), sub: o.cadence + " · seen " + o.seen + "x", conf: { conf: o.conf, kind: "x" } }); }); });
    E.expectedReceipts(S).filter((e) => e.date <= E.END).forEach((e) => obs.push({ date: e.date, kind: "Expected receipt (to EEFC)", what: e.client, amt: "+" + usd(e.usd), sub: e.note, conf: { conf: e.conf, kind: "x" } }));
    obs.sort((a, b) => a.date.localeCompare(b.date));
    const rows = obs.map((o) => `<tr><td class="num">${P(o.date)}</td><td>${esc(o.kind)}</td><td>${esc(o.what)}</td><td class="r num">${o.amt}</td><td class="sub">${esc(o.sub)}</td><td>${o.conf.approved ? '<span class="chip high">✓ Approved</span>' : chip(o.conf)}</td></tr>`).join("");
    const minProj = Math.min(...withP.map((p) => p.inr)), minWithout = Math.min(...without.map((p) => p.inr));
    return `<div class="crumb">Treasury</div><div class="ph"><div><h1>Cash calendar</h1><p>INR runway and expected flows, learned from 24 months of history.</p></div></div>
      <div class="grid g3">
        <div class="card pad kpi"><div class="lab">INR balance today</div><div class="val num">${inr(S.inr)}</div><div class="foot">Buffer ${inrL(S.settings.buffer)}</div></div>
        <div class="card pad kpi"><div class="lab">Lowest point · with plan</div><div class="val num ${minProj < S.settings.buffer - 30000 ? "warn" : "ok"}">${inrL(minProj)}</div><div class="foot">Approved + recommended conversions</div></div>
        <div class="card pad kpi"><div class="lab">Lowest point · without plan</div><div class="val num ${minWithout < 0 ? "warn" : ""}">${inrL(minWithout)}</div><div class="foot">Only the RBI deadline guardrail converts</div></div>
      </div>
      <div class="card pad mt" id="chartcard"><h3>INR current account - last 30 days and next weeks to ${SD(E.END)}</h3>
        <div class="legendrow"><span><span class="key" style="background:var(--ink-2)"></span>Actual</span><span><span class="key" style="background:var(--series-1)"></span>Projected with FX Strategist plan</span><span><span class="key" style="background:var(--series-2)"></span>Projected without plan</span><span><span class="key" style="background:#b8c2d3"></span>Buffer ${inrL(S.settings.buffer)}</span></div>
        <div class="chart" id="chart">${chartSvg(past, withP, without)}<div class="tip" id="tip"></div></div></div>
      <div class="card mt"><div class="toolbar"><b>Upcoming flows</b><span class="sub">Confidence = how sure the agent is about the cash input, not the FX rate</span></div>
        <div class="tablewrap"><table class="t"><thead><tr><th>Date</th><th>Type</th><th>Item</th><th class="r">Amount</th><th>Basis</th><th>Confidence</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="sub">Nothing upcoming in view.</td></tr>'}</tbody></table></div></div>`;
  }
  let CH = null;
  function chartSvg(past, withP, without) {
    const W = 920, H = 300, L = 64, R = 16, T = 14, B = 30;
    const dates = []; let d = past.length ? past[0].date : S.date; while (d <= E.END) { dates.push(d); d = E.addDays(d, 1); }
    const idx = (s) => dates.indexOf(s);
    const all = past.map((p) => p.inr).concat(withP.map((p) => p.inr), without.map((p) => p.inr), [S.settings.buffer, 0]);
    let lo = Math.min(...all), hi = Math.max(...all); const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const step = niceStep((hi - lo) / 5); lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    const x = (i) => L + (i / (dates.length - 1)) * (W - L - R), y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const path = (arr) => arr.map((p, k) => (k ? "L" : "M") + x(idx(p.date)).toFixed(1) + "," + y(p.inr).toFixed(1)).join("");
    let grid = ""; for (let v = lo; v <= hi + 1; v += step) grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${v === 0 ? "₹0" : (v / 1e5).toFixed(0) + "L"}</text>`;
    let xt = ""; dates.forEach((s, i) => { if (s.endsWith("-01") || s.endsWith("-15") || s === S.date) xt += `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" font-size="11" fill="${s === S.date ? "var(--ink)" : "var(--muted)"}" ${s === S.date ? 'font-weight="600"' : ""}>${s === S.date ? "Today" : SD(s)}</text>`; });
    const ti = idx(S.date);
    CH = { dates, past, withP, without, x, L, W, R, T, H, B, y };
    return `<svg viewBox="0 0 ${W} ${H}" id="chsvg" role="img" aria-label="INR balance projection">${grid}${xt}
      <line x1="${x(ti)}" x2="${x(ti)}" y1="${T}" y2="${H - B}" stroke="#c9d1de"/>
      <line x1="${L}" x2="${W - R}" y1="${y(S.settings.buffer)}" y2="${y(S.settings.buffer)}" stroke="#b8c2d3" stroke-width="1.5"/>
      ${lo < 0 ? `<rect x="${L}" y="${y(0)}" width="${W - L - R}" height="${y(lo) - y(0)}" fill="#fbe5e3" opacity=".6"/>` : ""}
      <path d="${path(without)}" fill="none" stroke="var(--series-2)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="${path(withP)}" fill="none" stroke="var(--series-1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${past.length ? `<path d="${path(past)}" fill="none" stroke="var(--ink-2)" stroke-width="2" stroke-linejoin="round"/>` : ""}
      <circle cx="${x(ti)}" cy="${y(S.inr)}" r="5" fill="var(--ink)" stroke="#fff" stroke-width="2"/>
      <line id="cross" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="#8a96ab" stroke-width="1" style="display:none"/>
      <rect id="hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/></svg>`;
  }
  function niceStep(r) { const p = Math.pow(10, Math.floor(Math.log10(r))); const n = r / p; return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p; }
  function wireChart() {
    const svg = document.getElementById("chsvg"), tip = document.getElementById("tip"), cross = document.getElementById("cross"); if (!svg) return;
    const hit = document.getElementById("hit");
    hit.addEventListener("mousemove", (ev) => {
      const r = svg.getBoundingClientRect(); const sx = ((ev.clientX - r.left) / r.width) * CH.W;
      const i = Math.max(0, Math.min(CH.dates.length - 1, Math.round(((sx - CH.L) / (CH.W - CH.L - CH.R)) * (CH.dates.length - 1))));
      const d = CH.dates[i]; const f = (arr) => (arr.find((p) => p.date === d) || {}).inr;
      const a = f(CH.past), w = f(CH.withP), o = f(CH.without);
      cross.setAttribute("x1", CH.x(i)); cross.setAttribute("x2", CH.x(i)); cross.style.display = "";
      tip.style.display = "block"; tip.style.left = (CH.x(i) / CH.W) * 100 + "%"; tip.style.top = "30px";
      tip.innerHTML = `<b>${P(d)}</b><br>${a != null ? "Actual " + inrL(a) + "<br>" : ""}${w != null ? "With plan " + inrL(w) + "<br>" : ""}${o != null ? "Without plan " + inrL(o) : ""}`;
    });
    hit.addEventListener("mouseleave", () => { tip.style.display = "none"; cross.style.display = "none"; });
  }

  // ---------- FX STRATEGIST ----------
  function strategist() {
    const all = recs();
    const act = all.filter((r) => !r.skippedRec), sk = all.filter((r) => r.skippedRec);
    const nextDl = S.buckets.filter((b) => b.remaining > 0.5 && b.deadline >= S.date).sort((a, b) => a.deadline.localeCompare(b.deadline))[0];
    const conv = act.filter((r) => r.tranches && r.tranches.length && r.kind !== "hold").reduce((s, r) => s + r.usd, 0);
    return `<div class="crumb">Treasury</div><div class="ph"><div><h1>✦ FX Strategist</h1><p>Plans when and how much of your EEFC balance to convert - around your payables, cash runway and RBI deadlines. Every conversion needs your approval.</p></div></div>
      <div class="card summary-strip">
        <div><div class="lab">Needs your decision</div><div class="val">${act.length}</div></div>
        <div><div class="lab">Proposed conversions</div><div class="val num">${usd(conv)}</div></div>
        <div><div class="lab">Approved & scheduled</div><div class="val num">${usd(schedTotal())}</div></div>
        <div><div class="lab">Next RBI deadline</div><div class="val">${nextDl ? `${E.monthName(nextDl.id)} · ${E.daysBetween(S.date, nextDl.deadline)}d` : "None open"}</div></div>
      </div>
      ${rateCard()}
      ${onboarding()}
      <div class="grid mt" style="gap:12px" id="reclist">${act.length ? act.map(recCard).join("") : `<div class="card pad"><h3>You're all set</h3><div class="sub">No decisions needed right now. Use the demo controls to move the date forward.</div></div>`}</div>
      ${sk.length ? `<h3 class="mt2" style="font-size:14px;color:var(--ink-2)">Skipped</h3><div class="grid" style="gap:8px">${sk.map((r) => `<div class="card pad rec skipped"><div class="top">${chip(r)}<span class="kind">${kindLabel[r.kind]}</span></div><b>${esc(r.title)}</b> <button class="link" data-act="unskip" data-k="${r.key}">Restore</button></div>`).join("")}</div>` : ""}
      ${scheduledList()}`;
  }
  function rateCard() {
    const c = E.marketContext(S), cfg = E.cfgOf(S);
    const hit = cfg.targetRate && c.rate >= cfg.targetRate;
    return `<div class="card mt ratecard" id="ratecard"><div><div class="lab">USD/INR today · pilot currency</div><b class="num">${c.rate.toFixed(2)}</b></div>
      <div><div class="lab">vs 20-day average ${c.avg20.toFixed(2)}</div><b class="num ${c.premium >= cfg.alertPct ? "ok" : ""}">${c.premium >= 0 ? "+" : ""}${c.premium.toFixed(2)}%</b></div>
      <div><div class="lab">Volatility (20-day)</div><b class="num">${c.sigma.toFixed(2)}% / day</b></div>
      <div><div class="lab">🎯 Target rate</div><b>${cfg.targetRate ? cfg.targetRate.toFixed(2) + (hit ? " · reached" : " · not reached") : "Off"}</b></div>
      <div><div class="lab">Opportunity alerts</div><b>above +${cfg.alertPct}%</b></div>
      <div style="align-self:center"><button class="link" data-act="nav" data-v="settings">Rate rules ›</button></div></div>`;
  }
  function onboarding() {
    const items = D.obligations.filter((o) => o.kind === "recurring").map((o) => E.obligationView(S, o));
    if (!UI.obOpen) { const live = items.filter((o) => o.status !== "removed"); const conf = live.filter((o) => o.status === "confirmed").length; return `<div class="info mt" id="obinfo">${conf === live.length ? "✓" : "ℹ"} Planning with ${live.length} recurring obligations learned from your history${conf ? ` (${conf} confirmed by you)` : ""}. Next due: ${live.map((o) => ({ o, d: E.nextOccurrence(o, S.date) })).filter((x) => x.d).sort((x, y) => x.d.localeCompare(y.d)).slice(0, 2).map((x) => esc(x.o.name.split(" (")[0]) + " " + SD(x.d)).join(", ")}. <button class="link" data-act="obopen">Review obligations</button></div>`; }
    const rows = items.map((o) => `<tr><td><b>${esc(o.name)}</b><div class="sub">${esc(o.note)}</div></td><td>${o.cadence}</td><td class="r num">${o.seen}x</td><td class="r num">${o.ccy === "INR" ? inrL(o.est) : usd(o.est)}</td><td class="num">${E.nextOccurrence(o, S.date) ? P(E.nextOccurrence(o, S.date)) : "-"}</td><td><span class="chip ${E.band(o.conf).toLowerCase()}" title="${E.band(o.conf)} confidence">● ${E.band(o.conf)} ${o.conf}%</span></td>
      <td>${o.status === "detected" ? `<button class="btn sm" data-act="obconfirm" data-v="${o.id}">Confirm</button> <button class="btn sm ghost" data-act="obedit" data-v="${o.id}">Edit</button> <button class="btn sm ghost danger" data-act="obremove" data-v="${o.id}" title="Remove from plan">✕</button>` : o.status === "removed" ? `<span class="chip low">Removed</span> <button class="link" data-act="obconfirm" data-v="${o.id}">Undo</button>` : `<span class="chip high">✓ Confirmed</span>`}</td></tr>`).join("");
    return `<div class="card mt" id="obcard"><div class="toolbar" style="background:#f7f9ff"><div><b>I analysed 24 months of your Razorpay history and found ${items.length} recurring obligations.</b><div class="sub">Confirm them so I plan with the right numbers. I also found 1 one-off payment I can't predict - I'll ask about it below.</div></div><span style="flex:1"></span>
      <button class="btn primary sm" data-act="obconfirmall">Confirm all</button>${S.onboarded ? ` <button class="btn sm" data-act="obclose">Done</button>` : ""}</div>
      <div class="tablewrap obtable"><table class="t"><thead><tr><th>Obligation</th><th>Cadence</th><th class="r">Seen</th><th class="r">Typical</th><th>Next</th><th>Confidence</th><th></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }
  function recCard(r) {
    const b = bandOf(r).toLowerCase(), fx = E.rate(S.date);
    let action = "";
    if (r.kind === "question") action = `<div class="action"><div><div class="big">${inrL(r.inr)}</div><div class="muted">paid to Coorg Retreats, 14 Nov 2025</div></div><div><div class="muted">If it recurs</div><b>~${P(r.date)}</b></div></div>`;
    else if (r.kind === "hold") action = `<div class="action"><div><div class="big num">Keep ${usd(r.usd)} in USD</div><div class="muted">no conversion - pay bills directly from EEFC</div></div>${r.items.map((i) => `<div><div class="muted">${esc(i.name.split(" (")[0])}</div><b>${usd(i.usd)} · ${SD(i.date)}</b></div>`).join("")}</div>`;
    else if (r.kind === "opportunity") { const c = E.marketContext(S); action = `<div class="action"><div><div class="big num">Convert ${usd(r.usd)} today</div><div class="muted">instead of on ${[...new Set(S.scheduled.filter((x) => (r.pullIds || []).includes(x.id)).map((x) => SD(x.date)))].join(", ")}</div></div><div><div class="muted">USD/INR now</div><b>${c.rate.toFixed(2)}</b></div><div><div class="muted">20-day average</div><b>${c.avg20.toFixed(2)}</b></div><div><div class="muted">Extra vs average</div><b class="ok">≈ ${inrL(r.usd * (c.rate - c.avg20))}</b></div></div>`; }
    else if (r.kind === "alert") action = `<div class="action"><div class="big warn">Shortfall ~${usd(r.usd)}</div></div>`;
    else action = `<div class="action"><div><div class="big num">Convert ${usd(r.usd)}</div><div class="muted">≈ ${inrL(r.usd * fx)} at today's ${fx.toFixed(2)}</div></div><div><div class="muted">${r.tranches.length > 1 ? "Tranches" : "On"}</div><b>${r.tranches.map((t) => (r.tranches.length > 1 ? usd(t.usd) + " · " : "") + P(t.date)).join("<br>")}</b></div>${r.deadline ? `<div><div class="muted">RBI deadline</div><b>${P(r.deadline)}</b></div>` : ""}${r.receipts ? `<div><div class="muted">From</div><b>Incoming receipts</b></div>` : r.sources ? `<div><div class="muted">From</div><b>${r.sources.map((s) => E.monthName(s.bucket)).join(" + ")} balance</b></div>` : ""}</div>`;
    const flag = r.flagged ? flagBox(r) : "";
    const f = r.factors ? `<div class="factors">Confidence drivers: ${[["History", r.factors.history], ["Timing", r.factors.timing], ["Amount", r.factors.amount]].map(([k, v]) => `<span>${k}<span class="bar"><i style="width:${Math.round(v * 100)}%"></i></span></span>`).join("")}</div>` : "";
    let btns = "";
    if (r.kind === "question") btns = `<button class="btn primary" data-act="ans" data-k="${r.key}" data-v="yes">Yes, it recurs</button><button class="btn" data-act="ans" data-k="${r.key}" data-v="no">No</button><button class="btn" data-act="ans" data-k="${r.key}" data-v="unsure">Not sure - keep a buffer</button>`;
    else if (r.kind === "alert") btns = `<span class="sub">Approve or edit the conversions above, or move the payment date.</span>`;
    else if (r.kind === "opportunity") btns = `<button class="btn primary" data-act="approve" data-k="${r.key}">Convert today</button><button class="btn ghost" data-act="skip" data-k="${r.key}">Keep the schedule</button><span class="sp"></span><button class="link" data-act="sendwa" data-k="${r.key}">📱 Send to WhatsApp</button>`;
    else {
      const blocked = !!r.flagged && b !== "high";
      btns = `<button class="btn primary" data-act="approve" data-k="${r.key}" ${blocked ? "disabled title='Confirm the flagged input first'" : ""}>${r.kind === "locked" || r.kind === "deadline" ? "Schedule" : "Approve"}</button>
        <button class="btn" data-act="edit" data-k="${r.key}">Edit</button>
        ${r.kind === "locked" || r.kind === "deadline" ? `<span class="sub">Can't be skipped - executes automatically on ${P(r.kind === "locked" ? r.date : r.tranches[r.tranches.length - 1].date)} if not scheduled</span>` : `<button class="btn ghost" data-act="skip" data-k="${r.key}">Skip</button>`}
        <span class="sp"></span><button class="link" data-act="sendwa" data-k="${r.key}">📱 Send to WhatsApp</button>`;
    }
    return `<div class="card rec ${b}" data-key="${r.key}"><div class="top">${r.kind === "alert" ? '<span class="chip low">⚠ Alert</span>' : chip(r)}<span class="kind">${kindLabel[r.kind]}</span></div>
      <h3>${esc(r.title)}</h3>${action}<ul class="why">${r.drivers.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>${f}${flag}<div class="btns">${btns}</div></div>`;
  }
  function flagBox(r) {
    const fl = r.flagged;
    if (fl.type === "amount") return `<div class="flag"><b>⚠ Check this input:</b> ${esc(fl.why)}<div class="row">${esc(fl.label)}: <input type="number" id="flag-${cssId(r.key)}" value="${fl.value}"> <button class="btn sm" data-act="flagok" data-k="${r.key}">Confirm amount</button></div></div>`;
    return `<div class="flag"><b>⚠ Check this input:</b> ${esc(fl.why)}<div class="row">${fl.items.map((i) => `${esc(i.client)} ${usd(i.usd)} ~${SD(i.date)}`).join(" · ")}</div><div class="row">${esc(fl.label)} <button class="btn sm" data-act="flagrc" data-k="${r.key}" data-v="yes">Yes, on time</button><button class="btn sm ghost" data-act="flagrc" data-k="${r.key}" data-v="unsure">Not sure</button></div></div>`;
  }
  const cssId = (k) => k.replace(/[^a-z0-9]/gi, "_");
  function scheduledList() {
    const sch = S.scheduled.filter((x) => !x.executed).sort((a, b) => a.date.localeCompare(b.date));
    const holds = S.holds.filter((h) => !h.released);
    const dec = S.metrics.decisions.slice().reverse().slice(0, 8);
    const fx = E.rate(S.date);
    const rowsS = sch.map((x) => { const L = E.schedLimits(S, x.id); return `<tr><td class="num">${P(x.date)}${x.modified ? ' <span class="chip neutral">changed</span>' : ""}</td><td><b>Convert ${usd(x.usd)}</b><div class="sub">≈ ${inrL(x.usd * fx)} at today's rate</div></td><td class="sub">${esc(x.rationale)}${L && L.latest < E.END ? `<div>RBI deadline: by ${SD(L.latest)}</div>` : ""}</td>
      <td class="acts"><button class="btn sm" data-act="schedit" data-v="${esc(x.id)}">Edit</button><button class="btn sm" data-act="schnow" data-v="${esc(x.id)}">Execute now</button><button class="btn sm ghost danger" data-act="schcancel" data-v="${esc(x.id)}">Cancel</button></td></tr>`; }).join("");
    const rowsH = holds.map((h) => `<tr><td class="num">Hold</td><td><b>${usd(h.remainingUsd)} in USD</b><div class="sub">no conversion</div></td><td class="sub">${h.items.map((i) => esc(i.name.split(" (")[0]) + " " + SD(i.date)).join(", ")}</td>
      <td class="acts"><button class="btn sm" data-act="holdedit" data-v="${esc(h.key)}">Edit</button><button class="btn sm ghost danger" data-act="holdrelease" data-v="${esc(h.key)}">Release</button></td></tr>`).join("");
    return `<div class="grid mt2" style="gap:14px"><div class="card ${UI.flash ? "flash" : ""}" id="pending-card"><div class="toolbar"><b>Approved & waiting to execute</b><span class="sub">${sch.length + holds.length} item${sch.length + holds.length === 1 ? "" : "s"}</span></div><table class="t"><tbody>
      ${rowsS}${rowsH}
      ${!sch.length && !holds.length ? '<tr><td class="sub empty">Nothing approved yet. Approved conversions and holds appear here until they execute - you can still edit, execute or cancel them.</td></tr>' : ""}</tbody></table></div>
      <div class="card" id="decisions-card"><div class="toolbar"><b>Your recent decisions</b><span class="sub">${S.metrics.decisions.length} total</span></div><table class="t"><tbody>${dec.map((d) => `<tr><td class="num">${SD(d.date)}</td><td>${esc(d.action.replace("answered:", "answered: "))}</td><td class="sub">${esc(d.title || d.key)} · ${esc(d.channel)}</td></tr>`).join("") || '<tr><td class="sub empty">No decisions yet. Approvals, edits, skips and answers - from the dashboard or WhatsApp - are listed here.</td></tr>'}</tbody></table></div></div>`;
  }
  function authSimple(title, sub, onDone) {
    modal(`<h2>${esc(title)}</h2><div class="sub">${sub}</div><div class="fp" id="fp" data-act="fp">☝︎</div><div class="note" style="text-align:center" id="fpnote">Touch to authenticate as Rohan Mehta</div><div class="foot"><button class="btn" data-act="mclose">Cancel</button></div>`);
    PENDING = () => { const fp = document.getElementById("fp"); fp.classList.add("scan"); document.getElementById("fpnote").textContent = "Verifying…"; setTimeout(() => { fp.classList.remove("scan"); fp.classList.add("ok"); fp.textContent = "✓"; setTimeout(() => { closeModal(); onDone(); }, 500); }, 800); };
  }
  function schedEditModal(id) {
    const L = E.schedLimits(S, id); if (!L) return; const x = L.x;
    modal(`<h2>Change approved conversion</h2><div class="sub">${esc(x.rationale)} · approved ${SD(x.approvedOn || S.date)}</div>
      <div class="row"><div><label>Amount (USD)</label><input type="number" id="se-u" value="${Math.round(x.usd)}" step="100"></div><div><label>Execution date</label><input type="date" id="se-d" value="${x.date}" min="${S.date}" max="${L.latest}"></div></div>
      <div class="note">Up to ${usd(L.maxUsd)} available · ${L.latest < E.END ? `must execute by ${P(L.latest)} (RBI deadline)` : "any date before the payment"} · today's date executes immediately.</div><div id="se-msg"></div>
      <div class="foot"><button class="btn" data-act="mclose">Cancel</button><button class="btn primary" data-act="scheditok" data-v="${esc(id)}">Continue to authenticate</button></div>`);
  }
  function holdEditModal(key) {
    const h = S.holds.find((z) => z.key === key && !z.released); if (!h) return;
    modal(`<h2>Change hold</h2><div class="sub">USD kept for ${h.items.map((i) => esc(i.name.split(" (")[0]) + " (" + SD(i.date) + ")").join(", ")}</div>
      <label style="margin-top:10px">Amount to hold (USD)</label><input type="number" id="he-u" value="${Math.round(h.remainingUsd)}" step="100"><div id="he-msg"></div>
      <div class="foot"><button class="btn" data-act="mclose">Cancel</button><button class="btn primary" data-act="holdeditok" data-v="${esc(key)}">Continue to authenticate</button></div>`);
  }

  // ---------- REPORTS ----------
  function reports() {
    const tab = UI.reportTab;
    let body = "";
    if (tab === "audit") {
      const rows = S.audit.slice().reverse().map((a) => `<tr><td class="num">${SD(a.date)} ${a.time}</td><td>${esc(a.actor)}</td><td><b>${esc(a.event)}</b>${a.band ? ` ${chip({ conf: a.conf, kind: a.band === "Locked" ? "locked" : "x" })}` : ""}<div class="sub">${esc(a.detail)}</div>${a.rationale ? `<details><summary class="sub" style="cursor:pointer">Agent rationale</summary><div class="sub">${esc(a.rationale).split(" | ").join("<br>")}</div></details>` : ""}</td>
        <td class="r num">${a.usd != null ? usd2(a.usd) : ""}</td><td class="r num">${a.rate ? a.rate.toFixed(4) : ""}</td><td class="r num">${a.inr != null ? inr(a.inr) : ""}</td><td>${a.bucket ? E.monthName(a.bucket.split("+")[0]) : ""}</td><td class="sub">${esc(a.auth || "")}</td></tr>`).join("");
      body = `<div class="card" id="auditcard"><div class="toolbar"><b>Audit log</b><span class="sub">Every conversion with its rationale, rate, approval and authentication</span><span style="flex:1"></span><button class="btn sm" data-act="csv">⬇ Export for CA (CSV)</button></div>
        <div class="tablewrap"><table class="t"><thead><tr><th>When</th><th>Actor</th><th>Event</th><th class="r">USD</th><th class="r">Rate</th><th class="r">INR</th><th>Bucket</th><th>Authentication</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    } else if (tab === "comp") {
      const conv = D.convHist.filter((c) => c.date >= D.meta.eefcStart).map((c) => ({ ...c, by: "Manual" })).concat(S.newConv.map((c) => ({ ...c, by: c.type.startsWith("Auto") ? "Guardrail" : "Agent plan" })));
      const rows = S.buckets.map((b) => {
        const by = (k) => conv.filter((c) => c.bucket.split("+").includes(b.id) && c.by === k).reduce((s, c) => s + c.usd, 0);
        const st = b.remaining < 0.5 ? (b.autoConverted > 0 ? '<span class="chip medium">Compliant · guardrail used</span>' : '<span class="chip high">✓ Compliant</span>') : b.deadline < S.date ? '<span class="chip low">Overdue</span>' : `<span class="chip neutral">Open · due ${SD(b.deadline)}</span>`;
        return `<tr><td>${E.monthName(b.id)}</td><td class="r num">${usd2(b.received)}</td><td class="r num">${usd2(b.used)}</td><td class="r num">${usd(by("Manual"))}</td><td class="r num">${usd(by("Agent plan"))}</td><td class="r num">${usd(by("Guardrail"))}</td><td class="r num">${usd2(b.remaining)}</td><td class="num">${P(b.deadline)}</td><td>${st}</td></tr>`;
      }).join("");
      body = `<div class="card" id="compcard"><div class="toolbar"><b>EEFC compliance summary</b><span class="sub">RBI Master Direction - Deposits and Accounts, EEFC conversion rule</span></div><div class="tablewrap"><table class="t"><thead><tr><th>Bucket</th><th class="r">Received</th><th class="r">Used for payments</th><th class="r">Converted · manual</th><th class="r">· agent plan</th><th class="r">· guardrail</th><th class="r">Remaining</th><th>Deadline</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    } else {
      const c = D.convHist.map((x) => ({ ...x, src: "history" })).concat(S.newConv.map((x) => ({ ...x, src: "new" }))).reverse();
      body = `<div class="card"><div class="toolbar"><b>All conversions</b></div><div class="tablewrap"><table class="t"><thead><tr><th>Date</th><th>Type</th><th class="r">USD</th><th class="r">Approved at</th><th class="r">Executed at</th><th class="r">INR</th><th>Bucket</th></tr></thead><tbody>${c.map((x) => `<tr class="${x.src === "new" ? "new" : ""}"><td class="num">${SD(x.date)} ${x.date.slice(0, 4)}</td><td>${esc(x.type)}</td><td class="r num">${usd2(x.usd)}</td><td class="r num">${x.approvedRate ? x.approvedRate.toFixed(4) + `<div class="sub">${SD(x.approvedOn)}</div>` : "-"}</td><td class="r num">${x.rate.toFixed(4)}</td><td class="r num">${inr(x.inr)}</td><td>${x.bucket ? E.monthName(x.bucket.split("+")[0]) : "-"}</td></tr>`).join("")}</tbody></table></div></div>`;
    }
    return `<div class="ph"><div><h1>Reports & audit log</h1><p>Audit-grade record for your CA and statutory audit.</p></div></div>
      <div class="tabs"><button class="${tab === "audit" ? "on" : ""}" data-act="rtab" data-v="audit">Audit log</button><button class="${tab === "comp" ? "on" : ""}" data-act="rtab" data-v="comp">EEFC compliance</button><button class="${tab === "conv" ? "on" : ""}" data-act="rtab" data-v="conv">Conversions</button></div>${body}`;
  }
  function exportCsv() {
    const head = ["Date", "Time", "Actor", "Event", "Detail", "USD", "Rate", "INR", "Bucket", "Authentication", "Rationale"];
    const lines = [head.join(",")].concat(S.audit.map((a) => [a.date, a.time, a.actor, a.event, a.detail, a.usd != null ? a.usd.toFixed(2) : "", a.rate ? a.rate.toFixed(4) : "", a.inr != null ? Math.round(a.inr) : "", a.bucket || "", a.auth || "", a.rationale || ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")));
    try { const blob = new Blob([lines.join("\n")], { type: "text/csv" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "fx-strategist-audit-log.csv"; document.body.appendChild(a); a.click(); a.remove(); toast("Audit log exported"); }
    catch (e) { toast("Export isn't available in this preview"); }
  }

  // ---------- SETTINGS ----------
  function settings() {
    const st = S.settings;
    return `<div class="ph"><div><h1>Settings</h1><p>FX Strategist controls. Changes re-plan immediately.</p></div></div>
      <div class="grid g2">
        <div class="card pad"><h3>Planning guardrails</h3>
          <div class="modal" style="box-shadow:none;padding:0;width:auto">
          <label>Minimum INR buffer in current account (₹)</label><input type="number" id="set-buffer" value="${st.buffer}" step="50000">
          <label style="margin-top:10px">Maximum single conversion (USD) - larger amounts are split into tranches</label><input type="number" id="set-tranche" value="${st.maxTranche}" step="1000">
          <label style="margin-top:10px">Second approver needed above (₹)</label><input type="number" id="set-co" value="${st.coApproveInr}" step="100000">
          <div class="foot" style="justify-content:flex-start"><button class="btn primary" data-act="saveset">Save changes</button></div></div></div>
        <div class="card pad" id="fxrules"><h3>Rate rules (optional)</h3><div class="sub">The agent never predicts rates. These rules let you act on your own view and limit timing risk.</div>
          <div class="modal" style="box-shadow:none;padding:0;width:auto">
          <label style="margin-top:10px">🎯 Target rate - approved tranches convert early if USD/INR reaches it (blank = off)</label><input type="number" id="set-target" value="${st.targetRate || ""}" step="0.05" placeholder="e.g. 89.00">
          <label style="margin-top:10px">📈 Opportunity alert when USD/INR is this far above its 20-day average (%)</label><input type="number" id="set-alert" value="${E.cfgOf(S).alertPct}" step="0.1">
          <label style="margin-top:10px">Volatility risk budget per tranche (%) - lower = more, smaller tranches</label><input type="number" id="set-budget" value="${E.cfgOf(S).riskBudget}" step="0.05">
          <div class="row"><div><label>Max tranches</label><input type="number" id="set-maxn" value="${E.cfgOf(S).maxTranches}" min="1" max="10"></div><div><label>Min tranche (USD)</label><input type="number" id="set-mint" value="${E.cfgOf(S).minTranche}" step="1000"></div></div>
          <div class="info" style="margin-top:8px">Tranches = max( ⌈σ<sub>daily</sub> × √H ÷ risk budget⌉ , ⌈amount ÷ max tranche size⌉ ), capped by max tranches, min tranche size and business days H in the window; spread evenly so the last one lands before the payment or deadline.</div>
          <div class="foot" style="justify-content:flex-start"><button class="btn primary" data-act="saverules">Save rate rules</button></div></div></div>
        <div class="card pad"><h3>Approvals</h3>
          <table class="t"><tbody><tr><td><b>Rohan Mehta</b><div class="sub">Founder · primary approver</div></td><td>Passkey / biometric</td></tr><tr><td><b>Ananya Rao</b><div class="sub">Finance Head · co-approver above ${inrL(st.coApproveInr)}</div></td><td>Passkey / biometric</td></tr></tbody></table>
          <div class="info mt" id="autoexec">🔒 <b>Auto-execute conversions: not available.</b> Every conversion needs an authenticated approval - by design. The only automatic action is the RBI deadline guardrail.</div></div>
        <div class="card pad"><h3>Notifications</h3>
          ${[["whatsapp", "WhatsApp (approve from phone)"], ["email", "Email summary"], ["slack", "Slack (#finance)"]].map(([k, l]) => `<label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" data-act="notif" data-v="${k}" ${st.notify[k] ? "checked" : ""}> ${l}</label>`).join("")}
          <div class="sub">A notification can only open the app - approval always happens inside Razorpay with authentication.</div></div>
        <div class="card pad"><h3>Data the agent uses</h3><ul class="why" style="padding-left:18px;color:var(--ink-2)"><li>Razorpay payments, settlements and EEFC ledger (24 months)</li><li>Payouts and current-account debits</li><li>Your confirmations and edits (to learn your preferences)</li><li>USD/INR live rate (context only - no rate prediction)</li></ul><div class="sub" style="margin-bottom:6px"><b>Currencies:</b> USD in the pilot. EUR, GBP, AED and SGD (already held by the EEFC account) in v2, adding currency-matched bill payments and per-currency volatility.</div><div class="sub">Connectors such as Tally or QuickBooks could add payables not paid through Razorpay (roadmap).</div></div>
      </div>`;
  }

  // ---------- OUTCOMES (internal) ----------
  function outcomes() {
    const o = E.outcomes(S);
    const acted = o.approved + o.edited + o.skipped;
    const pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "-");
    const fc = o.forecasts.slice().reverse().map((f) => `<tr><td>${esc(f.name)}</td><td>${f.kind}</td><td class="r num">${f.kind === "receipt" ? SD(f.expected) : f.ccy === "USD" ? usd(f.expected) : inrL(f.expected)}</td><td class="r num">${f.kind === "receipt" ? SD(f.actual) : f.ccy === "USD" ? usd(f.actual) : inrL(f.actual)}</td><td class="r num">${f.kind === "receipt" ? (f.errDays > 0 ? "+" : "") + f.errDays + "d" : (f.err * 100).toFixed(1) + "%"}</td><td>${chip({ conf: f.conf, kind: "x" })}</td><td>${f.hit ? '<span class="chip high">✓ within range</span>' : '<span class="chip low">✗ outside</span>'}</td></tr>`).join("");
    return `<div class="crumb">Internal View (Razorpay only) · product analytics</div><div class="ph"><div><h1>FX Strategist outcomes</h1><p>Merchant: Lumio Analytics · pilot period from ${P(D.meta.today)}. In production these aggregate across the exporter cohort.</p></div></div>
      <div class="grid g3" id="northstar">
        <div class="card pad kpi"><div class="lab">North star · avoided FX costs since EEFC</div><div class="val num ok">${inrL(o.avoided)}</div><div class="foot">USD bills paid from EEFC instead of buying USD at ~3% card markup</div></div>
        <div class="card pad kpi"><div class="lab">Rate timing effect vs convert-at-settlement</div><div class="val num ${o.rateEffect < 0 ? "warn" : "ok"}">${o.rateEffect >= 0 ? "+" : ""}${inrL(o.rateEffect)}</div><div class="foot">Reported separately - not claimed as agent skill</div></div>
        <div class="card pad kpi"><div class="lab">Baseline · before EEFC (22 months)</div><div class="val num">${inrL(D.meta.historicalAvoidable)}</div><div class="foot">Avoidable FX cost (~${inrL(D.meta.historicalAnnual)}/yr) the merchant paid</div></div>
      </div>
      ${(() => { const tr = o.triggers || []; const m = tr.filter((t) => t.measured); const g = m.reduce((s, t) => s + t.gain, 0); return `<div class="card pad mt kpi"><div class="lab">Rate rules · target-rate & opportunity conversions vs their original schedule</div><div class="val num ${g < 0 ? "warn" : "ok"}">${tr.length ? (g >= 0 ? "+" : "") + inrL(g) : "-"}</div><div class="foot">${tr.length ? `${tr.length} tranche(s) converted early · ${m.length} measured once the original date passed. Can be negative - tracked to tune alert thresholds, never claimed as prediction.` : "No rate-triggered conversions yet"}</div></div>`; })()}
      <div class="grid g4 mt">
        <div class="card pad kpi"><div class="lab">Recommendations shown</div><div class="val">${o.shown}</div><div class="foot">${o.ignored} not acted on</div></div>
        <div class="card pad kpi"><div class="lab">Approved without edit</div><div class="val">${pct(o.approved, acted)}</div><div class="foot">${o.approved} approved · ${o.edited} edited · ${o.skipped} skipped</div></div>
        <div class="card pad kpi"><div class="lab">Decisions by channel</div><div class="val">${o.channels.mobile} / ${o.channels.dashboard}</div><div class="foot">Mobile (WhatsApp → app) / dashboard</div></div>
        <div class="card pad kpi"><div class="lab">Questions answered</div><div class="val">${o.answered}</div><div class="foot">Low-confidence items resolved by asking</div></div>
      </div>
      <div class="grid g3 mt">
        <div class="card pad kpi"><div class="lab">Guardrail · RBI deadline misses</div><div class="val ${o.deadlineMisses ? "warn" : "ok"}">${o.deadlineMisses}</div><div class="foot">Target: zero</div></div>
        <div class="card pad kpi"><div class="lab">Guardrail · auto-conversions at deadline</div><div class="val ${o.guardrail.length ? "warn" : ""}">${o.guardrail.length}</div><div class="foot">${o.guardrail.map((g) => E.monthName(g.bucket) + " " + usd(g.usd)).join(", ") || "Plan executed before deadlines"}</div></div>
        <div class="card pad kpi"><div class="lab">Guardrail · INR shortfalls</div><div class="val ${o.shortfalls.length ? "warn" : "ok"}">${o.shortfalls.length}</div><div class="foot">${o.shortfalls.map((s) => SD(s.date) + " " + s.payee).join(", ") || "No payment ran short"}</div></div>
      </div>
      <div class="grid g2 mt">
        <div class="card"><div class="toolbar"><b>Confidence calibration</b><span class="sub">Are "High" forecasts right ≥80% of the time?</span></div><table class="t"><thead><tr><th>Band</th><th class="r">Forecasts resolved</th><th class="r">Within range</th><th class="r">Hit rate</th></tr></thead><tbody>
          ${o.bands.map((b) => `<tr><td>${chip({ conf: b.band === "High" ? 90 : b.band === "Medium" ? 65 : 30, kind: "x" }).replace(/ confidence · \d+%/, "")}</td><td class="r num">${b.n}</td><td class="r num">${b.hits}</td><td class="r num">${pct(b.hits, b.n)}</td></tr>`).join("")}</tbody></table>
          <div class="pager">Move the demo date forward to resolve more forecasts.</div></div>
        <div class="card"><div class="toolbar"><b>Adoption (cohort view)</b></div><table class="t"><tbody>
          <tr><td>Exporters with EEFC settlement enabled</td><td class="sub">cohort metric · n/a in single-merchant demo</td></tr>
          <tr><td>% of them who turned on FX Strategist</td><td class="sub">cohort metric</td></tr>
          <tr><td>% of generated plans acted on</td><td class="r num">${pct(acted, o.shown)}</td></tr>
          <tr><td>Conversions executed since EEFC</td><td class="r num">${o.convCount}</td></tr></tbody></table></div>
      </div>
      <div class="card mt"><div class="toolbar"><b>Forecast accuracy</b><span class="sub">Feeds model recalibration</span></div><div class="tablewrap"><table class="t"><thead><tr><th>Item</th><th>Type</th><th class="r">Forecast</th><th class="r">Actual</th><th class="r">Error</th><th>Band</th><th>Result</th></tr></thead><tbody>${fc || '<tr><td colspan="7" class="sub">No forecasts resolved yet - advance the demo date.</td></tr>'}</tbody></table></div></div>`;
  }

  // ---------- modals (desktop) ----------
  function modal(html) { document.getElementById("modal-root").innerHTML = `<div class="overlay" data-act="mclose-bg"><div class="modal">${html}</div></div>`; }
  function closeModal() { document.getElementById("modal-root").innerHTML = ""; }
  const findRec = (k) => recs().find((r) => r.key === k);
  function authFlow(rec, opts, onDone, inPhone) {
    const fx = E.rate(S.date);
    const tr = (opts && opts.tranches) || rec.tranches || [];
    const tot = rec.kind === "hold" ? (opts && opts.items ? opts.items : rec.items).reduce((s, i) => s + i.usd, 0) : tr.reduce((s, t) => s + t.usd, 0);
    const co = rec.kind !== "hold" && tot * fx > S.settings.coApproveInr;
    modal(`<h2>Confirm with passkey</h2><div class="sub">${rec.kind === "hold" ? `Hold ${usd(tot)} in EEFC for upcoming USD bills` : `Convert ${usd(tot)} (≈ ${inrL(tot * fx)}) · ${tr.map((t) => P(t.date)).join(", ")}`}</div>
      <div class="fp" id="fp" data-act="fp">☝︎</div><div class="note" style="text-align:center" id="fpnote">Touch to authenticate as Rohan Mehta</div><ul class="steps" id="steps"></ul>
      <div class="foot"><button class="btn" data-act="mclose">Cancel</button></div>`);
    PENDING = () => {
      const fp = document.getElementById("fp"); fp.classList.add("scan"); document.getElementById("fpnote").textContent = "Verifying…";
      setTimeout(() => {
        fp.classList.remove("scan"); fp.classList.add("ok"); fp.textContent = "✓"; document.getElementById("fpnote").textContent = "Authenticated";
        const steps = document.getElementById("steps");
        steps.innerHTML = `<li>✅ Rohan Mehta approved (passkey)</li>${co ? `<li id="co">⏳ Waiting for co-approver Ananya Rao (above ${inrL(S.settings.coApproveInr)})…</li>` : ""}`;
        const fin = () => { closeModal(); onDone(); };
        if (co) setTimeout(() => { document.getElementById("co").textContent = "✅ Ananya Rao co-approved (simulated)"; setTimeout(fin, 700); }, 1300); else setTimeout(fin, 600);
      }, 900);
    };
  }
  let PENDING = null;
  function editModal(rec, fromPhone) {
    const fx = E.rate(S.date);
    const { free } = E.supply(S);
    const avail = Object.values(free).reduce((s, v) => s + v, 0);
    let body = "";
    if (rec.kind === "hold") body = rec.items.map((i, k) => `<div class="row"><div><label>${esc(i.name)} · due ${SD(i.date)}</label><input type="number" id="ed-u-${k}" value="${i.usd}" step="100"></div><div></div></div>`).join("");
    else body = rec.tranches.map((t, k) => `<div class="row"><div><label>Tranche ${k + 1} amount (USD)</label><input type="number" id="ed-u-${k}" value="${Math.round(t.usd)}" step="100" ${rec.kind === "locked" ? "disabled" : ""}></div><div><label>Date</label><input type="date" id="ed-d-${k}" value="${t.date}" min="${S.date}" max="${rec.kind === "locked" || rec.kind === "deadline" ? E.addDays(rec.deadline, 0) : E.END}"></div></div>`).join("");
    modal(`<h2>Edit: ${esc(rec.title)}</h2>${rec.kind === "locked" ? '<div class="note">Amount is fixed by the RBI rule (the unused balance). You can only move the date earlier.</div>' : ""}
      ${body}<div id="ed-msg"></div>
      <div class="note">The agent will re-plan everything after this decision.</div>
      <div class="foot"><button class="btn" data-act="mclose">Cancel</button><button class="btn primary" data-act="edsave" data-k="${rec.key}">Continue to approve</button></div>`);
    const msg = () => {
      const vals = readEdit(rec); const el = document.getElementById("ed-msg"); if (!el) return;
      el.innerHTML = vals.err ? `<div class="err">${vals.err}</div>` : vals.warn ? `<div class="note">⚠ ${vals.warn}</div>` : `<div class="note">Total ${usd(vals.total)}${rec.kind === "hold" ? "" : ` ≈ ${inrL(vals.total * fx)}`}</div>`;
    };
    EDIT_AVAIL = avail + (rec.kind === "hold" ? 0 : rec.usd);
    document.querySelectorAll(".modal input").forEach((i) => i.addEventListener("input", msg)); msg();
  }
  let EDIT_AVAIL = 0;
  function readEdit(rec) {
    if (rec.kind === "hold") {
      const items = rec.items.map((i, k) => ({ ...i, usd: Number(document.getElementById("ed-u-" + k).value) }));
      const total = items.reduce((s, i) => s + i.usd, 0);
      if (items.some((i) => !(i.usd >= 0))) return { err: "Enter valid amounts" };
      return { items, total, warn: items.some((i, k) => i.usd < rec.items[k].usd * 0.86) ? "Below the expected bill range - any shortfall would be paid by card at ~3% markup." : null };
    }
    const tranches = rec.tranches.map((t, k) => ({ usd: rec.kind === "locked" ? t.usd : Number(document.getElementById("ed-u-" + k).value), date: document.getElementById("ed-d-" + k).value }));
    const total = tranches.reduce((s, t) => s + t.usd, 0);
    const maxD = rec.kind === "locked" || rec.kind === "deadline" ? rec.deadline : E.END;
    if (tranches.some((t) => !(t.usd > 0))) return { err: "Amounts must be greater than zero" };
    if (tranches.some((t) => !t.date || t.date < S.date)) return { err: "Dates can't be in the past" };
    if (tranches.some((t) => t.date > maxD)) return { err: `Must be on or before ${P(maxD)}${rec.deadline ? " (RBI deadline)" : ""}` };
    if (rec.kind !== "topup" && total > EDIT_AVAIL + 1) return { err: `Only ${usd(EDIT_AVAIL)} of EEFC balance is free to convert` };
    const warn = total < rec.usd - 1 ? `${usd(rec.usd - total)} less than recommended - the agent will propose a top-up or flag a shortfall.` : total > rec.usd + 1 ? `${usd(total - rec.usd)} more than needed - less USD left for later needs.` : null;
    return { tranches, total, warn };
  }

  // ---------- actions ----------
  function doApprove(rec, opts, channel) {
    E.approve(S, rec, { ...(opts || {}), channel });
    toast(rec.kind === "hold" ? "Hold approved - bills will be paid from EEFC" : "Approved - conversion scheduled. Plan updated.");
    render();
  }
  function startApprove(key, opts) {
    const rec = findRec(key); if (!rec) return;
    authFlow(rec, opts, () => doApprove(rec, opts, "Dashboard"));
  }

  // ---------- PHONE ----------
  function phoneRec() {
    const a = activeRecs().filter((r) => r.kind !== "alert" && r.kind !== "deadline");
    if (UI.phone.key) { const r = a.find((x) => x.key === UI.phone.key); if (r) return r; }
    return a[0] || null;
  }
  function renderPhone() {
    const el = document.getElementById("phone");
    el.className = UI.phoneOpen ? "open" : "";
    if (!UI.phoneOpen) { el.innerHTML = ""; return; }
    const r = phoneRec();
    const ps = UI.phone;
    let inner = "";
    const sbar = (dark) => `<div class="sbar" style="color:${dark ? "#fff" : "#111"}"><span>9:41</span><span>▂▄▆ 5G ▮</span></div>`;
    const fx = E.rate(S.date);
    const line = (rec) => rec.kind === "opportunity" ? `USD/INR is ${E.marketContext(S).premium.toFixed(2)}% above its 20-day average - convert ${usd(rec.usd)} of approved tranches today?` : rec.kind === "question" ? `Will the team offsite (₹${E.lakh(rec.inr)}) recur this November?` : rec.kind === "hold" ? `Keep ${usd(rec.usd)} in USD for ${rec.items.map((i) => i.name.split(" (")[0]).join(" & ")}` : `Convert ${usd(rec.usd)} (≈ ${inrL(rec.usd * fx)}) on ${P(rec.tranches[0].date)}`;
    if (ps.screen === "home") {
      inner = `<div class="lock">${sbar(true)}<div class="clock">9:41</div><div class="ldate">${P(S.date)}</div>
        ${r && S.settings.notify.whatsapp ? `<div class="notif" data-act="ph" data-v="wa"><div class="napp"><span class="wa-ic">✆</span>WhatsApp · now</div><b>Razorpay Business</b><div>${r.kind === "question" ? "❓ Quick question: " : r.kind === "locked" ? "🔒 Deadline: " : "✦ FX Strategist: "}${esc(line(r))}</div></div>` : `<div class="ph-empty">${S.settings.notify.whatsapp ? "No new notifications" : "WhatsApp notifications are off in Settings"}</div>`}</div>`;
    } else if (ps.screen === "wa") {
      const chat = ps.chat.map((c) => `<div class="bub ${c.me ? "me" : ""}">${c.html}<div class="time">${c.t || "9:41"}</div></div>`).join("");
      let msg = "", qr = "";
      if (r) {
        msg = `<div class="bub"><b>${r.kind === "question" ? "❓ FX Strategist has a question" : r.kind === "locked" ? "🔒 RBI deadline · action required" : "✦ FX Strategist recommendation"}</b><br>${esc(line(r))}<br><br>${r.kind === "question" ? "Paid once to Coorg Retreats on 14 Nov 2025 - I can't tell if it repeats." : esc(r.drivers[0])}<br><br>${r.kind === "locked" || r.kind === "question" ? "" : `Confidence: <b>${E.band(r.conf)} · ${r.conf}%</b>`}<div class="time">9:41</div></div>`;
        qr = r.kind === "question" ? `<div class="qr"><button data-act="phans" data-v="yes">Yes, it recurs</button><button data-act="phans" data-v="no">No</button><button data-act="phans" data-v="unsure">Not sure</button></div>`
          : `<div class="qr"><button data-act="ph" data-v="app">✅ Approve</button><button data-act="ph" data-v="appedit">✏️ Edit</button>${r.kind === "locked" ? "" : `<button data-act="phskip">⏭ Skip</button>`}</div><div class="sub" style="font-size:11px">Buttons open the Razorpay app to authenticate</div>`;
      } else msg = `<div class="bub">✓ You're all caught up. I'll message you when a decision is needed.</div>`;
      inner = `<div class="wa"><div class="sbar" style="background:#075e54;color:#fff"><span>9:41</span><span>▂▄▆ 5G ▮</span></div><div class="head"><button class="link" style="color:#fff" data-act="ph" data-v="home">‹</button><div class="av">R</div><div><b>Razorpay Business</b><div style="font-size:11px;opacity:.85">Verified business account</div></div></div>
        <div class="body">${chat}${msg}${qr}</div></div>`;
    } else {
      const bg = `<div class="ahead">${sbar(true).replace('class="sbar"', 'class="sbar" style="padding:0;color:#fff"')}<small>Razorpay · Lumio Analytics</small><div style="font-size:20px;font-weight:700;margin-top:4px">${inr(S.inr)}</div><small>INR current account</small></div>
        <div class="tiles"><div class="tile">EEFC<b>${usd(eefcTotal())}</b></div><div class="tile">Scheduled<b>${usd(schedTotal())}</b></div><div class="tile">Held<b>${usd(heldTotal())}</b></div><div class="tile">USD/INR<b>${fx.toFixed(2)}</b></div></div>`;
      let sheet = "";
      if (!r && ps.screen !== "done") sheet = `<div class="sheet"><h4>Nothing to approve</h4><div class="btns"><button data-act="ph" data-v="wa">Back to WhatsApp</button></div></div>`;
      else if (ps.screen === "app") {
        const blocked = r.flagged && E.band(r.conf, r.kind) !== "High";
        sheet = `<div class="sheet">${chip(r)}<h4>${esc(r.title)}</h4><div class="amt num">${r.kind === "hold" ? "Hold " + usd(r.usd) : "Convert " + usd(r.usd)}</div><div class="sub">${r.kind === "hold" ? "Pay bills directly from EEFC" : "≈ " + inrL(r.usd * fx) + " · " + r.tranches.map((t) => SD(t.date)).join(", ")}</div>
          <ul class="why" style="padding-left:16px;margin:8px 0 0;font-size:12px;color:var(--ink-2)">${r.drivers.slice(0, 2).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
          ${blocked ? `<div class="flag" style="font-size:12px"><b>Check:</b> ${esc(r.flagged.label)}${r.flagged.type === "amount" ? `<input type="number" id="phflag" value="${r.flagged.value}" style="width:100%;margin-top:6px"><div class="btns"><button data-act="phflag">Confirm amount</button></div>` : `<div class="btns"><button data-act="phflagrc" data-v="yes">Yes, on time</button></div>`}</div>` : ""}
          <div class="btns"><button class="primary" data-act="ph" data-v="bio" ${blocked ? "disabled style='opacity:.45'" : ""}>Approve</button><button data-act="ph" data-v="edit">Edit</button>${r.kind === "locked" ? "" : `<button data-act="phskip">Skip</button>`}</div></div>`;
      } else if (ps.screen === "edit") {
        const items = r.kind === "hold" ? r.items.map((i, k) => `<label>${esc(i.name.split(" (")[0])} (USD)</label><input type="number" id="phe-u-${k}" value="${(ps.edit && ps.edit[k]) || i.usd}" step="100">`).join("")
          : r.tranches.map((t, k) => `<label>${r.tranches.length > 1 ? "Tranche " + (k + 1) + " " : ""}Amount (USD)</label><input type="number" id="phe-u-${k}" value="${Math.round(t.usd)}" step="100" ${r.kind === "locked" ? "disabled" : ""}><label>Date</label><input type="date" id="phe-d-${k}" value="${t.date}" min="${S.date}" max="${r.deadline || E.END}">`).join("");
        sheet = `<div class="sheet"><h4>Edit amount</h4>${items}<div id="phe-msg" class="err"></div><div class="btns"><button class="primary" data-act="pheditok">Continue</button><button data-act="ph" data-v="app">Back</button></div></div>`;
      } else if (ps.screen === "bio") {
        sheet = `<div class="sheet" style="text-align:center"><h4>Confirm it's you</h4><div class="sub">${ps.edit ? "Edited: " : ""}${r.kind === "hold" ? "Hold " + usd(ps.total || r.usd) : "Convert " + usd(ps.total || r.usd)}</div><div class="fp" id="phfp" data-act="phbio">☝︎</div><div class="sub" id="phfpn">Touch the sensor</div></div>`;
      } else if (ps.screen === "done") {
        sheet = `<div class="sheet" style="text-align:center"><div class="fp ok">✓</div><h4>${esc(ps.doneTitle || "Done")}</h4><div class="sub">${esc(ps.doneSub || "")}</div><ul class="steps" style="text-align:left">${(ps.doneSteps || []).map((s) => `<li>${s}</li>`).join("")}</ul><div class="btns"><button class="primary" data-act="ph" data-v="wa">Back to WhatsApp</button></div></div>`;
      }
      inner = `<div class="app">${bg}<div class="dim">${sheet}</div></div>`;
    }
    el.innerHTML = `<div class="phwrap"><div class="phcap">Rohan's phone · WhatsApp → Razorpay app</div><div class="device"><div class="screen">${inner}</div></div></div>`;
  }
  function phoneRead(r) {
    if (r.kind === "hold") { const items = r.items.map((i, k) => ({ ...i, usd: Number(document.getElementById("phe-u-" + k).value) })); return { items, total: items.reduce((s, i) => s + i.usd, 0) }; }
    const tranches = r.tranches.map((t, k) => ({ usd: r.kind === "locked" ? t.usd : Number(document.getElementById("phe-u-" + k).value), date: document.getElementById("phe-d-" + k).value }));
    const maxD = r.deadline || E.END;
    if (tranches.some((t) => !(t.usd > 0))) return { err: "Enter an amount" };
    if (tranches.some((t) => t.date < S.date || t.date > maxD)) return { err: `Date must be between ${SD(S.date)} and ${SD(maxD)}` };
    const { free } = E.supply(S); const avail = Object.values(free).reduce((s, v) => s + v, 0) + r.usd;
    const total = tranches.reduce((s, t) => s + t.usd, 0);
    if (r.kind !== "topup" && total > avail + 1) return { err: `Only ${usd(avail)} free in EEFC` };
    return { tranches, total };
  }

  // ---------- events ----------
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-act]"); if (!t) return;
    const a = t.dataset.act, v = t.dataset.v, k = t.dataset.k;
    if (a === "mclose-bg") { if (ev.target === t) closeModal(); return; }
    switch (a) {
      case "nav": UI.view = v; UI.internal = false; render(); window.scrollTo(0, 0); break;
      case "mode": UI.internal = v === "i"; render(); break;
      case "phone": UI.phoneOpen = !UI.phoneOpen; render(); break;
      case "day": E.stepDay(S); afterTime(); break;
      case "next": E.advanceTo(S, E.nextEventDate(S)); afterTime(); break;
      case "go": { const d = document.getElementById("godate").value; if (d && d > S.date) { E.advanceTo(S, d); afterTime(); } break; }
      case "tour": startTour(); break;
      case "video": startVideo(); break;
      case "reset": modal(`<h2>Reset the demo?</h2><div class="note">Goes back to Monday 26 Oct 2026 and clears every decision, approval and date change you've made.</div><div class="foot"><button class="btn" data-act="mclose">Cancel</button><button class="btn primary" data-act="resetok">Reset demo</button></div>`); break;
      case "resetok": { try { localStorage.removeItem(KEY); } catch (e) { } const keepPhone = UI.phoneOpen; S = E.initState(); UI = UI0(); UI.phoneOpen = keepPhone; closeModal(); render(); window.scrollTo(0, 0); toast("Demo reset to Mon 26 Oct"); break; }
      case "txfilter": break;
      case "txpage": UI.txPage += Number(v); render(); break;
      case "rtab": UI.reportTab = v; render(); break;
      case "csv": exportCsv(); break;
      case "obconfirm": E.setObligation(S, v, "confirmed"); render(); break;
      case "obremove": E.setObligation(S, v, "removed"); toast("Removed - the agent won't plan for it"); render(); break;
      case "obedit": { const o = D.obligations.find((x) => x.id === v); const cur = E.obligationView(S, o).est; modal(`<h2>Edit: ${esc(o.name)}</h2><div class="note">Typical amount the agent should plan with.</div><label style="margin-top:10px">Amount (${o.ccy})</label><input type="number" id="obedit-val" value="${Math.round(cur)}"><div class="foot"><button class="btn" data-act="mclose">Cancel</button><button class="btn primary" data-act="obeditok" data-v="${o.id}">Save</button></div>`); break; }
      case "obeditok": { const val = Number(document.getElementById("obedit-val").value); if (val > 0) { E.setObligation(S, v, "confirmed", val); closeModal(); toast("Amount updated - plan re-calculated"); render(); } break; }
      case "obconfirmall": D.obligations.filter((o) => o.kind === "recurring").forEach((o) => { const st = (S.obState[o.id] || {}).status; if (!st || st === "detected") E.setObligation(S, o.id, "confirmed"); }); S.onboarded = true; UI.obOpen = false; toast("Obligations confirmed - confidence updated"); render(); break;
      case "obclose": S.onboarded = true; UI.obOpen = false; render(); break;
      case "obopen": UI.obOpen = true; render(); break;
      case "approve": startApprove(k); break;
      case "edit": { const r = findRec(k); if (r) editModal(r); break; }
      case "edsave": { const r = findRec(k); const vals = readEdit(r); if (vals.err) { document.getElementById("ed-msg").innerHTML = `<div class="err">${vals.err}</div>`; return; } closeModal(); const opts = r.kind === "hold" ? { items: vals.items, edited: true } : { tranches: vals.tranches, edited: true }; authFlow(r, opts, () => doApprove(r, opts, "Dashboard")); break; }
      case "skip": { const r = findRec(k); const fx = E.rate(S.date); modal(`<h2>Skip this recommendation?</h2><div class="sub">${esc(r.title)}</div><div class="note">${r.kind === "hold" ? "Bills would be paid by card at ~3% markup if the USD is converted." : `Without it, ${inrL(r.usd * fx)} less INR arrives before ${P(r.date)} - check the cash calendar.`} The agent will re-plan without it.</div><div class="foot"><button class="btn" data-act="mclose">Cancel</button><button class="btn primary" data-act="skipok" data-k="${k}">Skip</button></div>`); break; }
      case "skipok": { const r = findRec(k); E.skip(S, r, "Dashboard"); closeModal(); toast("Skipped - plan updated"); render(); break; }
      case "unskip": delete S.skipped[k]; render(); break;
      case "ans": { E.answer(S, k, v, "Dashboard"); toast("Thanks - plan updated"); render(); break; }
      case "flagok": { const r = findRec(k); const val = document.getElementById("flag-" + cssId(k)).value; if (Number(val) > 0) { E.confirmFlag(S, r.flagged, val); toast("Input confirmed - confidence updated"); render(); } break; }
      case "flagrc": { const r = findRec(k); E.confirmFlag(S, r.flagged, v); toast("Thanks - confidence updated"); render(); break; }
      case "sendwa": UI.phoneOpen = true; UI.phone = { ...UI.phone, screen: "home", key: k }; render(); toast("Sent to Rohan's WhatsApp"); break;
      case "mclose": closeModal(); break;
      case "fp": if (PENDING) { const p = PENDING; PENDING = null; p(); } break;
      case "saveset": { S.settings.buffer = Number(document.getElementById("set-buffer").value) || S.settings.buffer; S.settings.maxTranche = Number(document.getElementById("set-tranche").value) || S.settings.maxTranche; S.settings.coApproveInr = Number(document.getElementById("set-co").value) || S.settings.coApproveInr; S.audit.push({ date: S.date, time: "12:00", actor: "Rohan Mehta (Founder)", event: "Settings changed", detail: `Buffer ${inrL(S.settings.buffer)} · max tranche ${usd(S.settings.maxTranche)} · co-approval above ${inrL(S.settings.coApproveInr)}`, auth: "Passkey" }); toast("Saved - plan re-calculated"); render(); break; }
      case "schedit": schedEditModal(v); break;
      case "scheditok": { const L = E.schedLimits(S, v); if (!L) break; const u = Number(document.getElementById("se-u").value), d = document.getElementById("se-d").value;
        const msg = (m) => (document.getElementById("se-msg").innerHTML = `<div class="err">${m}</div>`);
        if (!(u > 0)) { msg("Enter an amount greater than zero"); break; }
        if (u > L.maxUsd + 0.5) { msg(`Only ${usd(L.maxUsd)} is available in EEFC for this conversion`); break; }
        if (!d || d < S.date) { msg("The date can't be in the past"); break; }
        if (d > L.latest) { msg(`Must execute by ${P(L.latest)} (RBI deadline)`); break; }
        closeModal(); authSimple("Confirm change", `${esc(L.x.rationale)}: ${usd(L.x.usd)} on ${SD(L.x.date)} → <b>${usd(u)} on ${SD(d)}</b>`, () => { E.editScheduled(S, v, u, d, "Dashboard"); toast(d <= S.date ? "Changed and executed today" : "Approved conversion changed - plan updated"); render(); }); break; }
      case "schnow": { const L = E.schedLimits(S, v); if (!L) break; const fx = E.rate(S.date);
        authSimple("Execute now?", `Convert <b>${usd(L.x.usd)}</b> today at ${fx.toFixed(2)} (≈ ${inrL(L.x.usd * fx)}) instead of on ${P(L.x.date)}.`, () => { E.executeNow(S, v, "Dashboard"); toast("Executed today - INR credited"); render(); }); break; }
      case "schcancel": { const L = E.schedLimits(S, v); if (!L) break;
        modal(`<h2>Cancel this approved conversion?</h2><div class="sub">${esc(L.x.rationale)} · ${usd(L.x.usd)} on ${P(L.x.date)}</div><div class="note">The USD goes back into the plan and the agent will recommend again. ${L.latest < E.END ? `Anything still unconverted on ${P(L.latest)} is auto-converted by the RBI deadline guardrail.` : ""}</div>
          <div class="foot"><button class="btn" data-act="mclose">Keep it</button><button class="btn primary" data-act="schcancelok" data-v="${esc(v)}">Cancel conversion</button></div>`); break; }
      case "schcancelok": { closeModal(); authSimple("Confirm cancellation", "Authenticate to cancel the approved conversion.", () => { E.cancelScheduled(S, v, "Dashboard"); toast("Cancelled - the agent has re-planned"); render(); }); break; }
      case "holdedit": holdEditModal(v); break;
      case "holdeditok": { const u = Number(document.getElementById("he-u").value); const free = Object.values(E.supply(S).free).reduce((s, z) => s + Math.max(0, z), 0); const h = S.holds.find((z) => z.key === v && !z.released);
        if (!(u >= 0)) { document.getElementById("he-msg").innerHTML = '<div class="err">Enter a valid amount</div>'; break; }
        if (h && u > h.remainingUsd + free + 0.5) { document.getElementById("he-msg").innerHTML = `<div class="err">Only ${usd(h.remainingUsd + free)} can be held</div>`; break; }
        closeModal(); authSimple("Confirm change", `Hold <b>${usd(u)}</b> in USD instead of ${usd(h.remainingUsd)}.`, () => { E.editHold(S, v, u, "Dashboard"); toast("Hold changed - plan updated"); render(); }); break; }
      case "holdrelease": { authSimple("Release this hold?", "The USD returns to the plan. The bills it covered would be paid by card (~3% markup) unless the agent re-plans a new hold.", () => { E.releaseHold(S, v, "Dashboard"); toast("Hold released - the agent has re-planned"); render(); }); break; }
      case "saverules": { const tv = document.getElementById("set-target").value; S.settings.targetRate = tv ? Number(tv) : null; S.settings.alertPct = Number(document.getElementById("set-alert").value) || 0.8; S.settings.riskBudget = Number(document.getElementById("set-budget").value) || 0.35; S.settings.maxTranches = Math.max(1, Number(document.getElementById("set-maxn").value) || 5); S.settings.minTranche = Number(document.getElementById("set-mint").value) || 5000;
        S.audit.push({ date: S.date, time: "12:05", actor: "Rohan Mehta (Founder)", event: "Rate rules changed", detail: `Target ${S.settings.targetRate ? S.settings.targetRate.toFixed(2) : "off"} · alert above +${S.settings.alertPct}% · risk budget ${S.settings.riskBudget}% per tranche · max ${S.settings.maxTranches} tranches · min $${S.settings.minTranche}`, auth: "Passkey" }); toast("Rate rules saved - plan re-calculated"); render(); break; }
      case "notif": S.settings.notify[v] = t.checked; save(); renderPhone(); break;
      // phone
      case "ph": {
        const r = phoneRec();
        if (v === "appedit") { UI.phone.screen = "edit"; UI.phone.edit = null; UI.phone.key = r && r.key; }
        else if (v === "bio") { UI.phone.total = r ? r.usd : 0; UI.phone.opts = null; UI.phone.screen = "bio"; }
        else { UI.phone.screen = v; if (r && v !== "home") UI.phone.key = r.key; if (v === "home" || v === "wa") UI.phone.edit = null; }
        renderPhone(); save(); break;
      }
      case "pheditok": { const r = phoneRec(); const vals = phoneRead(r); if (vals.err) { document.getElementById("phe-msg").textContent = vals.err; return; } UI.phone.opts = r.kind === "hold" ? { items: vals.items, edited: true } : { tranches: vals.tranches, edited: true }; UI.phone.total = vals.total; UI.phone.edit = true; UI.phone.screen = "bio"; renderPhone(); break; }
      case "phbio": {
        const r = phoneRec(); if (!r) return; const fp = document.getElementById("phfp"); fp.classList.add("scan"); document.getElementById("phfpn").textContent = "Verifying…";
        setTimeout(() => {
          const opts = UI.phone.opts || {}; const fx = E.rate(S.date);
          const tot = UI.phone.total || r.usd; const co = r.kind !== "hold" && tot * fx > S.settings.coApproveInr;
          E.approve(S, r, { ...opts, auth: "Biometric (mobile)", channel: "WhatsApp → app" });
          UI.phone.doneTitle = (r.kind === "hold" ? `Holding ${usd(tot)} for USD bills` : `Conversion scheduled`) + (opts.edited ? " (edited)" : "");
          UI.phone.doneSub = r.kind === "hold" ? "Bills will be paid from EEFC" : `${usd(tot)} ≈ ${inrL(tot * fx)} · ${(opts.tranches || r.tranches).map((t) => SD(t.date)).join(", ")}`;
          UI.phone.doneSteps = ["✅ Authenticated (biometric)"].concat(co ? ["✅ Co-approved by Ananya Rao (simulated)"] : [], ["✅ Logged to audit trail"]);
          UI.phone.chat.push({ me: true, html: `✅ ${opts.edited ? "Approved (edited)" : "Approved"}: ${esc(r.title)}` });
          UI.phone.key = null; UI.phone.opts = null; UI.phone.edit = null; UI.phone.screen = "done";
          UI.flash = true; render(); UI.flash = false; toast("Approved from phone - removed from the dashboard list");
        }, 1000);
        break;
      }
      case "phskip": { const r = phoneRec(); if (!r) return; E.skip(S, r, "WhatsApp"); UI.phone.chat.push({ me: true, html: `⏭ Skipped: ${esc(r.title)}` }); UI.phone.key = null; UI.phone.screen = "wa"; render(); toast("Skipped from phone"); break; }
      case "phans": { const r = phoneRec(); if (!r) return; E.answer(S, r.key, v, "WhatsApp"); UI.phone.chat.push({ me: true, html: v === "yes" ? "Yes, it recurs" : v === "no" ? "No" : "Not sure" }); UI.phone.chat.push({ me: false, html: "👍 Got it - I've updated the November plan." }); UI.phone.key = null; render(); break; }
      case "phflag": { const r = phoneRec(); const val = document.getElementById("phflag").value; if (Number(val) > 0) { E.confirmFlag(S, r.flagged, val); UI.phone.key = r.key; render(); } break; }
      case "phflagrc": { const r = phoneRec(); E.confirmFlag(S, r.flagged, v); UI.phone.key = r.key; render(); break; }
    }
  });
  document.addEventListener("change", (ev) => {
    const t = ev.target;
    if (t.dataset && t.dataset.act === "txfilter") { UI.txFilter = t.value; UI.txPage = 0; render(); }
    if (t.dataset && t.dataset.act === "ledgerbucket") { UI.ledgerBucket = t.value; render(); }
  });
  document.addEventListener("input", (ev) => {
    if (ev.target.id === "txsearch") { UI.txSearch = ev.target.value; UI.txPage = 0; clearTimeout(window.__ts); window.__ts = setTimeout(() => { render(); const i = document.getElementById("txsearch"); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); }
  });
  function afterTime() {
    UI.obOpen = false;
    UI.phone = { ...UI.phone, screen: "home", key: null, edit: null };
    const g = S.metrics.guardrail.filter((x) => x.date === S.date);
    render();
    if (g.length) toast(`Deadline guardrail auto-converted ${E.monthName(g[0].bucket)} balance`);
    else toast("Moved to " + P(S.date));
  }

  /*TOUR*/
  load(); render(); if (window.__fresh) welcome();
})();
