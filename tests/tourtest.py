from playwright.sync_api import sync_playwright
import pathlib
url = (pathlib.Path(__file__).resolve().parents[1] / "prototype" / "FX_Strategist_Prototype.html").as_uri()
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1440,"height":860})
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(url); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(500)
    print("welcome modal:", pg.locator(".modal h2").inner_text())
    pg.evaluate("window.__tourSpeed=0.2")
    pg.click('.modal [data-act=tour]'); pg.wait_for_timeout(500)
    n=0
    while True:
        pg.wait_for_selector('#tourpanel [data-tour=next]:not([disabled]), #tourpanel [data-tour=keep]', timeout=60000)
        title=pg.locator('#tourpanel h4').inner_text(); hl=pg.locator('.tour-hl').count()
        pg.screenshot(path=f"shots/tour/{n:02d}.png")
        print(n, title, "| hl:", hl, "| date:", pg.locator('#demobar .date').inner_text(), "| cards:", pg.locator('.rec:not(.skipped)').count())
        if pg.locator('#tourpanel [data-tour=keep]').count(): break
        pg.click('#tourpanel [data-tour=next]'); pg.wait_for_timeout(300); n+=1
    print("LAST TEXT:", pg.locator('#tourpanel p').inner_text())
    # back from end
    pg.click('#tourpanel [data-tour=restart]'); pg.wait_for_timeout(400)
    for i in range(12): pg.wait_for_selector('#tourpanel [data-tour=next]:not([disabled])', timeout=60000); pg.click('#tourpanel [data-tour=next]'); pg.wait_for_timeout(200)
    pg.wait_for_selector('#tourpanel [data-tour=back]:not([disabled])', timeout=60000)
    print("at:", pg.locator('#tourpanel h4').inner_text()); pg.click('#tourpanel [data-tour=back]'); pg.wait_for_timeout(600)
    print("after back:", pg.locator('#tourpanel h4').inner_text(), "| cards:", pg.locator('.rec:not(.skipped)').count())
    pg.click('#tourpanel [data-tour=exit]'); pg.wait_for_timeout(400)
    print("restored date:", pg.locator('#demobar .date').inner_text(), "| panel gone:", pg.locator('#tourpanel').count()==0)
    b.close()
print(errs or "no errors")
