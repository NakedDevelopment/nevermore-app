const fs = require('fs');
const path = require('path');

const target = path.resolve(__dirname, '..', 'node_modules', 'zustand', 'esm', 'middleware.mjs');
try {
  let src = fs.readFileSync(target, 'utf8');
  if (src.includes('import.meta.env')) {
    src = src.replace(/import\.meta\.env/g, "({MODE:'development'})");
    fs.writeFileSync(target, src);
    console.log('[patch-zustand] Replaced import.meta.env in', target);
  }
} catch (e) {
  console.warn('[patch-zustand] Skipped:', e.message);
}
