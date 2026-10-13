"""Builds proto/data.js for the prototype from the synthetic generator (same seed, same numbers as the workbook)."""
import json, sys, math
from datetime import date, timedelta
import numpy as np
import pathlib
HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import gen_data as g
import export as X

def iso(d):
    return d.isoformat() if isinstance(d, date) else d

def bday(d):
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d

# ---- FX: history from 1 Aug 2026 + deterministic future path to 4 Dec ----
fx = {iso(d): v for d, v in g.FX.items() if d >= date(2026, 8, 1)}
rng = np.random.default_rng(2027)
# future path: drift down, a choppy rally peaking 11 Nov (for target-rate / opportunity demo), then easing
anchors = [("2026-10-26", g.FX[g.DEMO]), ("2026-10-30", 87.96), ("2026-11-05", 87.84), ("2026-11-09", 88.32), ("2026-11-10", 88.86),
           ("2026-11-11", 89.12), ("2026-11-12", 88.62), ("2026-11-13", 88.58), ("2026-11-20", 88.18), ("2026-12-01", 87.86), ("2026-12-04", 87.92)]
A = [(date.fromisoformat(a), v) for a, v in anchors]
d = g.DEMO + timedelta(days=1)
while d <= date(2026, 12, 4):
    if d.weekday() < 5:
        for (a0, v0), (a1, v1) in zip(A, A[1:]):
            if a0 < d <= a1:
                f = (d - a0).days / (a1 - a0).days
                v = v0 + (v1 - v0) * f
                if d != a1:
                    v += rng.normal(0, 0.05)
                fx[iso(d)] = round(v, 4)
                break
    d += timedelta(days=1)

# ---- History transactions (for Home / Transactions) ----
tx = []
for _, i in X.INV.iterrows():
    if i.status == "Paid":
        tx.append(dict(date=iso(i.paid_date), type="Payment received", party=i.client, ref=i.invoice_id, ccy="USD", amount=float(i.amount_usd), dir="in",
                       note=("Settled to EEFC (USD)" if i.paid_date >= g.EEFC_START else "Converted to INR at settlement")))
for _, o in X.INR_HIST.iterrows():
    tx.append(dict(date=iso(o.date), type="Payout" if o.category != "Sweep to fixed deposit" else "Transfer to FD", party=o.payee, ref=o.category, ccy="INR",
                   amount=float(o.amount_inr), dir="out", note=o.recurring))
for _, o in X.USDP.iterrows():
    tx.append(dict(date=iso(o.date), type="USD payment", party=o.payee, ref=o.category, ccy="USD", amount=float(o.amount_usd), dir="out",
                   note=("Paid from EEFC" if o.paid_from.startswith("EEFC") else f"{o.channel}: bought USD (INR {o.inr_cost:,.0f})")))
for _, c in X.CONV.iterrows():
    tx.append(dict(date=iso(c.date), type="Conversion", party="USD to INR", ref=c.type, ccy="USD", amount=float(c.usd), dir="conv",
                   note=f"@ {c.rate:.4f} = INR {c.inr:,.0f}"))
tx.sort(key=lambda t: t["date"], reverse=True)

ledger = [dict(date=iso(l.date), entry=l.entry, ref=l.ref, usd=float(l.usd), bucket=l.bucket) for _, l in X.LEDGER.iterrows()]
conv_hist = [dict(date=iso(c.date), type=c.type, usd=float(c.usd), rate=float(c.rate), inr=float(c.inr), bucket=c.from_bucket) for _, c in X.CONV.iterrows()]
daily = [dict(date=iso(r_.date), inr=float(r_.inr_balance), eefc=float(r_.eefc_usd)) for _, r_ in X.DAILY.iterrows() if r_.date >= date(2026, 8, 1)]

# bucket stats (received / used / converted) since EEFC start
buckets = {}
for l in ledger:
    b = buckets.setdefault(l["bucket"], dict(id=l["bucket"], received=0, used=0, converted=0, receipts_rate_sum=0.0))
    if l["entry"].startswith("Credit"):
        b["received"] += l["usd"]
        b["receipts_rate_sum"] += l["usd"] * g.rate(date.fromisoformat(l["date"]))
    elif "conversion" in l["entry"]:
        b["converted"] += -l["usd"]
    else:
        b["used"] += -l["usd"]
for b in buckets.values():
    b["remaining"] = round(b["received"] - b["used"] - b["converted"], 2)

# ---- Detected obligations (agent's learned patterns) ----
P = {p["obligation"]: p for p in X.data["detected_patterns"]}
def ob(id_, key, name, ccy, cad, dates, note, kind="recurring"):
    p = P[key]
    return dict(id=id_, name=name, ccy=ccy, cadence=cad, seen=p["occurrences_seen"], lastSeen=p["last_seen"], dates=dates,
                estimate=p["estimate"], low=p["range_low"], high=p["range_high"], conf=p["confidence"], note=note, kind=kind,
                factors=dict(history=p["history_factor"], timing=p["timing_factor"], amount=p["amount_factor"], trendBreak=p["trend_break"]))
