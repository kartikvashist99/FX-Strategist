# AI Build Log — FX Strategist

**Razorpay × ISB Build Challenge · Track 2: Recover and Grow with AI**
**Builder:** Kartik Vashist (ISB PGP)
**Prototype:** https://claude.ai/artifact/A2A3tRUdTtSecsUrqfPsbV (concept prototype, synthetic data — not an official Razorpay product)

FX Strategist is a planning agent for Razorpay's Multi-Currency EEFC Account. It decides *when and how much* foreign currency an exporter should convert to INR, around their cash needs and RBI's conversion deadline, and every conversion needs the merchant's authenticated approval.

---

## 1. AI tools and models used

| Tool | Used for |
|---|---|
| **Claude (Anthropic)**, configured model `claude-opus-5-5`, in the Claude app's agentic workspace | Research, product reasoning, stress-testing ideas, writing all code, testing, publishing |
| Claude web search / fetch | Verifying Razorpay docs and announcements, the RBI EEFC rule, Agent Studio's agent list |
| Python (pandas, numpy, openpyxl) — run by Claude | Seeded synthetic dataset (24 months) and an Excel workbook with live formulas |
| Node.js — run by Claude | Planning/simulation engine, tested headless |
| Playwright + headless Chromium — run by Claude | Automated UI tests of every flow, the guided demo and the timed video mode |
| Claude artifacts | Hosting the prototype as one self-contained HTML page (11 published versions) |

No other AI tools or models were used.

---

## 2. Key prompts, workflows and agent setup

**Setup:** one Claude agent in a single working session (~24 hours), no sub-agents. I set direction and made product calls; Claude researched, built, and tested; I reviewed the live link and corrected.

**Workflow loop (repeated for every change):**
`I specify or critique → Claude builds → automated engine + browser tests → republish → I review the live prototype → I correct`

**Key prompts (paraphrased, in order):**
1. "Explain both tracks against my background (3+ years at ION Group on FX platforms); I think AI PM fits."
2. "My idea: pick the best real-time rate across liquidity providers for each international transaction and log it for regulators — thoughts?" → stress-tested and rejected (see §3).
3. "EEFC accounts must be converted monthly — the agent should decide *when* to convert using payables, runway and market context."
4. "Add a history-based cash calendar, a confidence meter with colour bands, and WhatsApp approve/edit/skip."
5. "Generate two years of synthetic data for a SaaS merchant that covers every use case and confidence level."
6. "Build a live prototype: Home/transactions, Treasury (EEFC, cash calendar, FX Strategist), reports/audit log, settings, a phone flow, a date control, and a Razorpay-internal outcomes view."
7. Iterative fixes from my review (obligation dates, EEFC update timing, edits rippling into other recommendations, phone layout, Reset, Home as default).
8. "Add a guided demo that covers everything, plus an auto-play mode under 90 seconds."
9. "Add rate rules: merchant target rate, opportunity alerts, and volatility-aware tranching with a formula."
10. "Pilot on USD only and say so in the product." / "Approved items must stay editable until execution."

**Build structure (designed by Claude, reviewed by me):**
- `make_data` — seeded generator (reproducible numbers): clients, invoices, payroll, GST, AWS, FD sweeps, a synthetic USD/INR path.
- `engine` — obligation detection, confidence scoring, planner (holds, funding, top-ups, deadline plans, questions, alerts), day-by-day simulation, outcomes.
- `app` + `tour` — UI, phone flow, guided demo and video mode; bundled into one HTML file.

**Testing harness (run after every change):**
- Engine policy simulations: *approve everything*, *do nothing*, *skip everything*, *target rate set*, *accept opportunity alerts* — checking shortfalls, guardrail conversions, negative balances.
- Browser scripts: desktop approve/edit/skip, phone approve/edit, edit/execute-now/cancel on approved items, Reset with native pop-ups blocked, the full 28-step guided tour, Back/Restart/Restore, and a timed video-mode run.

---

## 3. AI output I rejected, corrected or significantly improved

