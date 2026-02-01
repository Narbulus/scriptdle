import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DIST_DIR = 'dist';
const PACKS_FILE = 'public/data/packs-full.json';

let errors = [];

function error(msg) {
  errors.push(msg);
  console.error(`ERROR: ${msg}`);
}

function checkFile(path, description) {
  if (!existsSync(path)) {
    error(`Missing ${description}: ${path}`);
    return false;
  }
  console.log(`✓ ${description}`);
  return true;
}

function checkFileContains(path, substring, description) {
  if (!existsSync(path)) {
    error(`Missing file for ${description}: ${path}`);
    return false;
  }
  const content = readFileSync(path, 'utf-8');
  if (!content.includes(substring)) {
    error(`${description}: ${path} does not contain expected content "${substring}"`);
    return false;
  }
  console.log(`✓ ${description}`);
  return true;
}

function validateXml(path, description) {
  if (!existsSync(path)) {
    error(`Missing ${description}: ${path}`);
    return false;
  }
  const content = readFileSync(path, 'utf-8');
  if (!content.startsWith('<?xml') && !content.includes('<urlset')) {
    error(`${description}: ${path} does not appear to be valid XML`);
    return false;
  }
  console.log(`✓ ${description}`);
  return true;
}

function main() {
  console.log('Validating build artifacts...\n');

  console.log('Core files:');
  checkFileContains(
    join(DIST_DIR, 'index.html'),
    '<title>',
    'index.html with title tag'
  );

  validateXml(
    join(DIST_DIR, 'sitemap.xml'),
    'sitemap.xml'
  );

  checkFile(
    join(DIST_DIR, '_redirects'),
    '_redirects (SPA routing)'
  );

  console.log('\nStatic pages:');
  checkFile(
    join(DIST_DIR, 'about', 'index.html'),
    '/about page'
  );

  checkFile(
    join(DIST_DIR, 'stats', 'index.html'),
    '/stats page'
  );

  console.log('\nPack pages:');
  if (!existsSync(PACKS_FILE)) {
    error(`Packs file not found: ${PACKS_FILE}`);
  } else {
    const packsData = JSON.parse(readFileSync(PACKS_FILE, 'utf-8'));

    for (const pack of packsData.packs) {
      const packPagePath = join(DIST_DIR, 'play', pack.id, 'index.html');
      checkFile(packPagePath, `/play/${pack.id} page`);
    }
  }

  console.log('\nAssets:');
  const indexContent = existsSync(join(DIST_DIR, 'index.html'))
    ? readFileSync(join(DIST_DIR, 'index.html'), 'utf-8')
    : '';

  const jsMatch = indexContent.match(/src="(\/assets\/[^"]+\.js)"/);
  if (jsMatch) {
    const jsPath = join(DIST_DIR, jsMatch[1].slice(1));
    checkFile(jsPath, 'JavaScript bundle');
  } else {
    error('No JavaScript bundle reference found in index.html');
  }

  const cssMatch = indexContent.match(/href="(\/assets\/[^"]+\.css)"/);
  if (cssMatch) {
    const cssPath = join(DIST_DIR, cssMatch[1].slice(1));
    checkFile(cssPath, 'CSS bundle');
  }

  console.log('\n' + '='.repeat(50));

  if (errors.length > 0) {
    console.error(`\nBuild validation FAILED with ${errors.length} error(s)`);
    process.exit(1);
  }

  console.log('\nBuild validation PASSED');
}

main();
