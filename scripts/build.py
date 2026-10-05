"""Copy only public assets to the Pages artifact."""
import pathlib, shutil, runpy
ROOT=pathlib.Path(__file__).resolve().parents[1]
runpy.run_path(str(ROOT/'scripts/validate.py'))
out=ROOT/'_site';out.mkdir(exist_ok=True)
for name in ['assets','data']:
    shutil.copytree(ROOT/name,out/name,dirs_exist_ok=True)
shutil.copy2(ROOT/'index.html',out/'index.html')
(out/'.nojekyll').touch()
print('Pages artifact ready: _site')