### Primary: one-tap approval for high-confidence recommendations — rejected
Claude proposed that recommendations scoring ≥80% confidence could be approved with one tap on WhatsApp.
**I rejected it:** confidence measures how sure the agent is about the *cash forecast* — not who is holding the phone. One-tap approval would let anyone with the device move money.
**Change:** every conversion — and every later change to one — requires biometric/passkey approval inside the Razorpay app; a WhatsApp button can only open the app. Confidence now changes only *how much review* happens before authentication (High → summary card; Medium → confirm the flagged input; Low → the agent asks a question instead).

### Other corrections that shaped the product

**Bugs I caught while reviewing the live prototype**
- The obligations table kept showing "Next: 2 Nov" on 1 Dec — recurring dates didn't roll forward. Fixed to roll by cadence; the panel now collapses after first use.
- *Reset demo* silently did nothing — the artifact viewer blocks browser `confirm()`/`prompt()` pop-ups. Replaced every native pop-up with in-page dialogs and tested with pop-ups blocked.
- Approved dollars appeared to update only at month-end. Root cause: at execution, a conversion drew from the oldest bucket — including dollars already earmarked for a different approval — so the deadline guardrail later "rescued" the leftover. Fixed so each approval reserves its own bucket; approval now visibly earmarks USD, and execution happens on the planned date at that day's rate.
- Editing one recommendation didn't change the others; the phone hid the dashboard; panels vanished when empty; approved items couldn't be changed. All fixed: re-plan after every decision ("cover the remaining gap" cards, shortfall alerts on risky skips), smaller phone, always-visible panels, and edit / execute-now / cancel on approved items.

**Claude's own corrections from testing**
- The opportunity-alert threshold started at +0.5% above the 20-day average — it fired on day one because the rate already sat +0.65% above average. Raised to +0.8% so alerts mean something.
- Volatility tranching split a $2,000 GST conversion into $600 slices. Added a $5,000 minimum tranche.
- Rate drift created a meaningless $254 "remaining gap" recommendation. Added tolerances so the agent doesn't nag over trivial amounts.

**Pushback in the other direction (AI challenging my ideas)**
- **My original idea** — select the best liquidity-provider rate per transaction and log it for regulators. Claude checked Razorpay's own docs: merchants don't choose the rate (Razorpay and its bank convert, per the currency-conversion docs), e-FIRA already records the rate, picking the best of a few quotes is a `max()` rule not an AI problem, and an AI call would *add* latency where hardware and co-location matter. I agreed with the core critique and kept my FX expertise by pivoting to **EEFC conversion timing**, where the merchant genuinely owns the decision.
- **Rate prediction** — I proposed forecasting FX as the USP. Claude argued nobody forecasts USD/INR reliably over days or weeks, the outcomes view would expose it, and it reads as speculative advice from a payments company. **I chose the middle ground:** rate-*aware* features (merchant target rate, opportunity alerts, volatility-aware tranching) with no rate forecasting, and the north star excludes rate-timing gains.

---

## 4. What AI did vs. what I decided or built

| I decided | Claude did |
|---|---|
| Track 2 (AI PM) and an FX-domain idea grounded in my ION experience | Research: Razorpay docs, EEFC launch (20 Aug 2026), Agent Studio's 8 agents, RBI EEFC rule |
| Pivot to EEFC conversion timing; SaaS exporter persona | Stress-tested my first idea against Razorpay's docs |
| History-based cash calendar; current behaviour (convert at settlement, spreadsheets) from experience | Proposed the "avoidable costs, not rate gains" framing |
| Confidence meter with colour bands; WhatsApp approve/edit/skip | Defined confidence as *forecast* confidence; made bands change behaviour |
| **Authentication on every conversion**; no auto-execution | Synthetic dataset + Excel workbook with live formulas |
| Metrics beyond outcome: adoption, AI accuracy, acted-on rate | Planning engine, UI, phone flow, guided demo, video mode |
| Screen structure; phone flow incl. edit-before-auth; date simulation; outcomes internal-only | Volatility formula specifics, thresholds, tolerances |
| Edits ripple into other recommendations; Home as default; guided demo + video mode | Automated tests after every change |
| Rate rules (target, alerts) + volatility-aware tranching with a formula | Wrote this log's first draft from the session |
| USD-only pilot; post-approval edit/execute-now/cancel; always-visible panels | |
| Every bug catch listed in §3 | |

