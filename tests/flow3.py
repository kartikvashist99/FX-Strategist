from playwright.sync_api import sync_playwright
import pathlib
url = (pathlib.Path(__file__).resolve().parents[1] / "prototype" / "FX_Strategist_Prototype.html").as_uri()
def card(pg, title):
    return pg.locator(".bucket", has_text=title).inner_text().replace("\n"," | ")
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={"width":1600,"height":950})
    pg.goto(url); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(300); pg.click(".modal [data-act=mclose]"); pg.wait_for_timeout(150); pg.click("[data-act=nav][data-v=strategist]"); pg.wait_for_timeout(150)
    pg.click('[data-act=nav][data-v=eefc]'); print("BEFORE  Sep:", card(pg,"Sep-2026")); print("tiles:", pg.locator(".kpi").all_inner_texts()[1:3])
    pg.click('[data-act=nav][data-v=strategist]'); pg.locator('[data-act=approve]').first.click(); pg.click('#fp'); pg.wait_for_timeout(1800)
    pg.click('[data-act=nav][data-v=eefc]'); print("AFTER APPROVE Sep:", card(pg,"Sep-2026")); print("tiles:", pg.locator(".kpi").all_inner_texts()[1:3])
    # edit next rec to today's date -> should execute immediately
    pg.click('[data-act=nav][data-v=strategist]'); pg.locator('[data-act=edit]').first.click(); pg.fill('#ed-d-0','2026-10-26'); pg.click('[data-act=edsave]'); pg.click('#fp'); pg.wait_for_timeout(1800)
    pg.click('[data-act=nav][data-v=eefc]'); print("AFTER TODAY-DATED APPROVE Oct:", card(pg,"Oct-2026")); print("ledger top:", pg.locator("table.t tbody tr").first.inner_text().replace("\n"," "))
    for i in range(4):
        pg.click('[data-act=day]'); pg.wait_for_timeout(150)
    print("DATE", pg.locator("#demobar .date").inner_text()); print("ON 30 OCT Sep:", card(pg,"Sep-2026"))
    b.close()
