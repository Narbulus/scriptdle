import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const BASE_URL = 'https://www.scriptle.net';

// Load packs data
const packsData = JSON.parse(
  readFileSync('./public/data/packs-full.json', 'utf-8')
);

// Generate sitemap XML
const generateSitemap = () => {
  const now = new Date().toISOString().split('T')[0];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  // Homepage
  xml += '  <url>\n';
  xml += `    <loc>${BASE_URL}/</loc>\n`;
  xml += `    <lastmod>${now}</lastmod>\n`;
  xml += '    <changefreq>daily</changefreq>\n';
  xml += '    <priority>1.0</priority>\n';
  xml += '  </url>\n';

  // All pack pages
  packsData.packs.forEach(pack => {
    xml += '  <url>\n';
    xml += `    <loc>${BASE_URL}/play/${pack.id}</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += '    <changefreq>daily</changefreq>\n';
    xml += '    <priority>0.8</priority>\n';
    xml += '  </url>\n';
  });

  // About page
  xml += '  <url>\n';
  xml += `    <loc>${BASE_URL}/about</loc>\n`;
  xml += `    <lastmod>${now}</lastmod>\n`;
  xml += '    <changefreq>monthly</changefreq>\n';
  xml += '    <priority>0.5</priority>\n';
  xml += '  </url>\n';

  // Stats page
  xml += '  <url>\n';
  xml += `    <loc>${BASE_URL}/stats</loc>\n`;
  xml += `    <lastmod>${now}</lastmod>\n`;
  xml += '    <changefreq>weekly</changefreq>\n';
  xml += '    <priority>0.3</priority>\n';
  xml += '  </url>\n';

  xml += '</urlset>';

  return xml;
};

// Write sitemap
const sitemap = generateSitemap();
writeFileSync('./public/sitemap.xml', sitemap);

console.log(`✅ Generated sitemap with ${packsData.packs.length + 3} URLs`);
