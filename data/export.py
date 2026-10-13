"""Builds the demo scenario (agent's expected outputs) + exports data.json and the Excel workbook."""
import json, math
from datetime import date, timedelta
import numpy as np
import pandas as pd
import gen_data as g

DEMO, RATE = g.DEMO, g.rate(g.DEMO)
BUFFER = 800000

INV = g.INV.copy()
INR_HIST = pd.concat([g.INR_HIST, pd.DataFrame(g.sweeps)], ignore_index=True).sort_values("date").reset_index(drop=True)
USDP = g.USDP.copy()
CONV = g.CONV.copy()
LEDGER = g.LEDGER.copy()
DAILY = g.DAILY.copy()

# ---------------- pattern detection + confidence heuristic ----------------
def conf_score(n, sd_days, amounts, sd_scale=15):
    hist = min(1.0, (n + 3) / 12) ** 0.5
    timing = 0.6 if n < 2 else 1 - min(0.4, sd_days / sd_scale)
    a = np.array(amounts[-6:], dtype=float)
    cv = float(a.std() / a.mean()) if len(a) > 1 else 0.5
    amt = 1 - min(0.5, cv)
    brk = False
    if len(a) >= 3:
        prev = a[:-1].mean()
        if abs(a[-1] - prev) / prev > 0.10:
            amt *= 0.8
            brk = True
    return round(100 * hist * timing * amt), round(hist, 2), round(timing, 2), round(amt, 2), brk

def band(c):
    return "High" if c >= 80 else ("Medium" if c >= 50 else "Low")

patterns = []
def add_pattern(name, cur, dates, amounts, cadence, next_date, est, est_lo, est_hi, note, day_offsets=None):
    n = len(dates)
    if day_offsets is None:
        day_offsets = [d.day for d in dates]
    sd = float(np.std(day_offsets)) if n > 1 else 0.0
    c, h, t, a, brk = conf_score(n, sd, amounts)
    patterns.append(dict(obligation=name, currency=cur, cadence=cadence, occurrences_seen=n,
                         last_seen=dates[-1].isoformat(), next_expected=next_date.isoformat(),
                         estimate=round(est, 2), range_low=round(est_lo, 2), range_high=round(est_hi, 2),
                         confidence=c, band=band(c), history_factor=h, timing_factor=t, amount_factor=a,
                         trend_break=brk, agent_note=note))

H = INR_HIST
for cat, cad, nxt, note in [
    ("Payroll", "Monthly", date(2026, 11, 2), "Salary run on the 1st (next business day if weekend); steps up each April appraisal + Aug 2026 hires"),
    ("Rent", "Monthly", date(2026, 11, 5), "Fixed amount, 5% escalation each April"),
    ("GST", "Monthly", date(2026, 11, 20), "Paid on the 20th; amount varies month to month"),
]:
    r = H[H.category == cat]
    amts = r.amount_inr.tolist()
    est = amts[-1] if cat != "GST" else float(np.mean(amts[-6:]))
    lo, hi = (est * 0.98, est * 1.02) if cat != "GST" else (min(amts[-12:]), max(amts[-12:]))
    add_pattern(cat, "INR", r.date.tolist(), amts, cad, nxt, est, lo, hi, note)
# Dec payroll (falls right after the Oct-bucket deadline)
pr = [p for p in patterns if p["obligation"] == "Payroll"][0]
r = H[H.category == "Advance tax"]
add_pattern("Advance tax", "INR", r.date.tolist(), r.amount_inr.tolist(), "Quarterly", date(2026, 12, 15),
            600000, 550000, 700000, "Quarterly on 15 Jun/Sep/Dec/Mar; next is outside the 30-day window")
r = H[H.category == "Team offsite"]
add_pattern("Team offsite (Coorg Retreats)", "INR", r.date.tolist(), r.amount_inr.tolist(), "Unknown (seen once)",
            date(2026, 11, 13), 420000, 0, 450000, "Paid once in Nov 2025 - agent cannot tell if it recurs; asks the merchant")
U = USDP
for payee, cad, nxt, note in [
    ("AWS", "Monthly", date(2026, 11, 3), "Billed on the 3rd; usage spiked +18% in Sep and +31% in Oct (Atlas onboarding)"),
    ("Dev & collaboration tools", "Monthly", date(2026, 11, 9), "Fixed seat-based plan"),
    ("Marisol Vega Design LLC (US)", "Quarterly", date(2027, 1, 11), "Quarterly wire on the 10th; next is outside the window"),
]:
    r = U[U.payee == payee]
    amts = r.amount_usd.tolist()
    est = amts[-1]
    lo, hi = (est * 0.85, est * 1.15) if payee == "AWS" else (est, est)
    add_pattern(payee, "USD", r.date.tolist(), amts, cad, nxt, est, lo, hi, note)