obligations = [
    ob("payroll", "Payroll", "Payroll (salary run)", "INR", "Monthly", ["2026-11-02", "2026-12-01"], P["Payroll"]["agent_note"]),
    ob("rent", "Rent", "Office rent", "INR", "Monthly", ["2026-11-05"], P["Rent"]["agent_note"]),
    ob("gst", "GST", "GST payment", "INR", "Monthly", ["2026-11-20"], P["GST"]["agent_note"]),
    ob("advtax", "Advance tax", "Advance tax (Q3)", "INR", "Quarterly", ["2026-12-15"], P["Advance tax"]["agent_note"]),
    ob("aws", "AWS", "AWS (cloud hosting)", "USD", "Monthly", ["2026-11-03"], P["AWS"]["agent_note"]),
    ob("tools", "Dev & collaboration tools", "Dev & collaboration tools", "USD", "Monthly", ["2026-11-09"], P["Dev & collaboration tools"]["agent_note"]),
    ob("contractor", "Marisol Vega Design LLC (US)", "US design contractor", "USD", "Quarterly", ["2027-01-11"], P["Marisol Vega Design LLC (US)"]["agent_note"]),
    ob("offsite", "Team offsite (Coorg Retreats)", "Team offsite (Coorg Retreats)", "INR", "Seen once", ["2026-11-13"], P["Team offsite (Coorg Retreats)"]["agent_note"], kind="question"),
]

# ---- Expected receipts (agent forecast) and actual future events (ground truth for the simulation) ----
RB = {r_["client"]: r_ for r_ in X.data["receivable_behaviour"]}
inv_nov = X.INV[(X.INV.invoice_date >= date(2026, 11, 1)) & (X.INV.invoice_date < date(2026, 12, 1))]
expected, actual_receipts = [], []
lag_actual = {"C01": 9, "C06": 8, "C07": 10, "C08": 9, "C09": 7, "C10": 11, "C12": 8, "C13": 10}
for _, i in inv_nov.iterrows():
    rb = RB[i.client]
    if i.client_id == "C02":
        continue   # Nov invoice from the late payer lands after 1 Dec
    exp_date = bday(i.due_date + timedelta(days=round(rb["avg_days_after_due"])))
    expected.append(dict(id=i.invoice_id, client=i.client, usd=float(i.amount_usd), date=iso(exp_date), conf=rb["timing_confidence"],
                         note=("New client - 3 payments seen" if i.client_id == "C11" else f"Usually pays {abs(rb['avg_days_after_due']):.0f} days {'before' if rb['avg_days_after_due']<0 else 'after'} due")))
    act = bday(i.invoice_date + timedelta(days=lag_actual.get(i.client_id, 18)))
    actual_receipts.append(dict(id=i.invoice_id, client=i.client, usd=float(i.amount_usd), date=iso(act)))
bo = X.INV[(X.INV.client_id == "C02") & (X.INV.status == "Outstanding")].iloc[0]
rb = RB["Brightpath Health"]
expected.append(dict(id=bo.invoice_id, client=bo.client, usd=float(bo.amount_usd), date=iso(bday(bo.due_date + timedelta(days=round(rb["avg_days_after_due"])))),
                     conf=rb["timing_confidence"], note="Overdue - habitually pays 30-45 days after due"))
actual_receipts.append(dict(id=bo.invoice_id, client=bo.client, usd=float(bo.amount_usd), date="2026-11-24"))

pay = float(X.pr["estimate"])
actual_inr = [
    dict(date="2026-11-02", ob="payroll", payee="Employees (salary run)", cat="Payroll", amount=round(pay * 1.0012)),
    dict(date="2026-11-05", ob="rent", payee="Prestige Workspace LLP", cat="Rent", amount=336000),
    dict(date="2026-11-13", ob="offsite", payee="Coorg Retreats Pvt Ltd", cat="Team offsite", amount=435000, conditional="offsite"),
    dict(date="2026-11-20", ob="gst", payee="GSTN (domestic sales + RCM)", cat="GST", amount=171200),
    dict(date="2026-12-01", ob="payroll", payee="Employees (salary run)", cat="Payroll", amount=round(pay * 1.0031)),
]
actual_usd = [
    dict(date="2026-11-03", ob="aws", payee="AWS", cat="Cloud hosting", usd=7946.18, channel="Corporate card"),
    dict(date="2026-11-09", ob="tools", payee="Dev & collaboration tools", cat="SaaS tools", usd=1290.0, channel="Corporate card"),
]

pos = X.data["position_today"]
DATA = dict(
    meta=dict(today=g.DEMO.isoformat(), end="2026-12-01", eefcStart=g.EEFC_START.isoformat(), buffer=800000, cardMarkup=0.03, wireMarkup=0.009,
              historicalAvoidable=X.value["avoidable_fx_cost_inr_total"], historicalMonths=22, historicalAnnual=X.value["avoidable_fx_cost_inr_annualised"],
              historicalUsdCosts=X.value["usd_costs_paid_by_buying_usd"]),
    merchant=X.data["merchant"],
    start=dict(inr=pos["inr_balance"], buckets=[dict(id=k, received=round(v["received"], 2), used=round(v["used"], 2), converted=round(v["converted"], 2),
                                                     remaining=v["remaining"], receiptRate=round(v["receipts_rate_sum"] / v["received"], 4)) for k, v in sorted(buckets.items())]),
    fx=fx, tx=tx, ledger=ledger, convHist=conv_hist, daily=daily,
    obligations=obligations, expected=expected, clients=X.data["receivable_behaviour"],
    actual=dict(receipts=actual_receipts, inr=actual_inr, usd=actual_usd),
)
with open(HERE.parent / "src" / "data.js", "w") as f:
    f.write("window.FX_DATA = " + json.dumps(DATA, separators=(",", ":")) + ";\n")
print("ok", len(tx), "tx;", DATA["start"])
print([(e["client"], e["date"], e["conf"]) for e in expected])
