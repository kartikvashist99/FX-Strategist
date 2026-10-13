/* FX Strategist - planning + simulation engine (pure logic, runs in browser and node). Synthetic demo. */
(function (root) {
  const D = root.FX_DATA;
  const END = D.meta.end;

  // ---------- date helpers ----------
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const fmt = (dt) => dt.toISOString().slice(0, 10);
  const addDays = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return fmt(d); };
  const dow = (s) => parse(s).getUTCDay();
  const isBday = (s) => { const w = dow(s); return w !== 0 && w !== 6; };
  const prevBday = (s) => { let d = addDays(s, -1); while (!isBday(d)) d = addDays(d, -1); return d; };
  const onOrBeforeBday = (s) => { let d = s; while (!isBday(d)) d = addDays(d, -1); return d; };
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const monthEnd = (y, m) => fmt(new Date(Date.UTC(y, m, 0)));
  const bucketDeadline = (id) => { const [y, m] = id.split("-").map(Number); const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1; return monthEnd(ny, nm); };
  const bucketOf = (s) => s.slice(0, 7);
  const rate = (s) => { let d = s; for (let i = 0; i < 10; i++) { if (D.fx[d]) return D.fx[d]; d = addDays(d, -1); } return D.fx[Object.keys(D.fx).pop()]; };
  const ceil100 = (x) => Math.ceil(x / 100) * 100;
  const r2 = (x) => Math.round(x * 100) / 100;

  // ---------- state ----------
  function initState() {
    const buckets = D.start.buckets.map((b) => ({ ...b, deadline: bucketDeadline(b.id), execDate: onOrBeforeBday(bucketDeadline(b.id)), autoConverted: 0 }));
    const S = {
      v: 3, date: D.meta.today, inr: D.start.inr, buckets,
      holds: [], scheduled: [], answers: { offsite: null }, obState: {}, flagConfirm: {}, skipped: {},
      settings: { buffer: D.meta.buffer, maxTranche: 25000, coApproveInr: 2500000, notify: { whatsapp: true, email: true, slack: false }, targetRate: null, alertPct: 0.8, riskBudget: 0.35, maxTranches: 5, minTranche: 5000 },
      onboarded: false, newTx: [], newLedger: [], newConv: [], newDaily: [],
      audit: [
        { date: "2026-09-01", time: "10:12", actor: "Rohan Mehta (Founder)", event: "EEFC settlement enabled", detail: "International settlements now held in USD (Multi-Currency EEFC Account)", auth: "Password + OTP" },
        { date: "2026-09-29", time: "18:41", actor: "Rohan Mehta (Founder)", event: "Manual conversion", detail: "USD 31,000 converted from Sep-2026 balance to fund October payroll. No plan or rationale recorded.", usd: 31000, rate: rate("2026-09-29"), inr: 31000 * rate("2026-09-29"), bucket: "2026-09", auth: "Password + OTP" },
        { date: D.meta.today, time: "09:00", actor: "FX Strategist (agent)", event: "Agent activated", detail: "Analysed 24 months of history: 7 recurring obligations, 1 one-off needing input, 13 clients' payment behaviour.", auth: "-" },
      ],
      metrics: { shown: {}, decisions: [], guardrail: [], shortfalls: [], forecasts: [], avoided: [], cardPaid: [] },
      done: {},
    };
    return S;
  }

  // ---------- obligations / expectations ----------
  function obligationView(S, o) {
    const st = S.obState[o.id] || {};
    let conf = o.conf, est = st.estimate != null ? st.estimate : o.estimate;
    let low = o.low, high = o.high;
    if (st.status === "confirmed" || st.estimate != null) conf = Math.min(98, conf + 5);
    const fc = S.flagConfirm["ob:" + o.id];
    if (fc != null) { est = fc; low = fc * 0.95; high = fc * 1.05; conf = Math.max(conf, 86); }
    if (st.estimate != null) { low = st.estimate * 0.97; high = st.estimate * 1.03; }
    return { ...o, est, low, high, conf, status: st.status || "detected" };
  }
  function activeObligations(S) {
    const out = [];
    for (const o0 of D.obligations) {
      const o = obligationView(S, o0);
      if (o.status === "removed") continue;
      for (const dt of o.dates) {
        if (dt <= S.date || dt > END) continue;
        if (o.id === "offsite") {
          if (S.answers.offsite === "yes") out.push({ ...o, date: dt, amount: o.est, conf: 95 });
          else if (S.answers.offsite === "unsure") out.push({ ...o, date: dt, amount: o.est, conf: 50, contingency: true });
          continue;
        }
        out.push({ ...o, date: dt, amount: o.ccy === "USD" ? o.est : o.est });
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }
  function expectedReceipts(S) {
    const got = new Set(S.newLedger.filter((l) => l.entry.startsWith("Credit")).map((l) => l.ref));
    return D.expected.filter((e) => !got.has(e.id)).map((e) => {
      let conf = e.conf, date = e.date;
      const fc = S.flagConfirm["rc:" + e.id];
      if (fc === "yes") conf = Math.max(conf, 88);
      if (date <= S.date) { date = addDays(S.date, 1); conf = Math.min(conf, 60); }
      return { ...e, date, conf };
    });
  }

  // ---------- supply ----------
  function commitments(S, excludeId) {
    // holds reserve from the newest bucket; each approved conversion reserves from its own bucket first, then oldest
    const free = {}, out = {};
    S.buckets.forEach((b) => { free[b.id] = b.remaining; out[b.id] = { held: 0, scheduled: [] }; });
    const ids = S.buckets.map((b) => b.id).sort();
    let held = S.holds.filter((h) => !h.released).reduce((s, h) => s + h.remainingUsd, 0);
    for (const id of [...ids].reverse()) { const t = Math.min(free[id], held); free[id] -= t; held -= t; out[id].held += t; }
    const pend = S.scheduled.filter((x) => !x.executed && x.id !== excludeId).sort((a, b) => (!!b.bucket - !!a.bucket) || a.date.localeCompare(b.date));
    for (const p of pend) {
      let need = p.usd;
      if (p.bucket && free[p.bucket] == null) continue; // funded by receipts that haven't arrived yet - reserves nothing today
      const order = p.bucket ? [p.bucket, ...ids.filter((i) => i !== p.bucket)] : ids;
      for (const id of order) { const t = Math.min(free[id], need); if (t > 0.001) { free[id] -= t; need -= t; out[id].scheduled.push({ date: p.date, usd: t, id: p.id }); } if (need <= 0.001) break; }
    }
    return { free, out, ids };
  }
  function supply(S) { const c = commitments(S); return { free: c.free, ids: c.ids }; }
  function take(free, ids, usd, latestDate) {
    const parts = []; let need = usd;
    for (const id of ids) {
      const b = id;
      const exec = onOrBeforeBday(bucketDeadline(b));
      if (latestDate && exec < latestDate) { /* bucket must be converted before latestDate - still usable */ }
      const t = Math.min(free[b], need);
      if (t > 0.001) { free[b] -= t; need -= t; parts.push({ bucket: b, usd: r2(t), exec }); }
      if (need <= 0.001) break;
    }
    return { parts, short: Math.max(0, need) };
  }


  // ---------- market context & volatility-aware tranching ----------
  const cfgOf = (S) => ({ targetRate: null, alertPct: 0.8, riskBudget: 0.35, maxTranches: 5, minTranche: 5000, ...S.settings });
  function marketContext(S, date) {
    date = date || S.date;
    const days = Object.keys(D.fx).filter((d) => d <= date).sort().slice(-21);
    const vals = days.map((d) => D.fx[d]);
    const rets = vals.slice(1).map((v, i) => Math.log(v / vals[i]));
    const mean = rets.reduce((s, x) => s + x, 0) / Math.max(1, rets.length);
    const sigma = Math.sqrt(rets.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, rets.length - 1)) * 100;
    const prev = vals.slice(0, -1).slice(-20);
    const avg20 = prev.reduce((s, x) => s + x, 0) / Math.max(1, prev.length);
    const r = rate(date);
    return { rate: r, avg20, premium: (r / avg20 - 1) * 100, sigma, hi20: Math.max(...prev), lo20: Math.min(...prev) };
  }
  function bdaysBetween(a, b) { const out = []; let d = a; while (d <= b) { if (isBday(d)) out.push(d); d = addDays(d, 1); } return out; }
  function tranchePlan(S, usd, start, end) {
    const cfg = cfgOf(S);
    let win = bdaysBetween(start, end); if (!win.length) win = [end];
    const H = win.length, sigma = marketContext(S).sigma, V = sigma * Math.sqrt(H);
    const nVol = Math.max(1, Math.ceil(V / cfg.riskBudget));
    const nSize = Math.max(1, Math.ceil(usd / S.settings.maxTranche));
    const nMin = Math.max(1, Math.floor(usd / cfg.minTranche));
    const n = Math.max(1, Math.min(H, Math.max(nSize, Math.min(nVol, cfg.maxTranches, nMin))));
    const each = Math.floor(usd / n / 100) * 100;
    const tranches = [];
    for (let k = 1; k <= n; k++) {
      const idx = Math.min(H - 1, Math.max(0, Math.round((k * H) / n) - 1));
      tranches.push({ date: win[idx], usd: k === n ? r2(usd - each * (n - 1)) : each });
    }
    return { tranches, info: { sigma, H, V, nVol, nSize, n, budget: cfg.riskBudget } };
  }
  function volLine(info) {
    return `Volatility-aware: ${info.sigma.toFixed(2)}%/day × √${info.H} business days = ±${info.V.toFixed(2)}% expected move ÷ ${info.budget}% risk budget per tranche → ${info.n} tranche${info.n > 1 ? "s" : ""}${info.n < Math.min(info.nVol, 5) ? " (min tranche $5,000)" : info.nSize > Math.min(info.nVol, 5) ? " (size limit)" : ""}`;
  }
  function targetLine(S) { const t = cfgOf(S).targetRate; return t ? `🎯 Target ${t.toFixed(2)}: converts early if USD/INR reaches it (part of this approval)` : null; }

  // ---------- planner ----------
  function plan(S) {
    const today = S.date, fxNow = rate(today), buf = S.settings.buffer, TOL = 30000;
    const recs = [];
    const { free, ids } = supply(S);
    const obs = activeObligations(S);
    const recv = expectedReceipts(S);

    // 1) hold USD for USD payables in the next 14 days
    const usdSoon = obs.filter((o) => o.ccy === "USD" && daysBetween(today, o.date) <= 14);
    const heldKeys = new Set(S.holds.filter((h) => !h.cancelled).flatMap((h) => h.items.map((i) => i.ob + ":" + i.date)));
    const toHold = usdSoon.filter((o) => !heldKeys.has(o.id + ":" + o.date));
    if (toHold.length) {
      const key = "hold:" + toHold.map((o) => o.id + "@" + o.date).join("+");
      const items = toHold.map((o) => ({ ob: o.id, name: o.name, date: o.date, usd: ceil100(o.high) }));
      items.forEach((i, k) => { const o = toHold[k]; i.usd = ceil100(S.flagConfirm["ob:" + o.id] != null ? o.est * 1.03 : o.high); });
      const usd = items.reduce((s, i) => s + i.usd, 0);
      const conf = Math.min(...toHold.map((o) => o.conf));
      const flagged = toHold.filter((o) => o.factors.trendBreak && S.flagConfirm["ob:" + o.id] == null);
      const rec = {
        key, kind: "hold", conf, title: "Hold USD for " + toHold.map((o) => o.name.split(" (")[0]).join(" and ") + " - don't convert",
        usd, date: toHold[0].date, items,
        drivers: toHold.map((o) => `${o.name}: ~$${Math.round(o.est).toLocaleString("en-US")} due ${pretty(o.date)} (range $${Math.round(o.low).toLocaleString("en-US")}-$${Math.round(o.high).toLocaleString("en-US")})`)
          .concat([`Paying from USD avoids buying dollars back at ~${D.meta.cardMarkup * 100}% card markup (~₹${Math.round(usd * fxNow * D.meta.cardMarkup).toLocaleString("en-IN")} saved)`]),
        flagged: flagged.length ? { type: "amount", ob: flagged[0].id, label: `Confirm the expected ${flagged[0].name.split(" (")[0]} bill ($)`, value: Math.round(flagged[0].est), why: flagged[0].note + " - so the bill amount is the uncertain input." } : null,
        factors: toHold[0].factors,
      };
      if (!S.skipped[key]) { recs.push(rec); let h = usd; for (const id of [...ids].reverse()) { const t = Math.min(free[id], h); free[id] -= t; h -= t; } }
      else recs.push({ ...rec, skippedRec: true });
    }

    // 2) locked: buckets whose deadline is within 10 days
    const projConv = []; // {date, usd}
    S.scheduled.filter((x) => !x.executed).forEach((x) => projConv.push({ date: x.date, inr: x.usd * fxNow }));
    for (const id of ids) {
      const b = S.buckets.find((z) => z.id === id);
      const days = daysBetween(today, b.deadline);
      if (free[id] > 0.5 && days <= 10 && b.execDate >= today) {
        const usd = r2(free[id]);
        const key = "lock:" + id;
        recs.push({
          key, kind: "locked", conf: null, title: `Convert the remaining ${monthName(id)} balance`, usd, date: b.execDate, bucket: id, deadline: b.deadline,
          tranches: [{ date: b.execDate, usd, bucket: id }],
          drivers: [`RBI EEFC rule: ${monthName(id)} receipts must be converted by ${pretty(b.deadline)}${b.deadline !== b.execDate ? ` (a ${weekday(b.deadline)} - so it executes ${pretty(b.execDate)})` : ""}`,
            `$${fmtUsd(usd)} is the unused balance after payments already made from it`,
            `If not scheduled, the deadline guardrail converts it automatically on ${pretty(b.execDate)}`],
        });
        free[id] = 0;
        projConv.push({ date: b.execDate, inr: usd * fxNow });
      }
    }

    // 3) funding needs for INR obligations
    const inrObs = obs.filter((o) => o.ccy === "INR");
    const balBefore = (date) => { // projected INR before obligations dated `date`
      let bal = S.inr;
      for (const c of projConv) if (c.date < date || (c.date === date)) bal += c.inr;
      for (const o of inrObs) if (o.date < date) bal -= o.amount;
      return bal;
    };
    const usedRecv = new Set();
    let i = 0;
    while (i < inrObs.length) {
      const first = inrObs[i];
      const grp = inrObs.filter((o) => o.date >= first.date && daysBetween(first.date, o.date) <= 6);
      const after = balBefore(first.date) - grp.reduce((s, o) => s + o.amount, 0);
      i += grp.length;
      const hasPrior = S.scheduled.some((x) => x.recKey && x.recKey.startsWith("fund:" + first.date));
      if (after >= buf - (hasPrior ? TOL * 3 : TOL)) continue;
      const needInr = buf - after;
      let convDate = prevBday(first.date); if (convDate < today) convDate = today;
      const usdNeed = ceil100(needInr / fxNow);
      const baseKey = "fund:" + first.date;
      const prior = S.scheduled.filter((x) => x.recKey && x.recKey.startsWith(baseKey));
      const priorUsd = prior.reduce((s, x) => s + x.usd, 0);
      const key = prior.length ? baseKey + ":gap" + prior.length : baseKey;
      const names = grp.map((o) => { const n = o.name.split(" (")[0]; return `${/^[A-Z]{2,}/.test(n) ? n : n.charAt(0).toLowerCase() + n.slice(1)} (${shortDate(o.date)})`; });
      const conf = Math.min(...grp.map((o) => o.conf));
      const tk = take(free, ids, usdNeed);
      const flaggedOb = grp.find((o) => o.conf < 80 && !o.contingency);
      if (tk.parts.length) {
        const usd = r2(tk.parts.reduce((s, p) => s + p.usd, 0));
        const tp = tranchePlan(S, usd, today, convDate);
        const tranches = tp.tranches, n = tranches.length;
        const rec = {
          key, kind: "fund", conf, title: (prior.length ? "Cover the remaining gap for " : "Fund ") + joinNames(names), usd, date: tranches[0].date, tranches, sources: tk.parts, vol: tp.info,
          drivers: (prior.length ? [`You approved $${fmtUsd(priorUsd)} for this earlier - ~₹${lakh(needInr)} is still needed to keep the buffer`] : []).concat(grp.map((o) => `${o.name}: ~₹${lakh(o.amount)} on ${pretty(o.date)}${o.seen ? ` (seen ${o.seen}x${o.status === "confirmed" ? ", confirmed by you" : ""})` : ""}${o.contingency ? " - kept as contingency (you said 'not sure')" : ""}`))
            .concat([`Projected INR before these: ₹${lakh(balBefore(first.date))}; keeps the ₹${lakh(buf)} buffer`, `Converts from the ${tk.parts.map((p) => monthName(p.bucket)).join(" + ")} balance (oldest first)`, volLine(tp.info)].concat(targetLine(S) ? [targetLine(S)] : [])),
          flagged: flaggedOb && S.flagConfirm["ob:" + flaggedOb.id] == null ? { type: "amount", ob: flaggedOb.id, label: `Confirm the expected ${flaggedOb.name.split(" (")[0]} amount (₹)`, value: Math.round(flaggedOb.amount), inr: true, why: `${flaggedOb.name.split(" (")[0]} varies month to month (₹${lakh(flaggedOb.low)}-₹${lakh(flaggedOb.high)} in the last year).` } : null,
          factors: grp[0].factors,
        };
        if (!S.skipped[key]) { recs.push(rec); tranches.forEach((t) => projConv.push({ date: t.date, inr: t.usd * fxNow })); }
        else {
          recs.push({ ...rec, skippedRec: true }); tk.parts.forEach((p) => (free[p.bucket] += p.usd));
          if (after < 0) recs.push({ key: "alert:skip:" + first.date, kind: "alert", conf: 30, title: `${joinNames(names).charAt(0).toUpperCase() + joinNames(names).slice(1)} will be short by ~₹${lakh(-after)}`, usd: ceil100(-after / fxNow), date: first.date, tranches: [],
            drivers: [`You skipped the conversion that funds this`, `Projected INR on ${pretty(first.date)}: ₹${lakh(after)} - the payment would fail or need an overdraft`, "Restore the recommendation below, or convert manually"] });
        }
      }
      if (tk.short * fxNow > TOL * 3) {
        // depend on expected receipts arriving before convDate
        const cands = recv.filter((e) => e.date < convDate && !usedRecv.has(e.id)).sort((a, b) => b.conf - a.conf);
        let need = tk.short, used = [];
        for (const e of cands) { if (need <= 0.5) break; used.push(e); usedRecv.add(e.id); need -= e.usd; }
        const usd = ceil100(Math.min(tk.short, used.reduce((s, e) => s + e.usd, 0)));
        const tkey = "topup:" + first.date;
        if (usd > 0) {
          const rconf = Math.min(...used.map((e) => e.conf));
          const low = used.filter((e) => e.conf < 80);
          const rec = {
            key: tkey, kind: "topup", conf: Math.min(conf, rconf), title: "Top up " + joinNames(names) + " from incoming receipts", usd, date: convDate,
            tranches: [{ date: convDate, usd }], receipts: used.map((e) => ({ id: e.id, client: e.client, usd: e.usd, date: e.date, conf: e.conf })),
            drivers: [`After the EEFC balance, ~$${fmtUsd(tk.short)} is still needed for ${names.join(" + ")}`,
              `Relies on ${used.length} expected receipt(s) totalling $${fmtUsd(used.reduce((s, e) => s + e.usd, 0))} before ${pretty(convDate)}`]
              .concat(used.map((e) => `${e.client}: $${fmtUsd(e.usd)} expected ~${shortDate(e.date)} - ${e.note || ""} (${e.conf}%)`)),
            flagged: low.length ? { type: "receipts", items: low.map((e) => ({ id: e.id, client: e.client, usd: e.usd, date: e.date, note: e.note })), label: "Do you expect these payments on time?", why: "Timing of these receipts is the uncertain input." } : null,
            factors: null,
          };
          if (!S.skipped[tkey]) { recs.push(rec); projConv.push({ date: convDate, inr: usd * fxNow }); }
          else recs.push({ ...rec, skippedRec: true });
        }
        if (need * fxNow > TOL) {
          recs.push({ key: "alert:" + first.date, kind: "alert", conf: 30, title: "Projected INR shortfall before " + joinNames(names), usd: ceil100(need), date: convDate,
            drivers: [`Even with expected receipts, ~₹${lakh(need * fxNow)} is uncovered`, "Options: delay a payment, use the INR buffer, or add a receipt you expect"], tranches: [] });
        }
      }
    }

    // 4) remaining balance in buckets whose deadline is in 11-45 days -> deadline tranche plan
    for (const id of ids) {
      const b = S.buckets.find((z) => z.id === id);
      const days = daysBetween(today, b.deadline);
      if (free[id] >= 1000 && days > 10 && days <= 45) {
        const usd = r2(free[id]);
        let d2 = b.execDate; for (let j = 0; j < 2; j++) d2 = prevBday(d2);
        let start = addDays(today, 1); while (!isBday(start)) start = addDays(start, 1);
        const tp = tranchePlan(S, usd, start, d2);
        const key = "plan:" + id;
        recs.push({
          key, kind: "deadline", conf: null, title: `Convert the rest of the ${monthName(id)} balance before its deadline`, usd, date: tp.tranches[0].date, bucket: id, deadline: b.deadline,
          tranches: tp.tranches, vol: tp.info,
          drivers: [`RBI EEFC rule: ${monthName(id)} receipts must be converted by ${pretty(b.deadline)}`, `No near-term INR need uses this $${fmtUsd(usd)} - spreading it avoids putting it all on one day's rate`, volLine(tp.info)].concat(targetLine(S) ? [targetLine(S)] : [], ["The deadline guardrail converts anything left on " + pretty(b.execDate)]),
        });
        free[id] = 0;
      }
    }

    // 4b) opportunity alert: rate well above its recent average -> offer to pull approved tranches forward
    {
      const cfg = cfgOf(S), ctx = marketContext(S);
      const pull = S.scheduled.filter((x) => !x.executed && x.date > today);
      const tHit = cfg.targetRate && ctx.rate >= cfg.targetRate;
      if (!tHit && ctx.premium >= cfg.alertPct && pull.length) {
        const usdP = r2(pull.reduce((s, x) => s + x.usd, 0));
        const key = "opp:" + today;
        const rec = { key, kind: "opportunity", conf: null, title: `USD/INR is ${ctx.premium.toFixed(2)}% above its 20-day average - convert approved tranches today?`, usd: usdP, date: today,
          tranches: pull.map((x) => ({ date: today, usd: x.usd })), pullIds: pull.map((x) => x.id),
          drivers: [`Today ${ctx.rate.toFixed(2)} vs 20-day average ${ctx.avg20.toFixed(2)} (+${ctx.premium.toFixed(2)}%) - your alert threshold is +${cfg.alertPct}%`,
            `${pull.length} approved tranche(s), $${fmtUsd(usdP)}, are scheduled for ${[...new Set(pull.map((x) => shortDate(x.date)))].join(", ")}`,
            `Converting today ≈ ₹${lakh(usdP * (ctx.rate - ctx.avg20))} more than at the 20-day average rate`,
            "A market alert, not a prediction - the rate may rise further or fall back. Your cash plan is unchanged either way."] };
        recs.push(S.skipped[key] ? { ...rec, skippedRec: true } : rec);
      }
    }

    // 5) question: one-off seen once
    const off = D.obligations.find((o) => o.id === "offsite");
    if (S.answers.offsite == null && off.dates[0] > today) {
      recs.push({ key: "q:offsite", kind: "question", conf: off.conf, title: "Will the team offsite recur this November?", usd: null, date: off.dates[0], inr: off.estimate,
        drivers: [`₹${lakh(off.estimate)} paid to Coorg Retreats on 14 Nov 2025 - seen only once`, "One occurrence is not enough to forecast, so the agent asks instead of guessing", "Your answer changes the November funding plan"], tranches: [] });
    }

    const rank = { opportunity: -1, locked: 0, alert: 1, hold: 2, fund: 3, topup: 4, question: 5, deadline: 6 };
    return recs.sort((a, b) => (a.skippedRec - b.skippedRec) || a.date.localeCompare(b.date) || rank[a.kind] - rank[b.kind]);
  }

  // ---------- projection for the cash calendar ----------
  function project(S, withRecs) {
    const fxNow = rate(S.date);
    const recs = withRecs ? plan(S).filter((r) => !r.skippedRec) : [];
    const conv = S.scheduled.filter((x) => !x.executed).map((x) => ({ date: x.date, inr: x.usd * fxNow }));
    recs.forEach((r) => (r.tranches || []).forEach((t) => conv.push({ date: t.date, inr: t.usd * fxNow })));
    if (!withRecs) {
      // without the agent: deadline guardrail still converts on deadline days
      const { free } = supply(S);
      S.buckets.forEach((b) => { if (b.execDate > S.date && b.execDate <= END && free[b.id] > 0.5) conv.push({ date: b.execDate, inr: free[b.id] * fxNow }); });
    }
    const obs = activeObligations(S).filter((o) => o.ccy === "INR");
    const out = []; let bal = S.inr; let d = S.date;
    out.push({ date: d, inr: bal });
    while (d < END) {
      d = addDays(d, 1);
      conv.filter((c) => c.date === d).forEach((c) => (bal += c.inr));
      obs.filter((o) => o.date === d).forEach((o) => (bal -= o.amount));
      out.push({ date: d, inr: bal });
    }
    return out;
  }

  // ---------- actions ----------
  const nowTime = (S) => { const n = S.audit.filter((a) => a.date === S.date).length; return `${String(10 + Math.min(n, 9)).padStart(2, "0")}:${String((n * 7) % 60).padStart(2, "0")}`; };
  function log(S, e) { S.audit.push({ date: S.date, time: nowTime(S), ...e }); }

  function approve(S, rec, opts) {
    opts = opts || {};
    const edited = !!opts.edited;
    const tranches = opts.tranches || rec.tranches || [];
    const auth = opts.auth || "Passkey (biometric)";
    const channel = opts.channel || "Dashboard";
    const fxNow = rate(S.date);
    S.metrics.decisions.push({ key: rec.key, title: rec.title, kind: rec.kind, conf: rec.conf, band: band(rec.conf, rec.kind), action: edited ? "edited" : "approved", date: S.date, channel });
    if (rec.kind === "opportunity") {
      const ids = new Set(rec.pullIds || []);
      S.scheduled.filter((x) => ids.has(x.id) && !x.executed).forEach((x) => { x.origDate = x.date; x.date = S.date; x.pulled = "opportunity alert"; });
      log(S, { actor: "Rohan Mehta (Founder)", event: "Opportunity alert accepted", detail: `Pulled ${ids.size} approved tranche(s) forward to today at ${fxNow.toFixed(2)}`, usd: rec.usd, rate: fxNow, rec: rec.key, rationale: rec.drivers.join(" | "), auth: auth + " · " + channel });
      S.scheduled.filter((x) => !x.executed && x.date <= S.date).forEach((x) => execConversion(S, x));
      return;
    }
    if (rec.kind === "hold") {
      const items = opts.items || rec.items;
      const usd = items.reduce((s, i) => s + i.usd, 0);
      S.holds.push({ key: rec.key, items: items.map((i) => ({ ...i })), usd, remainingUsd: usd, date: S.date });
      log(S, { actor: "Rohan Mehta (Founder)", event: edited ? "Hold approved (edited)" : "Hold approved", detail: `Keep $${fmtUsd(usd)} in EEFC for ${items.map((i) => i.name.split(" (")[0] + " (" + shortDate(i.date) + ")").join(", ")}`, usd, rec: rec.key, rationale: rec.drivers.join(" | "), auth: auth + " · " + channel, band: band(rec.conf, rec.kind), conf: rec.conf });
      return;
    }
    const totalUsd = tranches.reduce((s, t) => s + t.usd, 0);
    const co = totalUsd * fxNow > S.settings.coApproveInr;
    tranches.forEach((t, k) => {
      S.scheduled.push({ id: rec.key + "#" + k + "@" + S.date, recKey: rec.key, date: t.date, usd: t.usd, kind: rec.kind, executed: false, rationale: rec.title, coApproved: co, bucket: rec.bucket || (rec.sources && rec.sources[0] && rec.sources[0].bucket) || (rec.kind === "topup" ? bucketOf(t.date) : null), approvedRate: fxNow, approvedOn: S.date });
    });
    log(S, { actor: "Rohan Mehta (Founder)", event: (rec.kind === "locked" || rec.kind === "deadline" ? "Deadline conversion scheduled" : "Conversion approved") + (edited ? " (edited)" : ""),
      detail: tranches.map((t) => `$${fmtUsd(t.usd)} on ${pretty(t.date)}`).join("; ") + ` - ${rec.title}` + (cfgOf(S).targetRate ? ` · early if USD/INR ≥ ${cfgOf(S).targetRate.toFixed(2)}` : ""), usd: totalUsd, rate: fxNow, inr: totalUsd * fxNow, rec: rec.key, rationale: rec.drivers.join(" | "), auth: auth + " · " + channel, band: band(rec.conf, rec.kind), conf: rec.conf });
    if (co) log(S, { actor: "Ananya Rao (Finance Head)", event: "Co-approved", detail: `Above ₹${lakh(S.settings.coApproveInr)} threshold - second approval recorded`, usd: totalUsd, rec: rec.key, auth: "Passkey (biometric) · Mobile app" });
    // execute anything dated today
    S.scheduled.filter((x) => !x.executed && x.date <= S.date).forEach((x) => execConversion(S, x));
  }
  function skip(S, rec, channel) {
    S.skipped[rec.key] = true;
    S.metrics.decisions.push({ key: rec.key, title: rec.title, kind: rec.kind, conf: rec.conf, band: band(rec.conf, rec.kind), action: "skipped", date: S.date, channel: channel || "Dashboard" });
    log(S, { actor: "Rohan Mehta (Founder)", event: "Recommendation skipped", detail: rec.title, rec: rec.key, usd: rec.usd, auth: channel || "Dashboard" });
  }
  function answer(S, key, value, channel) {
    if (key === "q:offsite") S.answers.offsite = value;
    S.metrics.decisions.push({ key, title: "Team offsite question", kind: "question", conf: null, band: "Low", action: "answered:" + value, date: S.date, channel: channel || "Dashboard" });
    log(S, { actor: "Rohan Mehta (Founder)", event: "Question answered", detail: `Team offsite this November? -> ${value === "yes" ? "Yes" : value === "no" ? "No" : "Not sure"}`, rec: key, auth: channel || "Dashboard" });
  }
  function confirmFlag(S, flag, value) {
    if (flag.type === "amount") { S.flagConfirm["ob:" + flag.ob] = Number(value); log(S, { actor: "Rohan Mehta (Founder)", event: "Input confirmed", detail: `${flag.label}: ${flag.inr ? "₹" + Number(value).toLocaleString("en-IN") : "$" + fmtUsd(Number(value))}` }); }
    if (flag.type === "receipts") { flag.items.forEach((it) => (S.flagConfirm["rc:" + it.id] = value)); log(S, { actor: "Rohan Mehta (Founder)", event: "Input confirmed", detail: `Expected receipts (${flag.items.map((x) => x.client).join(", ")}): ${value === "yes" ? "on time" : "not sure"}` }); }
  }
  function setObligation(S, id, status, estimate) {
    S.obState[id] = { ...(S.obState[id] || {}), status };
    if (estimate != null) S.obState[id].estimate = estimate;
    const o = D.obligations.find((x) => x.id === id);
    log(S, { actor: "Rohan Mehta (Founder)", event: "Obligation " + status, detail: o.name + (estimate != null ? ` - amount set to ${o.ccy === "INR" ? "₹" + Number(estimate).toLocaleString("en-IN") : "$" + fmtUsd(estimate)}` : "") });
  }

  // ---------- simulation ----------
  function addLedger(S, l) { S.newLedger.push({ date: S.date, ...l }); }
  function execConversion(S, x, isGuardrail) {
    const fx = rate(S.date);
    const c = commitments(S, x.id);
    const ids = c.ids;
    const avail = (id) => (isGuardrail && id === x.bucket ? S.buckets.find((z) => z.id === id).remaining : Math.max(0, c.free[id]));
    let usd = x.usd;
    let need = usd; const parts = [];
    const order = x.bucket && c.free[x.bucket] != null ? [x.bucket, ...ids.filter((i) => i !== x.bucket)] : ids;
    for (const id of order) {
      const b = S.buckets.find((z) => z.id === id); const t = Math.min(avail(id), b.remaining, need);
      if (t > 0.001) { b.remaining = r2(b.remaining - t); b.converted = r2(b.converted + t); need -= t; parts.push({ bucket: id, usd: r2(t) }); }
      if (need <= 0.001) break;
    }
    usd = r2(usd - Math.max(0, need));
    const inr = usd * fx;
    S.inr += inr;
    x.executed = true; x.execDate = S.date; x.rate = fx; x.inr = inr; x.parts = parts;
    parts.forEach((p) => addLedger(S, { entry: "Debit - conversion to INR", ref: isGuardrail ? "Deadline guardrail" : "FX Strategist plan", usd: -p.usd, bucket: p.bucket }));
    const label = isGuardrail ? "Auto-converted (deadline guardrail)" : "Agent plan - approved";
    S.newConv.push({ date: S.date, type: label, usd, rate: fx, inr, bucket: parts.map((p) => p.bucket).join("+"), rec: x.recKey, approvedRate: x.approvedRate || null, approvedOn: x.approvedOn || null, pulled: x.pulled || null, origDate: x.origDate || null });
    S.newTx.push({ date: S.date, type: "Conversion", party: "USD to INR", ref: label, ccy: "USD", amount: usd, dir: "conv", note: `@ ${fx.toFixed(4)} = INR ${Math.round(inr).toLocaleString("en-IN")}` + (x.approvedRate ? ` (approved at ${x.approvedRate.toFixed(2)})` : ""), isNew: true });
    log(S, { actor: isGuardrail ? "Deadline guardrail" : "FX Strategist (agent)", event: isGuardrail ? "Auto-converted at deadline" : x.manualNow ? "Executed early (merchant request)" : x.pulled ? "Converted early (" + x.pulled + ")" : "Conversion executed", detail: `${x.rationale || ""}`.trim() + (x.approvedRate ? ` - approved ${shortDate(x.approvedOn)} at ${x.approvedRate.toFixed(2)}, executed at ${fx.toFixed(2)} (${(usd * (fx - x.approvedRate)) >= 0 ? "+" : "-"}INR ${Math.abs(Math.round(usd * (fx - x.approvedRate))).toLocaleString("en-IN")} vs estimate)` : ""), usd, rate: fx, inr, bucket: parts.map((p) => p.bucket).join("+"), rec: x.recKey, auth: isGuardrail ? "RBI rule - no approval needed" : (x.coApproved ? "Approved + co-approved" : "Approved") });
  }
  function stepDay(S) {
    const d = addDays(S.date, 1); S.date = d; const fx = rate(d);
    // 1 receipts
    for (const r of D.actual.receipts.filter((x) => x.date === d)) {
      const id = bucketOf(d);
      let b = S.buckets.find((z) => z.id === id);
      if (!b) { b = { id, received: 0, used: 0, converted: 0, remaining: 0, receiptRate: fx, deadline: bucketDeadline(id), execDate: onOrBeforeBday(bucketDeadline(id)), autoConverted: 0 }; S.buckets.push(b); }
      b.receiptRate = (b.receiptRate * b.received + fx * r.usd) / (b.received + r.usd);
      b.received = r2(b.received + r.usd); b.remaining = r2(b.remaining + r.usd);
      addLedger(S, { entry: "Credit - receipt", ref: r.id, usd: r.usd, bucket: id });
      S.newTx.push({ date: d, type: "Payment received", party: r.client, ref: r.id, ccy: "USD", amount: r.usd, dir: "in", note: "Settled to EEFC (USD)", isNew: true });
      const e = D.expected.find((z) => z.id === r.id);
      if (e) S.metrics.forecasts.push({ kind: "receipt", name: r.client, expected: e.date, actual: d, conf: e.conf, band: band(e.conf), errDays: daysBetween(e.date, d), hit: Math.abs(daysBetween(e.date, d)) <= 3 });
    }
    // 1b target rate: approved tranches convert early when the merchant's target is reached
    { const t = cfgOf(S).targetRate;
      if (t && fx >= t) {
        const early = S.scheduled.filter((x) => !x.executed && x.date > d);
        if (early.length) {
          early.forEach((x) => { x.origDate = x.date; x.date = d; x.pulled = "target rate"; });
          log(S, { actor: "FX Strategist (agent)", event: "Target rate reached", detail: `USD/INR ${fx.toFixed(2)} ≥ your target ${t.toFixed(2)} - ${early.length} approved tranche(s) ($${fmtUsd(early.reduce((s, x) => s + x.usd, 0))}) converted early, as instructed at approval`, rate: fx, auth: "Pre-approved instruction" });
        }
      } }
    // 2 scheduled conversions
    S.scheduled.filter((x) => !x.executed && x.date <= d).forEach((x) => execConversion(S, x));
    // 3 USD payables
    for (const p of D.actual.usd.filter((x) => x.date === d)) {
      const total = S.buckets.reduce((s, b) => s + b.remaining, 0);
      const ob = obligationView(S, D.obligations.find((o) => o.id === p.ob));
      S.metrics.forecasts.push({ kind: "obligation", name: p.payee, expected: ob.est, actual: p.usd, ccy: "USD", conf: ob.conf, band: band(ob.conf), err: (p.usd - ob.est) / p.usd, hit: p.usd >= ob.low && p.usd <= ob.high });
      if (total >= p.usd) {
        let need = p.usd;
        for (const b of [...S.buckets].sort((a, z) => z.id.localeCompare(a.id))) { const t = Math.min(b.remaining, need); if (t > 0) { b.remaining = r2(b.remaining - t); b.used = r2(b.used + t); need -= t; addLedger(S, { entry: "Debit - paid " + p.payee, ref: p.cat, usd: -r2(t), bucket: b.id }); } if (need <= 0.001) break; }
        const h = S.holds.find((hh) => !hh.released && hh.items.some((i) => i.ob === p.ob && i.date === p.date));
        if (h) { h.remainingUsd = Math.max(0, h.remainingUsd - h.items.find((i) => i.ob === p.ob && i.date === p.date).usd); if (h.remainingUsd <= 0.5) h.released = true; }
        S.metrics.avoided.push({ date: d, payee: p.payee, usd: p.usd, inr: p.usd * fx * D.meta.cardMarkup });
        S.newTx.push({ date: d, type: "USD payment", party: p.payee, ref: p.cat, ccy: "USD", amount: p.usd, dir: "out", note: "Paid from EEFC" + (h ? " (held by plan)" : ""), isNew: true });
      } else {
        const cost = p.usd * fx * (1 + D.meta.cardMarkup);
        S.inr -= cost;
        S.metrics.cardPaid.push({ date: d, payee: p.payee, usd: p.usd, inr: p.usd * fx * D.meta.cardMarkup });
        S.newTx.push({ date: d, type: "USD payment", party: p.payee, ref: p.cat, ccy: "USD", amount: p.usd, dir: "out", note: `${p.channel}: bought USD (INR ${Math.round(cost).toLocaleString("en-IN")})`, isNew: true });
      }
    }
    // 4 INR payables
    for (const p of D.actual.inr.filter((x) => x.date === d)) {
      if (p.conditional === "offsite" && S.answers.offsite !== "yes") continue;
      const before = S.inr;
      S.inr -= p.amount;
      const o0 = D.obligations.find((o) => o.id === p.ob);
      if (o0 && p.ob !== "offsite") { const ob = obligationView(S, o0); S.metrics.forecasts.push({ kind: "obligation", name: o0.name, expected: ob.est, actual: p.amount, ccy: "INR", conf: ob.conf, band: band(ob.conf), err: (p.amount - ob.est) / p.amount, hit: p.amount >= ob.low * 0.999 && p.amount <= ob.high * 1.001 }); }
      S.newTx.push({ date: d, type: "Payout", party: p.payee, ref: p.cat, ccy: "INR", amount: p.amount, dir: "out", note: (S.obState[p.ob] || {}).status === "removed" ? "Not in plan (removed by you)" : "As forecast", isNew: true });
      if (S.inr < 0) { S.metrics.shortfalls.push({ date: d, payee: p.payee, shortBy: -S.inr }); log(S, { actor: "System", event: "INR shortfall", detail: `${p.payee} payment of ₹${lakh(p.amount)} exceeded the INR balance (₹${lakh(before)}) - covered by overdraft`, inr: -S.inr }); }
      else if (S.inr < S.settings.buffer) log(S, { actor: "System", event: "Buffer breached", detail: `INR balance ₹${lakh(S.inr)} is below the ₹${lakh(S.settings.buffer)} buffer after ${p.cat}` });
    }
    // 5 deadline guardrail
    for (const b of S.buckets) {
      if (b.execDate === d && b.remaining > 0.5) {
        const amt = b.remaining;
        S.metrics.guardrail.push({ date: d, bucket: b.id, usd: amt });
        b.autoConverted = r2(b.autoConverted + amt);
        S.holds.filter((h) => !h.released).forEach((h) => (h.remainingUsd = Math.max(0, h.remainingUsd)));
        execConversion(S, { usd: amt, bucket: b.id, recKey: "guardrail:" + b.id, rationale: `${monthName(b.id)} balance not converted before the RBI deadline (${pretty(b.deadline)})` }, true);
      }
    }
    S.newDaily.push({ date: d, inr: S.inr, eefc: S.buckets.reduce((s, b) => s + b.remaining, 0) });
  }
  function advanceTo(S, target) { while (S.date < target && S.date < END) stepDay(S); }
  function nextEventDate(S) {
    const dates = []
      .concat(D.actual.receipts.map((r) => r.date), D.actual.usd.map((r) => r.date), D.actual.inr.filter((p) => !p.conditional || S.answers.offsite === "yes").map((r) => r.date))
      .concat(S.scheduled.filter((x) => !x.executed).map((x) => x.date), S.buckets.map((b) => b.execDate))
      .filter((d) => d > S.date && d <= END).sort();
    return dates[0] || END;
  }


  // next occurrence of a recurring obligation after `today` (rolls forward by cadence)
  function nextOccurrence(o, today) {
    const future = o.dates.filter((d) => d > today);
    if (future.length) return future[0];
    const step = o.cadence === "Monthly" ? 1 : o.cadence === "Quarterly" ? 3 : 0;
    if (!step) return null;
    let [y, m, d] = o.dates[o.dates.length - 1].split("-").map(Number);
    const baseDay = Number(o.dates[0].split("-")[2]) > 3 && o.id === "payroll" ? 1 : d;
    for (let k = 0; k < 24; k++) {
      m += step; while (m > 12) { m -= 12; y++; }
      let s = `${y}-${String(m).padStart(2, "0")}-${String(Math.min(o.id === "payroll" ? 1 : baseDay, 28)).padStart(2, "0")}`;
      while (!isBday(s)) s = addDays(s, 1);
      if (s > today) return s;
    }
    return null;
  }
  function allocation(S) { return commitments(S).out; }

  // ---------- metrics for the internal view ----------
  function outcomes(S) {
    const allConv = D.convHist.filter((c) => c.date >= D.meta.eefcStart).map((c) => ({ ...c, bucketId: c.bucket })).concat(S.newConv.map((c) => ({ ...c, bucketId: c.bucket.split("+")[0] })));
    let actualInr = 0, baseInr = 0;
    for (const c of allConv) { const b = S.buckets.find((z) => z.id === c.bucketId) || D.start.buckets.find((z) => z.id === c.bucketId); actualInr += c.inr; baseInr += c.usd * (b ? b.receiptRate : c.rate); }
    const histAvoided = D.tx.filter((t) => t.type === "USD payment" && t.note === "Paid from EEFC").reduce((s, t) => s + t.amount * rate(t.date) * D.meta.cardMarkup, 0);
    const avoided = histAvoided + S.metrics.avoided.reduce((s, a) => s + a.inr, 0);
    const cardCost = S.metrics.cardPaid.reduce((s, a) => s + a.inr, 0);
    const dec = S.metrics.decisions;
    const acted = dec.filter((x) => x.kind !== "question");
    const count = (a) => acted.filter((x) => x.action === a).length;
    const shown = [...new Set(Object.keys(S.metrics.shown).concat(dec.map((x) => x.key)))];
    const fc = S.metrics.forecasts;
    const bands = ["High", "Medium", "Low"].map((bn) => { const f = fc.filter((x) => x.band === bn); return { band: bn, n: f.length, hits: f.filter((x) => x.hit).length }; });
    return {
      rateEffect: actualInr - baseInr, actualInr, baseInr, avoided, cardCost, convCount: allConv.length,
      shown: shown.length, approved: count("approved"), edited: count("edited"), skipped: count("skipped"), answered: dec.filter((x) => x.kind === "question").length,
      ignored: shown.filter((k) => !dec.some((x) => x.key === k) && !k.startsWith("q:")).length,
      guardrail: S.metrics.guardrail, shortfalls: S.metrics.shortfalls, forecasts: fc, bands,
      deadlineMisses: S.buckets.filter((b) => b.deadline < S.date && b.remaining > 0.5).length,
      triggers: S.newConv.filter((c) => c.pulled).map((c) => ({ ...c, measured: c.origDate <= S.date, gain: c.origDate <= S.date ? c.usd * (c.rate - rate(c.origDate)) : null })),
      channels: { dashboard: dec.filter((x) => x.channel === "Dashboard").length, mobile: dec.filter((x) => x.channel !== "Dashboard").length },
    };
  }

  // ---------- formatting helpers ----------
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function monthName(id) { const [y, m] = id.split("-").map(Number); return MONTHS[m - 1] + "-" + y; }
  function pretty(s) { const d = parse(s); return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; }
  function shortDate(s) { const d = parse(s); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; }
  function weekday(s) { return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dow(s)]; }
  function lakh(x) { return (x / 1e5).toFixed(x >= 1e7 ? 1 : 2).replace(/\.?0+$/, (m) => (m.includes(".") ? "" : m)) + "L"; }
  function fmtUsd(x) { return Math.round(x).toLocaleString("en-US"); }
  function joinNames(n) { return n.length <= 1 ? n.join("") : n.slice(0, -1).join(", ") + " and " + n[n.length - 1]; }
  function band(c, kind) { if (kind === "opportunity") return "Market"; if (kind === "locked" || kind === "deadline") return "Locked"; if (c == null) return "Locked"; return c >= 80 ? "High" : c >= 50 ? "Medium" : "Low"; }


  // ---------- changing approved items (before execution) ----------
  const findSched = (S, id) => S.scheduled.find((x) => x.id === id && !x.executed);
  function schedLimits(S, id) {
    const x = findSched(S, id); if (!x) return null;
    const c = commitments(S, id);
    const avail = Object.values(c.free).reduce((s, v) => s + Math.max(0, v), 0);
    const b = x.bucket && S.buckets.find((z) => z.id === x.bucket);
    const latest = b ? b.execDate : END;
    return { maxUsd: Math.floor(avail * 100) / 100, latest, x };
  }
  function decision(S, x, action, channel) { S.metrics.decisions.push({ key: x.recKey, title: x.rationale, kind: x.kind, conf: null, band: "Changed", action, date: S.date, channel: channel || "Dashboard" }); }
  function editScheduled(S, id, usdNew, dateNew, channel) {
    const x = findSched(S, id); if (!x) return;
    const before = `$${fmtUsd(x.usd)} on ${pretty(x.date)}`;
    x.usd = r2(usdNew); x.date = dateNew; x.modified = true;
    log(S, { actor: "Rohan Mehta (Founder)", event: "Approved conversion changed", detail: `${x.rationale}: ${before} → $${fmtUsd(x.usd)} on ${pretty(x.date)}`, usd: x.usd, rec: x.recKey, auth: "Passkey (biometric) · " + (channel || "Dashboard") });
    decision(S, x, "changed", channel);
    if (x.date <= S.date) execConversion(S, x);
  }
  function executeNow(S, id, channel) {
    const x = findSched(S, id); if (!x) return;
    x.origDate = x.date; x.date = S.date; x.manualNow = true;
    log(S, { actor: "Rohan Mehta (Founder)", event: "Execute-now requested", detail: `${x.rationale}: $${fmtUsd(x.usd)} was due ${pretty(x.origDate)} - executing today`, usd: x.usd, rec: x.recKey, auth: "Passkey (biometric) · " + (channel || "Dashboard") });
    decision(S, x, "executed now", channel);
    execConversion(S, x);
  }
  function cancelScheduled(S, id, channel) {
    const x = findSched(S, id); if (!x) return;
    S.scheduled = S.scheduled.filter((z) => z !== x);
    if (x.recKey) delete S.skipped[x.recKey];
    log(S, { actor: "Rohan Mehta (Founder)", event: "Approved conversion cancelled", detail: `${x.rationale}: $${fmtUsd(x.usd)} on ${pretty(x.date)} cancelled - USD returned to the plan`, usd: x.usd, rec: x.recKey, auth: "Passkey (biometric) · " + (channel || "Dashboard") });
    decision(S, x, "cancelled", channel);
  }
  function editHold(S, key, usdNew, channel) {
    const h = S.holds.find((z) => z.key === key && !z.released); if (!h) return;
    const before = h.remainingUsd; h.remainingUsd = r2(usdNew); h.usd = r2(h.usd - before + usdNew);
    log(S, { actor: "Rohan Mehta (Founder)", event: "Hold changed", detail: `USD held for ${h.items.map((i) => i.name.split(" (")[0]).join(", ")}: $${fmtUsd(before)} → $${fmtUsd(usdNew)}`, usd: usdNew, rec: key, auth: "Passkey (biometric) · " + (channel || "Dashboard") });
    decision(S, { recKey: key, rationale: "Hold USD for bills", kind: "hold" }, "changed", channel);
  }
  function releaseHold(S, key, channel) {
    const h = S.holds.find((z) => z.key === key && !z.released); if (!h) return;
    h.released = true; h.cancelled = true;
    log(S, { actor: "Rohan Mehta (Founder)", event: "Hold released", detail: `$${fmtUsd(h.remainingUsd)} no longer held - those bills would be paid by card (~3% markup) unless re-planned`, usd: h.remainingUsd, rec: key, auth: "Passkey (biometric) · " + (channel || "Dashboard") });
    decision(S, { recKey: key, rationale: "Hold USD for bills", kind: "hold" }, "released", channel);
  }

  root.FXE = { schedLimits, editScheduled, executeNow, cancelScheduled, editHold, releaseHold, D, marketContext, cfgOf, nextOccurrence, allocation, initState, plan, project, approve, skip, answer, confirmFlag, setObligation, stepDay, advanceTo, nextEventDate, outcomes, obligationView, expectedReceipts, supply,
    rate, addDays, daysBetween, pretty, shortDate, monthName, lakh, fmtUsd, band, isBday, END };
})(typeof window !== "undefined" ? window : globalThis);
