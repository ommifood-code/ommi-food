"""Build only public assets; never publish SQL, tests or credentials."""
from pathlib import Path
import hashlib
import re
import shutil
import subprocess
root=Path(__file__).resolve().parents[1]
out=root/'dist'
# Never replace a working output with files that fail the release gate.
subprocess.run(['node', str(root/'tests/run.cjs')], cwd=root, check=True)
if out.exists(): shutil.rmtree(out)
out.mkdir()
for name in ['index.html','admin.html','terms.html','style.css','dish-images.css','meal-orders.css','simple-launch.css','order-rules.js','app.js','dish-images.js','meal-orders.js','nearby.js','simple-launch.js','kitchen-settings.js','kitchen-overview.js','food-requests.js','navigation-state.js','food-request-admin.js','admin.js','admin-orders.js','_headers']:
 shutil.copy2(root/name,out/name)
shutil.copytree(root/'vendor',out/'vendor')
# Asset changes invalidate their own cached URLs; no hand-maintained version date.
for page in out.glob('*.html'):
 def version(match):
  asset=out/match[2]
  if not asset.is_file():
   raise RuntimeError(f'Missing published asset: {match[2]}')
  digest=hashlib.sha256(asset.read_bytes()).hexdigest()[:16]
  return f'{match[1]}="{match[2]}?v={digest}"'
 page.write_text(re.sub(r'(src|href)="([^"?:]+\.(?:js|css))(?:\?[^"\s]*)?"',version,page.read_text()))
print('Static files ready in dist/')
