s=open('index.html').read()
s=s.replace('<!--CSS-->','<style>\n'+open('styles.css').read()+'\n</style>')
appjs=open('app.js').read().replace('  /*TOUR*/', open('tour.js').read())
js=''.join('<script>\n'+x+'\n</script>\n' for x in [open('data.js').read(), open('engine.js').read(), appjs])
s=s.replace('<!--JS-->',js)
open('FX_Strategist_Prototype.html','w').write(s)
print(len(s))
# Copy the bundle into prototype/ so the tests and the published page use the same file
import pathlib, shutil
shutil.copy("FX_Strategist_Prototype.html", pathlib.Path(__file__).resolve().parents[1] / "prototype" / "FX_Strategist_Prototype.html")
