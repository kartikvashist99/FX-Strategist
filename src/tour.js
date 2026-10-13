  // =================== GUIDED DEMO ===================
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let TOUR = null;
  const fast = () => !!(TOUR && TOUR.fast);
  const W = (ms) => (fast() ? Promise.resolve() : sleep(ms * (window.__tourSpeed || 1)));
  const pr = (prefix) => E.plan(S).find((r) => !r.skippedRec && r.key.startsWith(prefix));

  async function tDeskApprove(rec, opts) {
    if (!rec) return;
    if (fast()) { E.approve(S, rec, { ...(opts || {}), channel: "Dashboard" }); return; }
    await new Promise((res) => {
      authFlow(rec, opts, () => { doApprove(rec, opts, "Dashboard"); res(); });
      setTimeout(() => { if (PENDING) { const p = PENDING; PENDING = null; p(); } }, 900 * (window.__tourSpeed || 1));
    });
  }
  async function tDeskEdit(rec, tranches) {
    if (!rec) return;
    if (fast()) { E.approve(S, rec, { tranches, edited: true, channel: "Dashboard" }); return; }
    editModal(rec); await W(900);
    tranches.forEach((t, k) => {
      const u = document.getElementById("ed-u-" + k), d = document.getElementById("ed-d-" + k);
      if (u && !u.disabled) { u.value = Math.round(t.usd); u.dispatchEvent(new Event("input")); }
      if (d) { d.value = t.date; d.dispatchEvent(new Event("input")); }
      [u, d].forEach((el) => el && (el.style.boxShadow = "0 0 0 3px #f5b301"));
    });
    await W(1800); closeModal();
    await tDeskApprove(rec, { tranches, edited: true });
  }
  async function tPhone(rec, mode, editTr) {
    if (!rec) return;
    UI.phoneOpen = true;
    UI.phone = { ...UI.phone, key: rec.key, screen: "home", edit: null, opts: null };
    if (!fast()) { render(); await W(1200); UI.phone.screen = "wa"; renderPhone(); await W(1800); }
    let opts = {};
    if (mode === "edit") {
      if (!fast()) {
        UI.phone.screen = "edit"; renderPhone(); await W(900);
        editTr.forEach((t, k) => { const u = document.getElementById("phe-u-" + k); if (u) { u.value = Math.round(t.usd); u.style.boxShadow = "0 0 0 3px #f5b301"; } });
        await W(1600);
      }
      opts = { tranches: editTr, edited: true };
    } else if (!fast()) { UI.phone.screen = "app"; renderPhone(); await W(2000); }
    const tot = mode === "edit" ? editTr.reduce((s, t) => s + t.usd, 0) : rec.usd;
    if (!fast()) {
      UI.phone.opts = opts; UI.phone.total = tot; UI.phone.edit = mode === "edit"; UI.phone.screen = "bio"; renderPhone(); await W(900);
      const fp = document.getElementById("phfp"); if (fp) fp.classList.add("scan"); await W(1000);
    }
    const fx = E.rate(S.date);
    E.approve(S, rec, { ...opts, auth: "Biometric (mobile)", channel: "WhatsApp → app" });
    UI.phone.doneTitle = (rec.kind === "hold" ? `Holding ${usd(tot)} for USD bills` : "Conversion scheduled") + (opts.edited ? " (edited)" : "");
    UI.phone.doneSub = `${usd(tot)} ≈ ${inrL(tot * fx)} · ${(opts.tranches || rec.tranches).map((t) => SD(t.date)).join(", ")}`;
    UI.phone.doneSteps = ["✅ Authenticated (biometric)", "✅ Logged to audit trail"];
    UI.phone.chat.push({ me: true, html: `✅ ${opts.edited ? "Approved (edited)" : "Approved"}: ${esc(rec.title)}` });
    UI.phone.key = null; UI.phone.screen = "done"; UI.flash = !fast();
    if (!fast()) { render(); UI.flash = false; }
  }
  async function tConfirmFlag(rec, value) {
    if (!rec || !rec.flagged) return;
    if (!fast()) {
      const inp = document.getElementById("flag-" + cssId(rec.key));
      if (inp) { inp.style.boxShadow = "0 0 0 3px #f5b301"; await W(700); inp.value = value; await W(1100); }
    }
    E.confirmFlag(S, rec.flagged, value);
  }
  function tAdvance(d) { E.advanceTo(S, d); UI.obOpen = false; UI.phone = { ...UI.phone, screen: "home", key: null }; }

  const STEPS = [
    { title: "Meet Lumio Analytics", view: "home", hl: ".callout",
      text: () => `A Bengaluru SaaS company billing 13 US clients in USD. On 1 Sep it switched on Razorpay's Multi-Currency EEFC account, so dollars now stay in USD until it decides to convert. RBI requires each month's receipts to be converted by the end of the following month. FX Strategist is the planning layer on top - it surfaces on Home the moment Rohan logs in. Today is ${P(S.date)}: payroll in 7 days, the September deadline in 5.` },
    { title: "Two years of history", view: "home", hl: "#txcard",
      text: () => `Home shows the synthetic Razorpay history the agent learns from: client receipts, payroll, rent, GST, AWS. For 22 months Lumio converted every dollar at settlement, then bought USD back at ~3% card markup for AWS and tools - ${inrL(D.meta.historicalAvoidable)} of avoidable FX cost.` },
    { title: "The EEFC account", view: "eefc", hl: '[data-bucket="2026-09"]',
      text: () => `Each month's receipts form a "bucket" with its own RBI deadline. September's $21,332 must be converted by Sat 31 Oct; October's $71,190 by 30 Nov. Merchants track this by hand today. The account also holds EUR, GBP, AED and SGD - FX Strategist pilots on USD first.` },
    { title: "Why a plan matters", view: "calendar", hl: "#chartcard",
      text: () => { const w = E.project(S, false); const lo = Math.min(...w.map((p) => p.inr)); return `Orange: with no plan, only the deadline guardrail converts - the INR account drops to ${inrL(lo)} and payroll on 2 Nov runs short. Blue: with the agent's plan, INR stays at the ₹8L buffer.`; } },
    { title: "The agent learned the obligations", view: "strategist", hl: "#obinfo",
      pre: true, run: async () => { await W(1200); D.obligations.filter((o) => o.kind === "recurring").forEach((o) => E.setObligation(S, o.id, "confirmed")); S.onboarded = true; UI.obOpen = false; },
      text: () => `From 24 months of history the agent found 7 recurring obligations (payroll, rent, GST, AWS...) and one one-off it can't predict. Rohan confirms them with "Confirm all" - confirmed items get a confidence boost.` },
    { title: "Recommendations by confidence", view: "strategist", hl: "#reclist",
      text: () => `Every card says what to do, why, and how sure the agent is about the cash input - never a rate prediction. 🔒 Locked = RBI deadline (can't be skipped). ● High (≥80%) = quick approve. ● Medium (50-79%) = confirm the flagged input first. ● Low (<50%) = the agent asks a question instead.` },
    { title: "Volatility-aware tranching", view: "strategist", hl: '[data-key="fund:2026-12-01"]',
      text: () => { const r = pr("fund:2026-12-01"); const v = r && r.vol; return v ? `The agent doesn't predict rates, but it limits timing risk. December payroll needs $${Math.round(r.usd).toLocaleString("en-US")}; USD/INR moves ${v.sigma.toFixed(2)}%/day, so over ${v.H} business days the expected swing is ±${v.V.toFixed(2)}%. At a ${v.budget}% risk budget per tranche that's ${v.n} tranches, spread evenly before the deadline. A choppier week means more, smaller tranches.` : "Conversions are split by volatility."; } },
    { title: "Medium confidence: check the input", view: "strategist", hlFn: () => `[data-key="${(pr("hold:") || {}).key}"]`,
      pre: true, run: async () => { await W(600); await tConfirmFlag(pr("hold:"), 7950); },
      text: () => `AWS spiked 31% last month, so the bill amount is the uncertain input and Approve stays disabled. Rohan enters the bill he expects ($7,950); the hold re-sizes and confidence moves to High. Holding USD for USD bills avoids buying dollars back at ~3% markup.` },
    { title: "Approve on the dashboard", view: "strategist", hl: "#pending-card",
      pre: true, run: async () => { await W(500); await tDeskApprove(pr("hold:")); },
      text: () => `Approval always needs authentication (passkey here). The card leaves the list and moves to "Approved & waiting".` },
    { title: "Low confidence: the agent asks", view: "strategist", hlFn: () => (pr("fund:2026-11-13") ? '[data-key="fund:2026-11-13"]' : "#reclist"),
      pre: true, run: async () => { if (!fast()) { const q = document.querySelector('[data-key="q:offsite"]'); if (q) { q.classList.add("tour-hl"); q.scrollIntoView({ block: "center" }); } await W(1800); } E.answer(S, "q:offsite", "yes", "Dashboard"); },
      text: () => `A ₹4.2L offsite payment appeared once last November - too little to forecast, so the agent asked. Rohan answers "Yes": a new funding conversion appears, and the December numbers re-plan automatically.` },
    { title: "WhatsApp nudge", view: "strategist", hl: "#phone .device",
      pre: true, run: async () => { UI.phoneOpen = true; UI.phone = { ...UI.phone, key: (pr("lock:") || {}).key, screen: "home" }; },
      text: () => `The locked September conversion is pushed to Rohan's WhatsApp. A WhatsApp button can't move money - it only opens the Razorpay app.` },
    { title: "Approve from the phone", view: "strategist", hl: "#phone .device",
      pre: true, run: async () => { await tPhone(pr("lock:"), "approve"); },
      text: () => `WhatsApp → Razorpay app: the background dims, the recommendation opens in a centred card, Approve → biometric. On the dashboard, the September card disappears and appears under "Approved & waiting".` },
    { title: "Edit from the phone", view: "strategist", hlFn: () => (pr("fund:2026-11-02:gap") ? `[data-key="${pr("fund:2026-11-02:gap").key}"]` : "#reclist"),
      pre: true, run: async () => { const r = pr("fund:2026-11-02"); if (r) { const n = r.tranches.length, each = Math.floor(20000 / n / 100) * 100; await tPhone(r, "edit", r.tranches.map((x, k) => ({ date: x.date, usd: k === n - 1 ? 20000 - each * (n - 1) : each }))); } },
      text: () => `Rohan edits the payroll conversion from $23,800 to $20,000 on his phone. The agent immediately re-plans: a new card asks to cover the remaining gap so payroll and rent still keep the buffer.` },
    { title: "Approve the rest of November", view: "strategist", hl: "#pending-card",
      pre: true, run: async () => {
        await W(400); await tDeskApprove(pr("fund:2026-11-02:gap"));
        const g = pr("fund:2026-11-20"); if (g && g.flagged) { await tConfirmFlag(g, g.flagged.value); }
        const o = pr("fund:2026-11-13"); if (o) await tDeskApprove(o);
        const g2 = pr("fund:2026-11-20"); if (g2) await tDeskApprove(g2);
      },
      text: () => `The gap, the offsite and GST conversions are approved on the dashboard. GST was Medium confidence, so its amount was confirmed first.` },
    { title: "Edit on the dashboard + co-approval", view: "strategist", hl: "#pending-card",
      pre: true, run: async () => {
        const d = pr("fund:2026-12-01"); if (d) await tDeskEdit(d, d.tranches.map((x, k) => ({ ...x, date: k === d.tranches.length - 1 ? "2026-11-27" : x.date })));
        const t = pr("topup:"); if (t) { if (t.flagged) E.confirmFlag(S, t.flagged, "yes"); await tDeskApprove(pr("topup:")); }
      },
      text: () => `For December payroll, Rohan moves the last tranche from 30 Nov to 27 Nov to avoid the month-end crunch. The total is above ₹25L, so the Finance Head co-approves (simulated). The receipts-based top-up is approved too - nothing left to decide.` },
    { title: "Optional: Rohan's own rate target", view: "settings", hl: "#fxrules",
      pre: true, run: async () => {
        if (!fast()) { const i = document.getElementById("set-target"); if (i) { i.scrollIntoView({ block: "center" }); i.style.boxShadow = "0 0 0 3px #f5b301"; await W(700); i.value = "89.00"; await W(1100); } }
        S.settings.targetRate = 89.0; S.audit.push({ date: S.date, time: "12:05", actor: "Rohan Mehta (Founder)", event: "Rate rules changed", detail: "Target 89.00 · alert above +0.8% · risk budget 0.35% per tranche", auth: "Passkey" }); },
      text: () => `The merchant can hold a market view; the agent won't. Rohan sets a target of 89.00: if USD/INR reaches it, his approved tranches convert early - otherwise they follow the schedule. Opportunity alerts fire when the rate is 0.8%+ above its 20-day average.` },
    { title: "Approved = earmarked, not converted", view: "eefc", hl: '[data-bucket="2026-09"]',
      text: () => `Approval immediately earmarks the dollars ("⏳ Approved, converts on execution date") and "Free to plan" drops - but the USD stays put until the execution date, when it converts at that day's rate.` },
    { title: "Fast-forward to Fri 30 Oct", view: "eefc", hl: '[data-bucket="2026-09"]',
      pre: true, run: async () => { tAdvance("2026-10-30"); },
      text: () => { const c = S.newConv.find((x) => x.bucket.includes("2026-09")); return c ? `The September conversion executed today at ${c.rate.toFixed(2)} (approved at ${c.approvedRate.toFixed(2)}). The bucket is fully converted before the RBI deadline - no guardrail needed.` : "Conversions due today have executed."; } },
    { title: "AWS paid straight from USD", view: "home", hl: "#txcard",
      pre: true, run: async () => { tAdvance("2026-11-03"); },
      text: () => `3 Nov: payroll went out on the 2nd with the buffer intact, and the AWS bill was paid directly from the held USD - no card markup. New rows are highlighted in yellow.` },
    { title: "Opportunity alert (10 Nov)", view: "strategist", hlFn: () => (pr("opp:") ? `[data-key="${pr("opp:").key}"]` : "#ratecard"),
      pre: true, run: async () => { tAdvance("2026-11-10"); },
      text: () => { const c = E.marketContext(S); return `USD/INR jumped to ${c.rate.toFixed(2)}, ${c.premium.toFixed(2)}% above its 20-day average - past the +0.8% alert threshold. The agent offers to convert approved tranches today. It's a market alert, not a prediction; Rohan can keep the schedule.`; } },
    { title: "Target reached (11 Nov)", view: "eefc", hl: '[data-bucket="2026-10"]',
      pre: true, run: async () => { tAdvance("2026-11-11"); },
      text: () => { const a = S.audit.filter((x) => x.event === "Target rate reached").pop(); return a ? `${a.detail}. No new approval needed - the target was part of the original approval. The October card shows each tranche converted early and when it was originally due.` : "Target not reached in this run."; } },
    { title: "Receipts land, the agent re-plans", view: "strategist", hl: "#reclist",
      pre: true, run: async () => { tAdvance("2026-11-20"); },
      text: () => `20 Nov: November receipts have arrived (Brightpath is late, as usual). The agent proposes converting the new balance before its own deadline, again split by volatility - the cycle repeats every month.` },
    { title: "Schedule and finish the month", view: "calendar", hl: "#chartcard",
      pre: true, run: async () => { for (const r of E.plan(S).filter((x) => !x.skippedRec && x.kind !== "alert" && x.kind !== "question")) { const rr = pr(r.key); if (rr) { if (rr.flagged) E.confirmFlag(S, rr.flagged, rr.flagged.type === "amount" ? rr.flagged.value : "yes"); await tDeskApprove(pr(r.key)); } } tAdvance("2026-12-01"); },
      text: () => `1 Dec: December payroll has been paid. The INR account never dropped below the buffer.` },
    { title: "Audit trail for the CA", view: "reports", tab: "audit", hl: "#auditcard",
      text: () => `Every action is logged: who approved, how they authenticated, the agent's rationale, approved vs executed rate. Export-ready for the CA and statutory audit.` },
    { title: "EEFC compliance", view: "reports", tab: "comp", hl: "#compcard",
      text: () => `Bucket by bucket: received, used for payments, converted (manual / agent plan / guardrail) and status against the RBI deadline.` },
    { title: "Guardrails by design", view: "settings", hl: "#autoexec",
      text: () => `The merchant controls the buffer, maximum tranche and co-approval threshold. Auto-execution is deliberately not offered - the only automatic action is the RBI deadline guardrail.` },
    { title: "Internal View: is it working?", internal: true, hl: "#northstar",
      text: () => { const o = E.outcomes(S); const S0 = E.initState(); E.advanceTo(S0, E.END); const n = E.outcomes(S0); return `Hidden from merchants. North star: ${inrL(o.avoided)} of avoidable FX cost saved since EEFC; rate timing reported separately (${o.rateEffect >= 0 ? "+" : ""}${inrL(o.rateEffect)}), not claimed as skill. Guardrails: ${o.deadlineMisses} deadline misses, ${o.shortfalls.length} shortfalls. Counterfactual - with no decisions at all: ${n.guardrail.length} forced deadline conversions and ${n.shortfalls.length} payments run short.`; } },
    { title: "Your turn", internal: false, view: "strategist", hl: null, last: true,
      text: () => `That's the full loop: learn → plan → approve (dashboard or WhatsApp) → execute on time → audit → measure. Explore from here, or restore your own session.` },
  ];


  // =================== VIDEO MODE (autoplay, ~60s) ===================
  const VSTEPS = [
    { t: "Meet Lumio Analytics", dwell: 3000, cap: "Lumio, a SaaS exporter, now holds USD in its EEFC account" },
    { t: "The EEFC account", dwell: 2800, cap: "RBI: September's $21k must be converted in 5 days" },
    { t: "Why a plan matters", dwell: 3200, cap: "No plan: INR runs short of payroll (orange)" },
    { t: "The agent learned the obligations", dwell: 2200, cap: "The agent learned 7 recurring obligations from 24 months" },
    { t: "Volatility-aware tranching", dwell: 3000, cap: "Volatility sets the tranches: ±0.9% expected swing → 3 tranches" },
    { t: "Medium confidence: check the input", dwell: 2000, cap: "Medium confidence: Rohan confirms the AWS bill" },
    { t: "Approve on the dashboard", dwell: 1600, cap: "Hold USD for USD bills - no 3% card markup" },
    { t: "Low confidence: the agent asks", dwell: 2200, cap: "Seen once? The agent asks instead of guessing" },
    { t: "WhatsApp nudge", dwell: 1200, cap: "Deadline conversion sent to WhatsApp" },
    { t: "Approve from the phone", dwell: 1800, cap: "WhatsApp → Razorpay app → biometric approve" },
    { t: "Edit from the phone", dwell: 2400, cap: "Edited on the phone - the agent re-plans the gap" },
    { t: "Approve the rest of November", silent: ["Approve the rest of November", "Edit on the dashboard + co-approval"], dwell: 2000, cap: "Remaining conversions approved (co-approval above ₹25L)" },
    { t: "Optional: Rohan's own rate target", dwell: 2200, cap: "Rohan sets his own target rate: 89.00" },
    { t: "Fast-forward to Fri 30 Oct", dwell: 2600, cap: "30 Oct: converted before the deadline, at that day's rate" },
    { t: "Opportunity alert (10 Nov)", silent: ["AWS paid straight from USD", "Opportunity alert (10 Nov)"], dwell: 2800, cap: "10 Nov: rate +0.95% above average → opportunity alert" },
    { t: "Target reached (11 Nov)", dwell: 3000, cap: "11 Nov: 89.12 hits the target - approved tranches convert early" },
    { t: "Schedule and finish the month", silent: ["Receipts land, the agent re-plans", "Schedule and finish the month"], dwell: 2800, cap: "1 Dec: payroll paid, buffer intact, zero forced conversions" },
    { t: "Audit trail for the CA", dwell: 2000, cap: "Every decision audit-ready for the CA" },
    { t: "Internal View: is it working?", dwell: 3600, cap: "Razorpay view: FX cost saved, deadlines met, forecast accuracy" },
  ];

  const idxOf = (title) => { const i = STEPS.findIndex((s) => s.title === title); if (i < 0) throw new Error("tour step missing: " + title); return i; };
  async function startVideo() {
    closeModal();
    TOUR = { step: 0, snapshot: TOUR && TOUR.snapshot ? TOUR.snapshot : JSON.stringify({ S, UI }), busy: true, fast: false, video: true, vi: 0, t0: Date.now() };
    S = E.initState(); UI = { ...UI0(), phoneOpen: true }; window.__tourSpeed = 0.6;
    for (let k = 0; k < VSTEPS.length; k++) {
      if (!TOUR || !TOUR.video) return;
      const vs = VSTEPS[k]; TOUR.vi = k; const vi = idxOf(vs.t);
      if (vs.silent) {
        TOUR.fast = true; window.__tourFast = true;
        for (const tt of vs.silent) { const j = idxOf(tt); TOUR.step = j; if (STEPS[j].run) await STEPS[j].run(); }
        TOUR.fast = false; window.__tourFast = false;
        TOUR.step = vi; showView(STEPS[vi]); highlight(STEPS[vi]); tourPanel();
      } else await playStep(vi);
      if (!TOUR) return;
      TOUR.busy = true; tourPanel();
      await sleep(vs.dwell);
    }
    if (TOUR) { TOUR.busy = false; TOUR.done = true; tourPanel(); }
    window.__tourSpeed = 1;
  }

  function tourPanel() {
    let el = document.getElementById("tourpanel");
    if (!TOUR) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement("div"); el.id = "tourpanel"; document.body.appendChild(el); }
    const st = STEPS[TOUR.step];
    if (TOUR.video) {
      const vs = VSTEPS[TOUR.vi] || VSTEPS[0];
      el.className = "video";
      el.innerHTML = `<div class="tp-head"><span class="tag">🎬 VIDEO MODE</span><span>${TOUR.done ? "Done" : (TOUR.vi + 1) + " / " + VSTEPS.length}</span><span style="flex:1"></span><button class="tp-x" data-tour="exit" title="Stop and restore your session">✕</button></div>
        <div class="tp-bar"><i style="width:${((TOUR.vi + 1) / VSTEPS.length) * 100}%"></i></div><div class="vcap">${esc(vs.cap)}</div>
        ${TOUR.done ? `<div class="tp-btns"><button data-tour="video">↻ Replay</button><button data-tour="keep" class="primary">Explore from here</button><button data-tour="exit">Restore my session</button></div>` : ""}`;
      return;
    }
    el.className = "";
    el.innerHTML = `<div class="tp-head"><span class="tag">GUIDED DEMO</span><span>Step ${TOUR.step + 1} of ${STEPS.length}</span><span style="flex:1"></span><button class="tp-x" data-tour="exit" title="Exit and restore your session">✕</button></div>
      <div class="tp-bar"><i style="width:${((TOUR.step + 1) / STEPS.length) * 100}%"></i></div>
      <h4>${esc(st.title)}</h4><p>${esc(st.text())}</p>
      <div class="tp-btns">${st.last ? `<button data-tour="keep" class="primary">Explore from here</button><button data-tour="exit">Restore my session</button><button data-tour="restart">Restart</button>`
        : `<button data-tour="back" ${TOUR.step === 0 || TOUR.busy ? "disabled" : ""}>‹ Back</button><button data-tour="next" class="primary" ${TOUR.busy ? "disabled" : ""}>${TOUR.busy ? "Playing…" : "Next ›"}</button>`}</div>`;
  }
  function highlight(st) {
    document.querySelectorAll(".tour-hl").forEach((x) => x.classList.remove("tour-hl"));
    const sel = st.hlFn ? st.hlFn() : st.hl; if (!sel) return;
    const el = document.querySelector(sel); if (!el) return;
    el.classList.add("tour-hl");
    if (!el.closest("#phone")) { const y = el.getBoundingClientRect().top + window.scrollY - 120; window.scrollTo({ top: Math.max(0, y), behavior: fast() ? "auto" : "smooth" }); }
  }
  function showView(st) {
    UI.internal = !!st.internal;
    if (st.view) UI.view = st.view;
    if (st.tab) UI.reportTab = st.tab;
    render();
  }
  async function playStep(i) {
    const st = STEPS[i];
    TOUR.step = i; TOUR.busy = !fast() && !!st.run; tourPanel();
    showView(st);
    if (st.run) { if (!fast()) highlight(st); await st.run(); }
    if (!fast()) { showView(st); highlight(st); TOUR.busy = false; tourPanel(); }
  }
  async function goTo(k) {
    // deterministic replay: fresh scenario, run steps 0..k silently, then show step k
    TOUR.fast = true; window.__tourFast = true;
    S = E.initState(); UI = { ...UI0(), phoneOpen: true };
    for (let i = 0; i <= k; i++) { TOUR.step = i; if (STEPS[i].run) await STEPS[i].run(); }
    TOUR.fast = false; window.__tourFast = false;
    TOUR.step = k; showView(STEPS[k]); highlight(STEPS[k]); tourPanel();
  }
  async function startTour() {
    closeModal();
    TOUR = { step: 0, snapshot: JSON.stringify({ S, UI }), busy: false, fast: false };
    S = E.initState(); UI = { ...UI0(), phoneOpen: true };
    await playStep(0);
  }
  function endTour(keep) {
    document.querySelectorAll(".tour-hl").forEach((x) => x.classList.remove("tour-hl"));
    window.__tourSpeed = 1;
    if (!keep && TOUR && TOUR.snapshot) { const o = JSON.parse(TOUR.snapshot); S = o.S; UI = o.UI; }
    TOUR = null; tourPanel(); render(); toast(keep ? "You're in control - use the demo controls to keep exploring" : "Restored your previous session");
  }
  document.addEventListener("click", async (ev) => {
    const t = ev.target.closest("[data-tour]"); if (!t || !TOUR) return;
    const a = t.dataset.tour;
    if (a === "next" && !TOUR.busy && TOUR.step < STEPS.length - 1) await playStep(TOUR.step + 1);
    else if (a === "back" && !TOUR.busy && TOUR.step > 0) await goTo(TOUR.step - 1);
    else if (a === "exit") endTour(false);
    else if (a === "keep") endTour(true);
    else if (a === "video") { await startVideo(); }
    else if (a === "restart") { const snap = TOUR.snapshot; TOUR = { step: 0, snapshot: snap, busy: false, fast: false }; S = E.initState(); UI = { ...UI0(), phoneOpen: true }; await playStep(0); }
  });
  // keep the tour highlight after any re-render triggered inside a step
  const _render = render;
  render = function () { _render(); if (TOUR && !TOUR.fast) { const st = STEPS[TOUR.step]; const sel = st && (st.hlFn ? st.hlFn() : st.hl); const el = sel && document.querySelector(sel); if (el) el.classList.add("tour-hl"); } };
  function welcome() {
    modal(`<h2>Welcome to the FX Strategist prototype</h2><div class="note">A concept for Razorpay's Multi-Currency EEFC account: an agent that plans when and how much USD to convert, around payables, cash runway and RBI deadlines. All data is synthetic.</div>
      <div class="note" style="margin-top:10px"><b>New here?</b> The guided demo walks through every screen, the WhatsApp approval and edit flows, and a month of simulated time - just keep pressing Next (about 3 minutes).</div>
      <div class="note"><b>Short on time?</b> 🎬 Video mode autoplays the key moments in about a minute.</div>
      <div class="foot"><button class="btn" data-act="mclose">Explore on my own</button><button class="btn" data-act="video">🎬 Video mode (1 min)</button><button class="btn primary" data-act="tour">▶ Start guided demo</button></div>`);
  }
