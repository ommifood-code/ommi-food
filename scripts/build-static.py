"""Build only public assets; never publish SQL, tests or credentials."""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
out=root/'dist'
if out.exists(): shutil.rmtree(out)
out.mkdir()
for name in ['index.html','admin.html','terms.html','style.css','dish-images.css','meal-orders.css','simple-launch.css','app.js','dish-images.js','meal-orders.js','nearby.js','simple-launch.js','admin.js','admin-orders.js','_headers']:
 shutil.copy2(root/name,out/name)
shutil.copytree(root/'vendor',out/'vendor')
print('Static files ready in dist/')
