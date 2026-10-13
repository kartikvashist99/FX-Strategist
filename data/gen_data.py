"""Synthetic 2-year dataset for an Indian B2B SaaS exporter on Razorpay (EEFC treasury agent demo).
ALL DATA IS SYNTHETIC. Assumptions are listed in ASSUMPTIONS below and exported to the workbook."""
import json, math
from datetime import date, timedelta
import numpy as np
import pandas as pd

rng = np.random.default_rng(11)
START = date(2024, 11, 1)
DEMO = date(2026, 10, 26)          # scenario "today" (Monday)
EEFC_START = date(2026, 9, 1)      # merchant switched on EEFC settlement (hold USD)
HORIZON_END = date(2026, 11, 30)

ASSUMPTIONS = {
    "Merchant": "Lumio Analytics Pvt Ltd (fictional) - Bengaluru B2B SaaS, bills US clients in USD via Razorpay",
    "Scenario date (today)": DEMO.isoformat(),
    "History window": f"{START.isoformat()} to {DEMO.isoformat()} (24 months)",
    "EEFC holding switched on": EEFC_START.isoformat() + " (before this, every USD receipt was converted to INR at settlement)",
    "Inbound conversion": "Razorpay live mid-market rate, 0% FX markup (per Razorpay's published MoneySaver pricing); platform fee ignored as it is identical in both scenarios",
    "Outward FX via corporate card (AWS, tools)": "3.0% all-in markup over mid (assumption; Indian business cards typically 2-3.5%)",
    "Outward FX via bank wire (contractor)": "0.9% markup over mid + Rs 1,200 flat charge per wire (assumption)",
    "EEFC rule": "Accruals in a calendar month must be converted to INR by the last day of the following month, after USD used for permitted payments (RBI Master Direction - Deposits and Accounts)",
    "USD/INR": "Synthetic daily mid-rate path (business days), ~84.1 to ~88.4; NOT real market data",
    "INR safety buffer policy": "Rs 8,00,000 minimum in INR current account (merchant setting)",
    "Confidence score": "Illustrative heuristic = history depth x timing regularity x amount stability (see Demo_Scenario notes)",
}

# ---------------- FX ----------------
cal = pd.date_range(START - timedelta(days=10), HORIZON_END, freq="D")
bdays = [d.date() for d in cal if d.weekday() < 5]
hist_b = [d for d in bdays if d <= DEMO]
n = len(hist_b)
s0, s1 = 84.08, 88.42
rets = rng.normal(0, 0.0021, n)
path = s0 * np.exp(np.cumsum(rets))
path = path * (s1 / path[-1]) ** (np.arange(1, n + 1) / n)
FX = {d: round(float(v), 4) for d, v in zip(hist_b, path)}

def rate(d):
    d0 = d
    while d not in FX:
        d -= timedelta(days=1)
        if (d0 - d).days > 10:
            raise ValueError(d0)
    return FX[d]

def bday(d):
    while d.weekday() >= 5:
        d += timedelta(days=1)
    return d

def months(a, b):
    y, m = a.year, a.month
    out = []
    while date(y, m, 1) <= b:
        out.append((y, m))
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out

HIST_MONTHS = months(START, DEMO)
SCHED_MONTHS = [(2026, 11), (2026, 12)]

