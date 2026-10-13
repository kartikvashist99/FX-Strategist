from playwright.sync_api import sync_playwright
import pathlib
url = (pathlib.Path(__file__).resolve().parents[1] / "prototype" / "FX_Strategist_Prototype.html").as_uri()
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for w,h in [(1366,768),(1600,900)]:
        pg=b.new_page(viewport={"width":w,"height":h}); pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(url); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(400); pg.click(".modal [data-act=mclose]"); pg.wait_for_timeout(150); pg.click("[data-act=nav][data-v=strategist]"); pg.wait_for_timeout(150)
        titles=lambda: [t for t in pg.locator(".rec:not(.skipped) h3").all_inner_texts()]
        before=titles()
        pg.screenshot(path=f"shots/40_layout_{w}.png")
        pg.click(".notif"); pg.click('#phone [data-act=ph][data-v=app]'); pg.click('#phone [data-act=ph][data-v=bio]'); pg.click('#phfp'); pg.wait_for_timeout(1500)
        after=titles()
        print(w, "cards before", len(before), "after phone approval", len(after), "| removed:", set(before)-set(after))
        pg.screenshot(path=f"shots/41_after_phone_{w}.png")
        # phone edit down payroll -> gap card
        pg.click('#phone [data-act=ph][data-v=wa]'); pg.click('#phone [data-act=ph][data-v=appedit]'); (pg.fill('#phe-u-0','15000') if pg.locator('#phe-u-0').is_enabled() else None); pg.click('#phone [data-act=pheditok]'); pg.click('#phfp'); pg.wait_for_timeout(1500)
        print("   after phone edit:", titles())
        pg.close()
    b.close()
print(errs or "no errors")