PAT = pd.DataFrame(patterns)

# receivable behaviour per client
recv = []
for cid, grp in INV.groupby("client_id"):
    paid = grp[grp.status == "Paid"]
    if len(paid) == 0:
        continue
    lag = paid.days_after_due.astype(float).tolist()
    n = len(lag)
    c, h, t, a, brk = conf_score(n, float(np.std(lag)) if n > 1 else 0, paid.amount_usd.tolist(), sd_scale=25)
    last = grp.iloc[-1]
    recv.append(dict(client_id=cid, client=grp.client.iloc[0], plan=grp.plan.iloc[0], invoices_paid=n,
                     avg_days_after_due=round(float(np.mean(lag)), 1), sd_days=round(float(np.std(lag)), 1),
                     latest_amount_usd=float(grp[grp.status != "Scheduled (not yet invoiced)"].amount_usd.iloc[-1]),
                     timing_confidence=c, band=band(c),
                     status="Churned (last invoice Mar 2026)" if cid == "C03" else ("Annual payer" if grp.plan.iloc[0] == "Annual" else "Active")))
RECV = pd.DataFrame(recv).sort_values("client_id")

# ---------------- EEFC position at demo ----------------
b = {f"{k[0]}-{k[1]:02d}": round(v, 2) for k, v in g.buckets.items()}
sep_usd, oct_usd = b["2026-09"], b["2026-10"]
inr_now = float(DAILY.inr_balance.iloc[-1])
pay = pr["estimate"]; rent = [p for p in patterns if p["obligation"] == "Rent"][0]["estimate"]
gst = [p for p in patterns if p["obligation"] == "GST"][0]["estimate"]
aws = [p for p in patterns if p["obligation"] == "AWS"][0]
tools = [p for p in patterns if p["obligation"] == "Dev & collaboration tools"][0]
conf = {p["obligation"]: p["confidence"] for p in patterns}
rconf = {r.client: r.timing_confidence for r in RECV.itertuples()}

r1_inr = sep_usd * RATE
need_r2 = pay + rent + BUFFER - inr_now - r1_inr
r2_usd = math.ceil(need_r2 / RATE / 100) * 100
hold_usd = math.ceil((aws["range_high"] + tools["estimate"]) / 100) * 100
oct_left = round(oct_usd - r2_usd - hold_usd, 2)
dec_payroll = pay  # Dec payroll ~ same as Nov
expected_nov = INV[(INV.invoice_date >= date(2026, 11, 1)) & (INV.invoice_date < date(2026, 12, 1))]
ontime_nov = expected_nov[~expected_nov.client_id.isin(["C02", "C11"])].amount_usd.sum()
atlas_nov = float(expected_nov[expected_nov.client_id == "C11"].amount_usd.sum())
bright_oct = float(INV[(INV.client_id == "C02") & (INV.status == "Outstanding")].amount_usd.sum())
topup_inr = dec_payroll + gst - oct_left * RATE  # buffer already held
topup_usd = math.ceil(topup_inr / RATE / 100) * 100
tr1 = math.floor(oct_left / 2 / 100) * 100
tr2 = round(oct_left - tr1, 2)

