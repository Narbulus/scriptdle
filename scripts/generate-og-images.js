// TODO: Consider integrating into CI/CD build pipeline for automatic regeneration
// Currently run manually: node scripts/generate-og-images.js (requires dev server running)
// Images are committed to public/og-images/ and referenced by prerender.js

import puppeteer from 'puppeteer';
import { readFileSync, mkdirSync } from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:6768';
const packsData = JSON.parse(readFileSync('./public/data/packs-full.json', 'utf-8'));

const QUOTE_SELECTIONS = {
  'star-wars': 12,
  'harry-potter': 2123,
  'the-lord-of-the-rings': 3195,
  'shrek': 112,
  'bttf-trilogy': 25,
};

function loadQuotesForPack(packId) {
  const packManifest = JSON.parse(readFileSync(`./public/data/packs/${packId}.json`, 'utf-8'));
  const quotes = [];
  for (const movieId of packManifest.movies) {
    try {
      const script = JSON.parse(readFileSync(`./public/data/scripts/${movieId}.json`, 'utf-8'));
      script.lines.forEach(line => quotes.push({ ...line, movie: script.title }));
    } catch { /* script not found, skip */ }
  }
  return quotes;
}

async function generateOgImages() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 2 });
  mkdirSync('./public/og-images', { recursive: true });

  // Generate default homepage OG image
  console.log('Generating default OG image (homepage)...');
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });

  await page.evaluate(() => {
    localStorage.setItem('scriptle:hasVisited', 'true');
    localStorage.setItem('scriptle:tutorial', JSON.stringify({ step: 999, completed: true }));
  });

  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.nav-logo', { timeout: 10000 });

  // Apply zoom for better visibility in OG image
  await page.evaluate(() => {
    document.body.style.zoom = '1.5';
  });

  await page.screenshot({
    path: './public/og-image.png',
    clip: { x: 0, y: 0, width: 1200, height: 630 }
  });

  console.log('  ✓ Saved og-image.png');

  // Generate pack-specific OG images
  for (const pack of packsData.packs) {
    console.log(`Generating OG image for ${pack.name}...`);

    const quotes = loadQuotesForPack(pack.id);
    const idx = QUOTE_SELECTIONS[pack.id] !== undefined
      ? QUOTE_SELECTIONS[pack.id] - 1
      : Math.floor(Math.random() * quotes.length);
    const quote = quotes[idx];

    console.log(`  Using quote ${idx + 1}/${quotes.length}: "${quote.text.substring(0, 50)}..."`);

    await page.goto(`${BASE_URL}/play/${pack.id}`, { waitUntil: 'networkidle0' });

    await page.evaluate(() => {
      localStorage.setItem('scriptle:hasVisited', 'true');
      localStorage.setItem('scriptle:tutorial', JSON.stringify({ step: 999, completed: true }));
    });

    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="script-area"]', { timeout: 10000 });

    await page.evaluate((q) => {
      document.body.style.zoom = '1.5';
      const textEl = document.querySelector('.dialogue-text');
      if (textEl) textEl.textContent = q.text;
    }, quote);

    await page.screenshot({
      path: `./public/og-images/${pack.id}.png`,
      clip: { x: 0, y: 0, width: 1200, height: 630 }
    });

    console.log(`  ✓ Saved og-images/${pack.id}.png`);
  }

  await browser.close();
  console.log('\nDone!');
}

generateOgImages().catch(console.error);

