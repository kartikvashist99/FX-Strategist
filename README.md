# FX Strategist — concept prototype

**Razorpay × ISB Build Challenge · Track 2: Recover and Grow with AI** · Kartik Vashist (ISB PGP)

FX Strategist is the decision layer for Razorpay's Multi-Currency EEFC Account: an agent that plans **when and how much** foreign currency an Indian exporter should convert to INR — around payroll, bills, client payment habits and RBI's EEFC conversion deadline — with every conversion approved by the merchant.

- **Live prototype:** https://claude.ai/artifact/A2A3tRUdTtSecsUrqfPsbV (or open `prototype/FX_Strategist_Prototype.html` locally in Chrome)
- **AI build log:** [`AI_Build_Log.md`](AI_Build_Log.md)

> Concept prototype built for a student challenge. **All data is synthetic** (merchant, clients, vendors, USD/INR path). Not an official Razorpay product. No secrets, credentials or proprietary data in this repository.

---

## Repository layout

```
prototype/  FX_Strategist_Prototype.html   ← the single-file prototype (what the link serves)
src/        index.html, styles.css         ← page shell and styles
            engine.js                      ← planner, simulation, outcomes (pure logic, runs in browser and Node)
            app.js                         ← dashboard UI, phone flow, settings, reports
            tour.js                        ← guided demo + 🎬 video mode
            data.js                        ← compact data layer generated from data/
            bundle.py                      ← bundles everything into one HTML file
data/       gen_data.py                    ← seeded generator: 24 months of synthetic history
            export.py                      ← detected patterns, confidence, demo scenario, value at stake
            build_xlsx.py                  ← Excel workbook with live formulas
            make_data.py                   ← builds src/data.js for the prototype
            Lumio_Synthetic_Treasury_Data.xlsx, lumio_data.json
tests/      engine_sim.js                  ← policy simulations (approve all / do nothing / skip / rate rules)
            flow*.py, tourtest.py, videotime.py ← Playwright browser tests
AI_Build_Log.md
```

## Architecture

```
data/gen_data.py ──► data/export.py ──► data/make_data.py ──► src/data.js
   (seeded history)   (patterns, confidence)                     │
                                                                 ▼
                     src/engine.js  ◄── merchant decisions ── src/app.js + src/tour.js
                     • obligation detection & confidence          (dashboard, WhatsApp→app
                     • planner: hold / fund / top-up /             flow, guided demo,
                       deadline / question / alert / opportunity   video mode)
                     • volatility-aware tranching, rate rules
                     • day-by-day simulation + RBI guardrail
                     • outcomes (Razorpay-internal metrics)
                                 │
                     src/bundle.py ──► prototype/FX_Strategist_Prototype.html
```

**Key rules in the engine**
- Each month's EEFC receipts form a bucket that must be converted by the last day of the following month (RBI Master Direction — Deposits and Accounts). The deadline guardrail is the only automatic action.
- Confidence = certainty about the **cash forecast** (obligation amounts/dates, client payment timing) — never the FX rate. High ≥80% → quick approve; Medium 50–79% → confirm the flagged input; Low <50% → the agent asks a question.
- Approval earmarks USD from a bucket; conversion executes on the planned date at that day's rate. Approved items can be edited, executed now or cancelled until then. The plan is recomputed after every decision.
- Volatility-aware tranching: `n = max(⌈σ_daily × √H ÷ risk budget⌉, ⌈amount ÷ max tranche⌉)`, capped by max tranches (5), a $5,000 minimum tranche and the business days `H` available; tranches spread evenly before the payment or deadline.
- Rate-aware, not rate-predicting: merchant target rate (pre-approved early conversion) and opportunity alerts (+0.8% vs 20-day average), labelled "not a prediction".

**In production** the obligation forecasting, client-timing forecasts and recommendation reasoning would come from a model with calibrated confidence; in this prototype they are deterministic rules and an illustrative heuristic (documented in the build log).

## Run it

```bash
# open the prototype
open prototype/FX_Strategist_Prototype.html        # or double-click it

# regenerate data (Python 3, pandas, numpy, openpyxl)
python3 data/make_data.py                            # writes src/data.js
cd src && python3 bundle.py && cd ..                 # rebuilds prototype/FX_Strategist_Prototype.html

# tests
node tests/engine_sim.js                             # engine policy simulations
pip install playwright && python3 -m playwright install chromium
python3 tests/flow.py                                # UI flow (see other tests/*.py)
python3 tests/tourtest.py                            # full guided demo
python3 tests/videotime.py                           # video mode timing
```

In the prototype: **Reset demo** returns to Mon 26 Oct 2026; **▶ Guided demo** walks every feature; **🎬 Video mode** auto-plays the key moments in ~1 minute; **Razorpay internal** shows the outcome metrics.

## Synthetic data assumptions
Merchant *Lumio Analytics* (fictional), Bengaluru B2B SaaS, 13 clients billed in USD. History 1 Nov 2024 – 26 Oct 2026; EEFC settlement switched on 1 Sep 2026. Inbound conversion at live mid-rate with 0% markup; outward USD via corporate card at 3% markup, via wire at 0.9% + ₹1,200 (assumptions, not verified bank pricing). USD/INR is a synthetic path. Full list on the workbook's README sheet.
