from playwright.sync_api import sync_playwright
import pathlib
def SHOT(n):
    d = pathlib.Path(__file__).resolve().parent / "shots"; (d / n).parent.mkdir(parents=True, exist_ok=True); return str(d / n)
url = (pathlib.Path(__file__).resolve().parents[1] / "prototype" / "FX_Strategist_Prototype.html").as_uri()
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1600,"height":950})
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(url); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(400); pg.click(".modal [data-act=mclose]"); pg.wait_for_timeout(150); pg.click("[data-act=nav][data-v=strategist]"); pg.wait_for_timeout(150)
    pg.locator('[data-act=approve]').first.click(); pg.click('#fp'); pg.wait_for_timeout(1800)
    pg.click('[data-act=nav][data-v=eefc]'); pg.wait_for_timeout(200); pg.screenshot(path=SHOT("30_eefc_after_approve.png"))
    for i in range(3): pg.click('[data-act=next]'); pg.wait_for_timeout(200)
    pg.screenshot(path=SHOT("31_eefc_after_exec.png"))
    pg.click('[data-act=nav][data-v=strategist]'); pg.wait_for_timeout(200); pg.screenshot(path=SHOT("32_strat_later.png"))
    pg.click('[data-act=obopen]'); pg.wait_for_timeout(200); pg.screenshot(path=SHOT("33_ob_open.png"))
    b.close()
print(errs or "no errors")
