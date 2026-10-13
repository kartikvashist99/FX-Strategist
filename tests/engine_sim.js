// Engine policy simulations: runs the planner + day-by-day simulation from 26 Oct to 1 Dec 2026
// under different merchant behaviours and reports shortfalls, forced deadline conversions and balances.
// Usage (from repo root): node tests/engine_sim.js
const path = require("path");
globalThis.window = globalThis;
require(path.join(__dirname, "..", "src", "data.js"));
require(path.join(__dirname, "..", "src", "engine.js"));
const E = globalThis.FXE;

function run(label, policy, target) {
  const S = E.initState();
  if (target) S.settings.targetRate = target;
  const seen = new Set();
  for (let n = 0; S.date < E.END && n < 80; n++) {
    for (const r of E.plan(S)) {
      if (r.skippedRec || seen.has(r.key + S.date)) continue;
      seen.add(r.key + S.date);
      policy(S, r);
    }
    E.advanceTo(S, E.nextEventDate(S));
  }
  const o = E.outcomes(S);
  const negative = S.buckets.some((b) => b.remaining < -0.01);
  console.log(`${label.padEnd(30)} end INR ₹${Math.round(S.inr).toLocaleString("en-IN").padStart(10)} | forced deadline conversions ${o.guardrail.length} | INR shortfalls ${o.shortfalls.length} | rate-triggered tranches ${o.triggers.length} | negative balance: ${negative}`);
  return { o, negative };
}

const approveAll = (S, r) => {
  if (r.kind === "question") return E.answer(S, r.key, "yes");
  if (r.kind === "alert" || r.kind === "opportunity") return;
  if (r.flagged) E.confirmFlag(S, r.flagged, r.flagged.type === "amount" ? r.flagged.value : "yes");
  E.approve(S, E.plan(S).find((x) => x.key === r.key) || r);
};

const results = [
  run("Approve every recommendation", approveAll),
  run("Approve all + target 89.00", approveAll, 89),
  run("Approve all + accept alerts", (S, r) => (r.kind === "opportunity" ? E.approve(S, r) : approveAll(S, r))),
  run("Do nothing (baseline)", () => {}),
  run("Skip every recommendation", (S, r) => { if (!["locked", "deadline", "question", "alert", "opportunity"].includes(r.kind)) E.skip(S, r); }),
];
const ok = results.slice(0, 3).every((x) => x.o.shortfalls.length === 0 && x.o.guardrail.length === 0 && !x.negative);
console.log(ok ? "\nPASS: following the plan gives zero shortfalls and zero forced conversions" : "\nFAIL");
process.exit(ok ? 0 : 1);
