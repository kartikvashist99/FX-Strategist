from playwright.sync_api import sync_playwright
import pathlib
url = (pathlib.Path(__file__).resolve().parents[1] / "prototype" / "FX_Strategist_Prototype.html").as_uri()
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1440,"height":860})
    pg.on("pageerror", lambda e: errs.append(str(e)))
    # simulate a sandbox that blocks dialogs: dismiss any native dialog
    pg.on("dialog", lambda d: (errs.append("NATIVE DIALOG: "+d.message), d.dismiss()))
    pg.goto(url); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(300); pg.click(".modal [data-act=mclose]")
    pg.fill('#godate','2026-12-01'); pg.click('[data-act=go]'); pg.wait_for_timeout(300)
    print("before reset:", pg.locator('#demobar .date').inner_text())
    pg.click('[data-act=reset]'); pg.wait_for_timeout(200); pg.click('[data-act=resetok]'); pg.wait_for_timeout(300)
    print("after reset:", pg.locator('#demobar .date').inner_text(), "| view:", pg.locator('main h1').inner_text())
    pg.reload(); pg.wait_for_timeout(300)
    print("after reload:", pg.locator('#demobar .date').inner_text())
    pg.click('[data-act=nav][data-v=strategist]'); pg.click('[data-act=obedit][data-v=payroll]'); pg.fill('#obedit-val','3800000'); pg.click('[data-act=obeditok]'); pg.wait_for_timeout(200)
    print("payroll row:", pg.locator('#obcard tr', has_text="Payroll").inner_text().replace("\n"," "))
    b.close()
print(errs or "no errors")
