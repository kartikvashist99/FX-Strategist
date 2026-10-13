from playwright.sync_api import sync_playwright
import pathlib
def SHOT(n):
    d = pathlib.Path(__file__).resolve().parent / "shots"; (d / n).parent.mkdir(parents=True, exist_ok=True); return str(d / n)
url = (pathlib.Path(__file__).resolve().parents[1] / "prototype" / "FX_Strategist_Prototype.html").as_uri()
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1600, "height": 950})
    pg.on("pageerror", lambda e: errs.append("PAGEERR " + str(e)))
    pg.goto(url); pg.wait_for_timeout(500)
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(500); pg.click(".modal [data-act=mclose]"); pg.wait_for_timeout(150); pg.click("[data-act=nav][data-v=strategist]"); pg.wait_for_timeout(150)
    # phone: notification -> WA
    pg.click(".notif"); pg.wait_for_timeout(200); pg.screenshot(path=SHOT("10_wa.png"), clip={"x":1200,"y":44,"width":400,"height":800})
    pg.click('#phone [data-act=ph][data-v=app]'); pg.wait_for_timeout(200); pg.screenshot(path=SHOT("11_app.png"), clip={"x":1200,"y":44,"width":400,"height":800})
    pg.click('#phone [data-act=ph][data-v=bio]'); pg.wait_for_timeout(200); pg.screenshot(path=SHOT("12_bio.png"), clip={"x":1200,"y":44,"width":400,"height":800})
    pg.click('#phfp'); pg.wait_for_timeout(1300); pg.screenshot(path=SHOT("13_done.png"), clip={"x":1200,"y":44,"width":400,"height":800})
    pg.click('#phone [data-act=ph][data-v=wa]'); pg.wait_for_timeout(200)
    # next phone rec: payroll fund -> edit
    pg.click('#phone [data-act=ph][data-v=appedit]'); pg.wait_for_timeout(200)
    (pg.fill('#phe-u-0', '25000') if pg.locator('#phe-u-0').is_enabled() else None); pg.click('#phone [data-act=pheditok]'); pg.wait_for_timeout(200)
    pg.click('#phfp'); pg.wait_for_timeout(1300); pg.screenshot(path=SHOT("14_done_edit.png"), clip={"x":1200,"y":44,"width":400,"height":800})
    # desktop: confirm AWS flag then approve hold
    pg.wait_for_selector('[data-act=flagok]')
    pg.click('[data-act=flagok] >> nth=0'); pg.wait_for_timeout(300)
    pg.screenshot(path=SHOT("15_after_flag.png"), full_page=True)
    btn = pg.locator('[data-act=approve]').first
    btn.click(); pg.wait_for_timeout(200); pg.screenshot(path=SHOT("16_auth_modal.png"))
    pg.click('#fp'); pg.wait_for_timeout(2500)
    # answer question
    pg.click('[data-act=ans][data-v=yes]'); pg.wait_for_timeout(300)
    pg.screenshot(path=SHOT("17_plan_after.png"), full_page=True)
    # edit modal on a fund rec
    pg.locator('[data-act=edit]').first.click(); pg.wait_for_timeout(200); pg.screenshot(path=SHOT("18_edit_modal.png"))
    pg.click('[data-act=mclose]')
    # advance time
    for i in range(4):
        pg.click('[data-act=next]'); pg.wait_for_timeout(300)
    pg.click('[data-act=nav][data-v=eefc]'); pg.wait_for_timeout(200); pg.screenshot(path=SHOT("19_eefc_later.png"), full_page=True)
    pg.click('[data-act=nav][data-v=reports]'); pg.wait_for_timeout(200); pg.screenshot(path=SHOT("20_audit.png"))
    pg.click('[data-act=rtab][data-v=comp]'); pg.wait_for_timeout(200); pg.screenshot(path=SHOT("21_comp.png"))
    pg.fill('#godate', '2026-12-01'); pg.click('[data-act=go]'); pg.wait_for_timeout(400)
    pg.click('[data-act=mode][data-v=i]'); pg.wait_for_timeout(300); pg.screenshot(path=SHOT("22_outcomes_end.png"), full_page=True)
    pg.click('[data-act=mode][data-v=m]'); pg.click('[data-act=nav][data-v=calendar]'); pg.wait_for_timeout(300); pg.screenshot(path=SHOT("23_cal_end.png"))
    b.close()
print("\n".join(errs) or "no page errors")