recs = [
    dict(id="R1", order=1, type="LOCKED - deadline rule", title="Convert the remaining September balance",
         action=f"Convert USD {sep_usd:,.0f} from the Sep-2026 bucket on Fri 30 Oct 2026",
         usd=sep_usd, est_inr=round(r1_inr), deadline="2026-10-31 (Sat) - executes Fri 30 Oct",
         confidence=None, band="Locked",
         reasoning="RBI EEFC rule: September accruals must be converted by the last day of October. 31 Oct is a Saturday, so the agent schedules Friday. Cannot be skipped; amount is the unutilised balance.",
         merchant_can="View / change execution time only (must be on or before 30 Oct)", flagged_input=None),
    dict(id="R2", order=2, type="Recommendation", title="Fund the 2 Nov payroll and 5 Nov rent",
         action=f"Convert USD {r2_usd:,.0f} from the Oct-2026 bucket on Thu 29 Oct 2026",
         usd=r2_usd, est_inr=round(r2_usd * RATE), deadline="Before 2 Nov payroll",
         confidence=min(conf["Payroll"], conf["Rent"]), band=band(min(conf["Payroll"], conf["Rent"])),
         reasoning=f"Payroll ~INR {pay/1e5:.1f}L (24 of 24 months on the 1st/next business day) + rent INR {rent/1e5:.2f}L + INR 8L buffer, minus current INR balance INR {inr_now/1e5:.2f}L and the locked Sep conversion (~INR {r1_inr/1e5:.1f}L).",
         merchant_can="Approve / edit amount or date / skip", flagged_input=None),
    dict(id="R3", order=3, type="Recommendation", title="Hold USD for AWS and tools - do not convert",
         action=f"Keep USD {hold_usd:,.0f} in EEFC to pay AWS (3 Nov) and tools (9 Nov) directly in USD",
         usd=hold_usd, est_inr=0, deadline="3 Nov / 9 Nov",
         confidence=conf["AWS"], band=band(conf["AWS"]),
         reasoning=f"Paying from USD avoids buying dollars back at ~3% card markup (~INR {hold_usd*RATE*0.03/1e3:.1f}k saved). AWS estimate USD {aws['estimate']:,.0f} (range {aws['range_low']:,.0f}-{aws['range_high']:,.0f}); held amount covers the top of the range.",
         merchant_can="Confirm expected AWS bill, then approve / edit / skip",
         flagged_input=f"AWS bill amount - Oct was 31% above the prior 5-month average"),
    dict(id="R4", order=4, type="Question (low confidence)", title="Will the team offsite recur this November?",
         action="No conversion proposed until answered", usd=None, est_inr=420000, deadline="Answer before ~10 Nov",
         confidence=conf["Team offsite (Coorg Retreats)"], band=band(conf["Team offsite (Coorg Retreats)"]),
         reasoning="An INR 4.2L payment to Coorg Retreats appeared once (14 Nov 2025). One occurrence is not enough to forecast it, so the agent asks instead of guessing.",
         merchant_can="Yes (adds INR 4.2L to the Nov plan) / No / Not sure (agent keeps extra buffer)", flagged_input="Is this a recurring annual expense?"),
    dict(id="R5", order=5, type="Planned - deadline rule + AI timing", title="Convert the rest of the October balance in 2 tranches",
         action=f"Convert USD {tr1:,.0f} on Mon 16 Nov and USD {tr2:,.0f} on Thu 26 Nov",
         usd=oct_left, est_inr=round(oct_left * RATE), deadline="2026-11-30 (Oct accruals)",
         confidence=None, band="Locked",
         reasoning="October accruals must be converted by 30 Nov. Splitting into two dates avoids converting the whole balance at a single day's rate; the INR funds GST (20 Nov) and the 1 Dec payroll.",
         merchant_can="Change tranche dates/split (all must complete by 30 Nov)", flagged_input=None),
    dict(id="R6", order=6, type="Recommendation", title="Top up for the 1 Dec payroll from November receipts",
         action=f"Convert ~USD {topup_usd:,.0f} from November receipts around 27 Nov",
         usd=topup_usd, est_inr=round(topup_usd * RATE), deadline="Before 1 Dec payroll",
         confidence=min(rconf["Atlas Freight Partners"], rconf["Brightpath Health"], 100), band=band(min(rconf["Atlas Freight Partners"], rconf["Brightpath Health"])),
         reasoning=f"Depends on ~USD {ontime_nov:,.0f} from on-time clients (reliable), plus Atlas Freight USD {atlas_nov:,.0f} (new client, only 3 payments seen) and Brightpath's overdue Oct invoice USD {bright_oct:,.0f} (habitually 30-45 days late).",
         merchant_can="Confirm whether Atlas/Brightpath payments are expected, then approve / edit / skip",
         flagged_input="Timing of Atlas Freight (new) and Brightpath Health (late payer) receipts"),
]
RECS = pd.DataFrame(recs)

# ---------------- value at stake ----------------
pre = USDP[USDP.date < g.EEFC_START]
months_pre = 22
avoid_total = float(pre.avoidable_fx_cost_inr.sum())
value = dict(
    pre_eefc_months=months_pre,
    usd_costs_paid_by_buying_usd=float(pre.amount_usd.sum()),
    avoidable_fx_cost_inr_total=round(avoid_total),
    avoidable_fx_cost_inr_annualised=round(avoid_total / months_pre * 12),
    note="Cost of converting all USD to INR at settlement, then buying USD back (card 3% / wire 0.9% + fee) to pay AWS, tools and the contractor. Netting from EEFC removes this. Excludes any rate-timing effect, which is not claimed.",
)