# ---------------- Clients ----------------
# behaviour: ontime | late | new_large ; cycle: monthly | annual(month)
CLIENTS = [
    dict(id="C01", name="Harborline Logistics", country="US", cycle="monthly", amt=6200, start=(2024, 11), end=None, beh="ontime"),
    dict(id="C02", name="Brightpath Health", country="US", cycle="monthly", amt=6900, start=(2024, 11), end=None, beh="late"),
    dict(id="C03", name="Cedar & Finch Retail", country="US", cycle="monthly", amt=4100, start=(2024, 11), end=(2026, 3), beh="ontime"),
    dict(id="C04", name="Northgate Insurance Group", country="US", cycle="annual", month=1, amt=46800, start=(2025, 1), end=None, beh="ontime"),
    dict(id="C05", name="Bluefjord Media", country="UK", cycle="annual", month=7, amt=34500, start=(2025, 7), end=None, beh="ontime"),
    dict(id="C06", name="Quillmark Legal", country="US", cycle="monthly", amt=3700, start=(2024, 11), end=None, beh="ontime"),
    dict(id="C07", name="Solace Fitness", country="US", cycle="monthly", amt=3100, start=(2025, 2), end=None, beh="ontime"),
    dict(id="C08", name="Tidewater Credit Union", country="US", cycle="monthly", amt=7400, start=(2024, 11), end=None, beh="ontime"),
    dict(id="C09", name="Ember Labs", country="US", cycle="monthly", amt=2600, start=(2025, 6), end=None, beh="ontime"),
    dict(id="C10", name="Pinecrest Schools", country="US", cycle="monthly", amt=5200, start=(2025, 9), end=None, beh="ontime"),
    dict(id="C11", name="Atlas Freight Partners", country="US", cycle="monthly", amt=14500, start=(2026, 8), end=None, beh="new_large"),
    dict(id="C12", name="Kestrel Analytics", country="Canada", cycle="monthly", amt=5400, start=(2024, 11), end=None, beh="ontime"),
    dict(id="C13", name="Orchard Robotics", country="US", cycle="monthly", amt=2900, start=(2026, 3), end=None, beh="ontime"),
]
UPLIFT_FROM = (2026, 1)   # 6% list-price uplift on monthly plans

def active(c, ym):
    if ym < c["start"]:
        return False
    if c["end"] and ym > c["end"]:
        return False
    if c["cycle"] == "annual":
        return ym[1] == c["month"]
    return True

SCALE = 1.18
def amount(c, ym):
    a = round(c["amt"] * SCALE, -1)
    if c["cycle"] == "monthly" and ym >= UPLIFT_FROM and c["start"] < UPLIFT_FROM:
        a = round(a * 1.06, -1)
    return float(a)

invoices = []
k = 0
for ym in HIST_MONTHS + SCHED_MONTHS:
    for c in CLIENTS:
        if not active(c, ym):
            continue
        k += 1
        inv = bday(date(ym[0], ym[1], 1))
        due = inv + timedelta(days=15)
        if c["beh"] == "ontime":
            paid = inv + timedelta(days=int(rng.integers(5, 15)))
        elif c["beh"] == "late":
            paid = due + timedelta(days=int(rng.integers(22, 44)))
        else:
            paid = inv + timedelta(days=int(rng.integers(17, 25)))
        if c["cycle"] == "annual":
            paid = inv + timedelta(days=int(rng.integers(12, 22)))
        paid = bday(paid)
        rec = dict(invoice_id=f"INV-{ym[0]}{ym[1]:02d}-{c['id']}", client_id=c["id"], client=c["name"],
                   plan="Annual" if c["cycle"] == "annual" else "Monthly", currency="USD",
                   amount_usd=amount(c, ym), invoice_date=inv, due_date=due)
        if ym in SCHED_MONTHS:
            rec.update(status="Scheduled (not yet invoiced)", paid_date=None, days_after_due=None)
        elif paid > DEMO:
            rec.update(status="Outstanding", paid_date=None, days_after_due=None)
        else:
            rec.update(status="Paid", paid_date=paid, days_after_due=(paid - due).days)
        invoices.append(rec)
INV = pd.DataFrame(invoices)

# ---------------- Outflows ----------------
inr_out, usd_out = [], []
def add_inr(d, cat, payee, amt, recurring):
    inr_out.append(dict(date=bday(d), category=cat, payee=payee, amount_inr=round(amt), recurring=recurring))

