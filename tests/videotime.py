import time
from playwright.sync_api import sync_playwright
import pathlib
url = (pathlib.Path(__file__).resolve().parents[1] / "prototype" / "FX_Strategist_Prototype.html").as_uri()
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1440,"height":860})
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(url); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(300)
    pg.click('.modal [data-act=video]'); t0=time.time(); last=None; k=0
    while not pg.locator('#tourpanel [data-tour=keep]').count():
        cap=pg.locator('#tourpanel .vcap').inner_text() if pg.locator('#tourpanel .vcap').count() else None
        if cap!=last: print(f"{time.time()-t0:5.1f}s  {cap}"); pg.screenshot(path=f"shots/tour/v{k:02d}.png"); k+=1; last=cap
        pg.wait_for_timeout(250)
        if time.time()-t0>120: print("TIMEOUT"); break
    print("TOTAL", round(time.time()-t0,1), "s | date:", pg.locator('#demobar .date').inner_text())
    pg.click('#tourpanel [data-tour=exit]'); pg.wait_for_timeout(300); print("restored:", pg.locator('#demobar .date').inner_text())
    b.close()
print(errs or "no errors")
