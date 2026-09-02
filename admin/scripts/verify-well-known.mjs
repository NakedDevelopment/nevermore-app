// Fails the build if the Universal Link / App Link association files are
// missing from dist, or still contain a placeholder fingerprint.
//
// These files are what let iOS and Android open invite, password-reset and
// magic-URL links in the app instead of a browser. If they 404 or are served
// with the wrong content type, deep linking silently degrades to a web page
// and nobody notices until a user complains.
import { existsSync, readFileSync, mkdirSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'public', '.well-known');
const outDir = join(root, 'dist', '.well-known');

// Some bundler versions skip dot-directories in public/ — copy defensively.
if (!existsSync(outDir) && existsSync(srcDir)) {
  mkdirSync(dirname(outDir), { recursive: true });
  cpSync(srcDir, outDir, { recursive: true });
  console.log('[well-known] copied .well-known into dist');
}

const required = ['apple-app-site-association', 'assetlinks.json'];
const problems = [];

for (const name of required) {
  const file = join(outDir, name);
  if (!existsSync(file)) {
    problems.push(`missing: dist/.well-known/${name}`);
    continue;
  }
  const raw = readFileSync(file, 'utf8');
  try {
    JSON.parse(raw);
  } catch {
    problems.push(`invalid JSON: dist/.well-known/${name}`);
    continue;
  }
  if (raw.includes('REPLACE_WITH_')) {
    problems.push(
      `placeholder left in dist/.well-known/${name} — fill in the real value ` +
        `(Play Console -> Test and release -> Setup -> App integrity -> ` +
        `App signing key certificate -> SHA-256)`
    );
  }
}

if (problems.length) {
  console.error('\n[well-known] deep-link association check FAILED:');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}

console.log('[well-known] association files present and valid');