for (y, m) in months(START, HORIZON_END):
    ym = (y, m)
    # payroll on 1st
    base = 2850000 if ym < (2025, 4) else (3192000 if ym < (2026, 4) else 3543000)
    if ym >= (2026, 8):
        base += 180000      # hires for Atlas account
    add_inr(date(y, m, 1), "Payroll", "Employees (salary run)", base * (1 + rng.normal(0, 0.004)), "Monthly")
    rent = 320000 if ym < (2026, 4) else 336000
    add_inr(date(y, m, 5), "Rent", "Prestige Workspace LLP", rent, "Monthly")
    add_inr(date(y, m, 20), "GST", "GSTN (domestic sales + RCM)", rng.uniform(120000, 240000), "Monthly")
    # quarterly advance tax
    adv = {(2024, 12): 550000, (2025, 3): 550000, (2025, 6): 240000, (2025, 9): 480000, (2025, 12): 480000,
           (2026, 3): 400000, (2026, 6): 300000, (2026, 9): 600000, (2026, 12): 600000}
    if ym in adv:
        add_inr(date(y, m, 15), "Advance tax", "Income Tax Dept", adv[ym], "Quarterly")
    if m == 9 and ym <= (2026, 9):
        add_inr(date(y, m, 24), "Audit & CA fees", "Rao & Mehta Chartered Accountants", 260000 if y == 2025 else 280000, "Annual")
    # USD: AWS on 3rd (card), tools on 7th (card), contractor quarterly on 10th (wire)
    i = (y - 2024) * 12 + m - 11
    aws = 3900 * (1.015 ** i) * (1 + rng.normal(0, 0.035))
    if ym == (2026, 9):
        aws *= 1.18
    if ym == (2026, 10):
        aws *= 1.31
    if ym <= (2026, 10):
        usd_out.append(dict(date=bday(date(y, m, 3)), category="Cloud hosting", payee="AWS", amount_usd=round(aws, 2), channel="Corporate card", recurring="Monthly"))
        usd_out.append(dict(date=bday(date(y, m, 7)), category="SaaS tools", payee="Dev & collaboration tools", amount_usd=1150.0 if ym < (2026, 1) else 1290.0, channel="Corporate card", recurring="Monthly"))
        if m in (1, 4, 7, 10):
            usd_out.append(dict(date=bday(date(y, m, 10)), category="Contractor", payee="Marisol Vega Design LLC (US)", amount_usd=9000.0, channel="Bank wire", recurring="Quarterly"))
# one-offs (non-recurring)
add_inr(date(2025, 11, 14), "Team offsite", "Coorg Retreats Pvt Ltd", 420000, "One-off (seen once)")
add_inr(date(2025, 3, 18), "Equipment", "Laptops - Croma Business", 386000, "One-off")
add_inr(date(2025, 8, 12), "Equipment", "Office furniture", 142000, "One-off")
add_inr(date(2026, 2, 9), "Legal", "Trademark filing", 65000, "One-off")
INR_ALL = pd.DataFrame(inr_out).sort_values("date").reset_index(drop=True)
USD_ALL = pd.DataFrame(usd_out).sort_values("date").reset_index(drop=True)
INR_HIST = INR_ALL[INR_ALL.date <= DEMO].copy()
INR_UPCOMING_KNOWN = INR_ALL[(INR_ALL.date > DEMO) & (INR_ALL.date <= HORIZON_END)].copy()

MARKUP = {"Corporate card": 0.03, "Bank wire": 0.009}
FEE = {"Corporate card": 0, "Bank wire": 1200}

# ---------------- Simulation ----------------
INR0 = 8000000.0
inr = INR0
buckets = {}             # (y,m) -> usd remaining
conv, ledger, usd_paid = [], [], []
MANUAL = {date(2026, 9, 29): "Manual - fund Oct payroll, rent & GST"}

def fifo_take(usd):
    out = []
    for key in sorted(buckets):
        if usd <= 1e-9:
            break
        t = min(buckets[key], usd)
        if t > 0:
            buckets[key] -= t
            usd -= t
            out.append((key, t))
    return out

def eefc_total():
    return sum(buckets.values())

