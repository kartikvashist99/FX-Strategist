from playwright.sync_api import sync_playwright
import pathlib
def SHOT(n):
    d = pathlib.Path(__file__).resolve().parent / "shots"; (d / n).parent.mkdir(parents=True, exist_ok=True); return str(d / n)
url = (pathlib.Path(__file__).resolve().parents[1] / "prototype" / "FX_Strategist_Prototype.html").as_uri()
errs=[]
def auth(pg): pg.click('#fp'); pg.wait_for_timeout(1500)
def pend(pg): return [r.replace("\n"," ").replace("\t"," ") for r in pg.locator('#pending-card tbody tr').all_inner_texts()]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1440,"height":860}); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(url); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(300); pg.click(".modal [data-act=mclose]")
    pg.click("[data-act=nav][data-v=strategist]"); pg.wait_for_timeout(200)
    print("EMPTY pending:", pend(pg)); print("EMPTY decisions:", pg.locator("#decisions-card").locator('tbody').inner_text())
    pg.screenshot(path=SHOT("70_empty.png"), full_page=True)
    # approve first two recs
    pg.locator('[data-act=approve]').first.click(); auth(pg)
    pg.locator('[data-act=approve]').first.click(); auth(pg)
    print("AFTER 2 APPROVALS:", pend(pg))
    # edit second scheduled: amount down, later date
    pg.locator('[data-act=schedit]').nth(1).click(); pg.fill('#se-u','99999'); pg.click('[data-act=scheditok]'); pg.wait_for_timeout(200)
    print("over-limit msg:", pg.locator('#se-msg').inner_text())
    pg.fill('#se-u','20000'); pg.fill('#se-d','2026-10-29'); pg.click('[data-act=scheditok]'); pg.wait_for_timeout(200); auth(pg)
    print("AFTER EDIT:", pend(pg)); print("new gap rec?", [t for t in pg.locator('.rec h3').all_inner_texts() if 'gap' in t])
    # execute now the first
    inr_before=pg.locator('.kpi').count()
    pg.locator('[data-act=schnow]').first.click(); auth(pg)
    print("AFTER EXECUTE NOW:", pend(pg))
    pg.click("[data-act=nav][data-v=eefc]"); pg.wait_for_timeout(200); print("Sep card:", pg.locator('[data-bucket="2026-09"]').inner_text().replace("\n"," | ")[:260])
    pg.click("[data-act=nav][data-v=strategist]"); pg.wait_for_timeout(200)
    # cancel remaining
    pg.locator('[data-act=schcancel]').first.click(); pg.click('[data-act=schcancelok]'); auth(pg)
    print("AFTER CANCEL:", pend(pg)); print("payroll rec back:", [t for t in pg.locator('.rec h3').all_inner_texts() if 'payroll (2 Nov)' in t.lower()])
    print("DECISIONS:", pg.locator("#decisions-card").locator('tbody').inner_text().replace("\n"," | ").replace("\t"," "))
    pg.click("[data-act=nav][data-v=reports]"); pg.wait_for_timeout(200)
    print("AUDIT top:", [r.split("\n")[0:3] for r in pg.locator('#auditcard tbody tr').all_inner_texts()[:4]])
    pg.click("[data-act=nav][data-v=strategist]"); pg.wait_for_timeout(200); pg.screenshot(path=SHOT("71_after.png"), full_page=True)
    b.close()
print(errs or "no errors")