# ---------------- coverage checklist ----------------
coverage = [
    ("Locked deadline conversion (no confidence score)", "R1, R5"),
    ("High-confidence recommendation (green)", "R2"),
    ("Medium confidence with flagged input (amber)", "R3, R6"),
    ("Low confidence -> agent asks a question (red)", "R4"),
    ("Netting USD payables instead of converting", "R3"),
    ("Recurring obligations detected from 24 months of history", "Detected_Patterns sheet"),
    ("Non-operating flow correctly ignored (FD sweeps, one-off equipment)", "INR_Outflows: Sweep to fixed deposit / Equipment"),
    ("Late-paying client", "Brightpath Health (C02)"),
    ("New large client with thin history", "Atlas Freight Partners (C11)"),
    ("Churned client (agent must not forecast its receipts)", "Cedar & Finch Retail (C03)"),
    ("Annual prepayment spikes", "Northgate (Jan), Bluefjord (Jul)"),
    ("Weekend deadline handling", "31 Oct 2026 is a Saturday -> R1 executes Fri 30 Oct"),
    ("Baseline vs agent value", "Value_at_Stake sheet"),
]

def ser(x):
    if isinstance(x, (date,)):
        return x.isoformat()
    if isinstance(x, (np.integer,)):
        return int(x)
    if isinstance(x, (np.floating,)):
        return None if np.isnan(x) else float(x)
    if isinstance(x, float) and math.isnan(x):
        return None
    return x

def recs_of(df):
    return [{k: ser(v) for k, v in r.items()} for r in df.to_dict("records")]

data = dict(
    meta=dict(generated_for="Razorpay AI PM Build Challenge prototype", synthetic=True, scenario_date=DEMO.isoformat(),
              usd_inr_today=RATE, inr_buffer_policy=BUFFER, assumptions=g.ASSUMPTIONS),
    merchant=dict(name="Lumio Analytics Pvt Ltd", city="Bengaluru", business="B2B SaaS (analytics platform)", billing_currency="USD",
                  employees_approx=42, razorpay_products=["Payment Gateway (international)", "MoneySaver Export Account - EEFC settlement"],
                  eefc_enabled_on=g.EEFC_START.isoformat()),
    position_today=dict(inr_balance=round(inr_now), eefc_buckets=[
        dict(bucket="2026-09", usd=sep_usd, deadline="2026-10-31", days_left=(date(2026, 10, 31) - DEMO).days),
        dict(bucket="2026-10", usd=oct_usd, deadline="2026-11-30", days_left=(date(2026, 11, 30) - DEMO).days)],
        eefc_total_usd=round(sep_usd + oct_usd, 2)),
    clients=[{k: (list(v) if isinstance(v, tuple) else v) for k, v in c.items()} for c in g.CLIENTS],
    receivable_behaviour=recs_of(RECV),
    detected_patterns=recs_of(PAT),
    recommendations=recs_of(RECS),
    value_at_stake=value,
    coverage=[dict(case=a, where=b_) for a, b_ in coverage],
    invoices=recs_of(INV),
    inr_outflows=recs_of(INR_HIST),
    usd_outflows=recs_of(USDP),
    conversions=recs_of(CONV),
    eefc_ledger=recs_of(LEDGER),
    daily_balances=recs_of(DAILY),
    fx_rates=[dict(date=d.isoformat(), usd_inr=v) for d, v in g.FX.items() if d >= g.START],
)
with open("lumio_data.json", "w") as f:
    json.dump(data, f, indent=1)

# expose for workbook builder
T = dict(INV=INV, INR=INR_HIST, USDP=USDP, CONV=CONV, LEDGER=LEDGER, DAILY=DAILY, PAT=PAT, RECV=RECV, RECS=RECS,
         value=value, coverage=coverage, data=data)
if __name__ == "__main__":
    print(json.dumps(data["position_today"], indent=1))
    print(RECS[["id", "action", "confidence", "band"]].to_string())
    print(PAT[["obligation", "occurrences_seen", "confidence", "band", "trend_break"]].to_string())
    print(RECV[["client", "avg_days_after_due", "sd_days", "timing_confidence", "band"]].to_string())
    print(value)