daily_inr = []
sweeps = []
SWEEP_CAP, SWEEP_TO = 7500000, 6500000
d = START
while d <= DEMO:
    # receipts
    for _, r in INV[(INV.paid_date == d)].iterrows():
        if d < EEFC_START:
            rt = rate(d)
            inr += r.amount_usd * rt
            conv.append(dict(date=d, type="Auto at settlement", usd=r.amount_usd, rate=rt, inr=round(r.amount_usd * rt, 2), source=r.invoice_id, from_bucket=""))
        else:
            key = (d.year, d.month)
            buckets[key] = buckets.get(key, 0) + r.amount_usd
            ledger.append(dict(date=d, entry="Credit - receipt", ref=r.invoice_id, usd=r.amount_usd, bucket=f"{key[0]}-{key[1]:02d}"))
    # manual conversions (EEFC era)
    if d in MANUAL:
        rt = rate(d)
        need = INR_ALL[(INR_ALL.date > d) & (INR_ALL.date <= date(2026, 10, 20))].amount_inr.sum() + 800000 - inr
        usd = max(0, math.ceil(need / rt / 1000) * 1000)
        usd = min(usd, eefc_total())
        for key, t in fifo_take(usd):
            ledger.append(dict(date=d, entry="Debit - conversion to INR", ref=MANUAL[d], usd=-t, bucket=f"{key[0]}-{key[1]:02d}"))
            conv.append(dict(date=d, type=MANUAL[d], usd=t, rate=rt, inr=round(t * rt, 2), source="EEFC", from_bucket=f"{key[0]}-{key[1]:02d}"))
        inr += usd * rt
    # outflows
    for _, o in INR_HIST[INR_HIST.date == d].iterrows():
        inr -= o.amount_inr
    for _, o in USD_ALL[USD_ALL.date == d].iterrows():
        rt = rate(d)
        if d >= EEFC_START and eefc_total() >= o.amount_usd:
            for key, t in fifo_take(o.amount_usd):
                ledger.append(dict(date=d, entry=f"Debit - paid {o.payee}", ref=o.category, usd=-t, bucket=f"{key[0]}-{key[1]:02d}"))
            usd_paid.append(dict(**o.to_dict(), paid_from="EEFC (USD)", mid_rate=rt, inr_cost=0.0, avoidable_fx_cost_inr=0.0))
        else:
            cost = o.amount_usd * rt * (1 + MARKUP[o.channel]) + FEE[o.channel]
            avoid = o.amount_usd * rt * MARKUP[o.channel] + FEE[o.channel]
            inr -= cost
            usd_paid.append(dict(**o.to_dict(), paid_from="INR (bought USD)", mid_rate=rt, inr_cost=round(cost, 2), avoidable_fx_cost_inr=round(avoid, 2)))
    if date(2025, 10, 1) <= d < EEFC_START and d.day == 25 and inr > SWEEP_CAP:
        amt = math.floor((inr - SWEEP_TO) / 100000) * 100000
        inr -= amt
        sweeps.append(dict(date=d, category="Sweep to fixed deposit", payee="Treasury FD (non-operating)", amount_inr=amt, recurring="Rule-based (non-operating)"))
    daily_inr.append(dict(date=d, inr_balance=round(inr, 2), eefc_usd=round(eefc_total(), 2)))
    d += timedelta(days=1)

CONV = pd.DataFrame(conv)
LEDGER = pd.DataFrame(ledger)
USDP = pd.DataFrame(usd_paid)
DAILY = pd.DataFrame(daily_inr)

if __name__ == "__main__":
    print("INR at demo:", round(inr), " min INR:", DAILY.inr_balance.min(), "on", DAILY.loc[DAILY.inr_balance.idxmin(), "date"])
    print("Buckets:", {f"{k[0]}-{k[1]:02d}": round(v, 2) for k, v in buckets.items()})
    print("Rate at demo:", rate(DEMO)); print("INR 31 Aug:", DAILY[DAILY.date==date(2026,8,31)].inr_balance.values)
    print(CONV[CONV.date >= EEFC_START])
    print("Avoidable FX cost total:", USDP.avoidable_fx_cost_inr.sum())
    print(INV[INV.status != "Paid"][["invoice_id", "amount_usd", "status"]].head(40))
    print(USD_ALL.tail(8))