---

## 5. Known limitations, risks and verification

**Limitations**
- **All data is synthetic** — merchant (Lumio Analytics), clients, vendors and the USD/INR path are fictional.
- **The "AI" in the prototype is deterministic logic** running in the browser: pattern detection, a heuristic confidence score, and a rule-based planner. In production, a model would forecast obligations and client payment timing and write the reasoning; the confidence score would be a calibrated model output.
- **Confidence heuristic (illustrative):** `100 × history × timing × amount`, where history = √min(1, (n+3)/12); timing = 1 − min(0.4, σ_day/15) (0.6 if seen once); amount = 1 − min(0.5, CV of last 6), ×0.8 if the latest value breaks >10% from the prior average.
- **Cost assumptions not verified against current bank pricing:** 3% card FX markup (AWS, tools); 0.9% + ₹1,200 per outward wire.
- Single-merchant, single-browser demo state; biometric and co-approval are simulated; CSV export doesn't work inside the artifact viewer.

**Risks / open questions**
- **Current-behaviour evidence is experience-based** (convert at settlement; spreadsheets for the few who hold USD) and needs validation with merchants.
- **Value is modest per merchant by design** (~₹2.1L/year avoidable FX cost in the persona); the case rests on removing risk and effort, not on FX gains.
- The prototype uses Razorpay's name; it is labelled as a concept prototype throughout.

**Volatility-aware tranching (moved here from the one-pager)**
```
σ  = std. dev. of daily USD/INR log-returns, last 20 business days (%)
H  = business days from today to the payment / deadline window end
V  = σ × √H                                  (expected move, %)
n  = max( ⌈V ÷ risk budget⌉ , ⌈amount ÷ max tranche⌉ )
     capped by max tranches (5), ⌊amount ÷ $5,000⌋ and H
Tranches spread evenly so the last lands before the payment/deadline.
Defaults: risk budget 0.35%/tranche · max tranche $25,000 · alert at +0.8% vs 20-day average
```

**Verification performed**
- Facts checked against sources: RBI Master Direction (EEFC conversion by the last day of the following month); Razorpay currency-conversion docs; Razorpay Multi-Currency EEFC Account release; Razorpay Agent Studio blog.
- Excel workbook recalculated (237 formulas, 0 errors) and totals matched to the generator script (e.g. avoidable FX cost ₹3,90,489 over 22 months).
- Engine simulations on every change. Final results: following the plan → 0 shortfalls, 0 forced deadline conversions, no negative balances; doing nothing → 2 forced conversions, 3 payments short.
- Every UI flow browser-tested after each change; guided tour (28 steps) plays end to end with Back/Restart/Restore; video mode timed at ~62 seconds.

**Privacy:** no API keys, credentials, private data or proprietary information. No client or employer data was used — all figures are synthetic or from public sources.

---

## Sources
- RBI — Master Direction: Deposits and Accounts (EEFC): https://rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=10198
- Razorpay Docs — Currency Conversion: https://razorpay.com/docs/payments/payments/currency-conversion/
- Razorpay Newsroom — Multi-Currency EEFC Account: https://newsroom.razorpay.in/newsroom/razorpay-launches-multi-currency-account-helping-exporters-retain-international-earnings-in-foreign-currencies/
- Razorpay Blog — Agent Studio AI agents: https://razorpay.com/blog/agent-studio-ai-agents-by-razorpay
- Razorpay Blog — Agent Studio principles, guardrails and merchant control: https://razorpay.com/blog/razorpay-agent-studio-principles-guardrails-and-merchant-control/
