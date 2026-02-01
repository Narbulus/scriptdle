import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

const BASE_URL = 'https://www.scriptle.net';

// Load packs data
const packsData = JSON.parse(
  readFileSync('./public/data/packs-full.json', 'utf-8')
);

// Read the built index.html as template
const getTemplate = () => {
  const distPath = './dist/index.html';
  if (!existsSync(distPath)) {
    throw new Error('dist/index.html not found. Run vite build first.');
  }
  return readFileSync(distPath, 'utf-8');
};

// Inject SEO metadata into HTML
const injectMetadata = (html, metadata) => {
  let result = html;

  // Replace title
  result = result.replace(
    /<title>.*?<\/title>/,
    `<title>${metadata.title}</title>`
  );

  // Inject meta tags before </head>
  const metaTags = `
  <meta name="description" content="${metadata.description}">
  <link rel="canonical" href="${BASE_URL}${metadata.url}">

  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${metadata.ogTitle || metadata.title}">
  <meta property="og:description" content="${metadata.description}">
  <meta property="og:url" content="${BASE_URL}${metadata.url}">
  <meta property="og:image" content="${BASE_URL}/og-image.png">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${metadata.ogTitle || metadata.title}">
  <meta name="twitter:description" content="${metadata.description}">
  <meta name="twitter:image" content="${BASE_URL}/twitter-image.png">

  <!-- Additional SEO -->
  <meta name="keywords" content="${metadata.keywords}">
`;

  result = result.replace('</head>', `${metaTags}</head>`);

  // Replace loading div with noscript content
  if (metadata.noscriptContent) {
    result = result.replace(
      /<div id="loading"[^>]*>Loading\.\.\.<\/div>/,
      `<div id="loading" style="text-align:center; font-family:sans-serif;">Loading...</div>
      <noscript>
        <div style="padding: 2rem; max-width: 800px; margin: 0 auto; font-family: sans-serif;">
          ${metadata.noscriptContent}
        </div>
      </noscript>`
    );
  }

  // Add JSON-LD structured data if provided
  if (metadata.structuredData) {
    result = result.replace(
      '</head>',
      `  <script type="application/ld+json">${JSON.stringify(metadata.structuredData, null, 2)}</script>\n</head>`
    );
  }

  return result;
};

// Generate homepage HTML
const generateHomepage = (template) => {
  const metadata = {
    url: '/',
    title: 'Scriptle - Daily Movie Quote Guessing Game | Test Your Film Knowledge',
    ogTitle: 'Scriptle - Daily Movie Quote Game',
    description: 'Play Scriptle daily! Guess the movie from gradually revealed quotes. Test your film knowledge with Star Wars, Harry Potter, Marvel, Pixar and more. New puzzles every day!',
    keywords: 'movie quotes game, movie trivia, daily puzzle, film quotes, movie guessing game, star wars game, harry potter game, marvel trivia',
    noscriptContent: `
      <h1>Scriptle - Daily Movie Quote Guessing Game</h1>
      <p>Test your movie knowledge with daily quote challenges from your favorite films!</p>

      <h2>Featured Movie Packs</h2>
      <ul>
        ${packsData.packs.slice(0, 10).map(pack =>
          `<li><a href="/play/${pack.id}">${pack.name} (${pack.movieCount} movies)</a></li>`
        ).join('\n        ')}
      </ul>

      <h2>How to Play</h2>
      <p>Each day, a new movie quote challenge is available. Reveal quotes one at a time and try to guess the movie title. The fewer reveals you use, the better your score!</p>

      <p>Categories include Classics, Animated, and more. Start playing now!</p>
    `,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "Scriptle",
      "applicationCategory": "Game",
      "operatingSystem": "Any",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "description": "Daily movie quote guessing game with quotes from Star Wars, Harry Potter, Marvel, Pixar and more classic films",
      "url": "https://www.scriptle.net",
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "ratingCount": "1000"
      }
    }
  };

  return injectMetadata(template, metadata);
};

// Generate pack page HTML
const generatePackPage = (template, pack) => {
  const metadata = {
    url: `/play/${pack.id}`,
    title: `Scriptle: Daily ${pack.name} quote guessing game`,
    ogTitle: `Scriptle: Daily ${pack.name} quote guessing game`,
    description: `Test your ${pack.name} knowledge! Guess the movie from iconic quotes from ${pack.movieCount} films. Daily ${pack.name} quote puzzles on Scriptle.`,
    keywords: `${pack.name} quotes, ${pack.name} game, ${pack.name} trivia, movie quotes, daily puzzle, ${pack.name} quiz`,
    noscriptContent: `
      <h1>${pack.name} - Daily Quote Challenge</h1>
      <p>Guess the ${pack.name} movie from gradually revealed quotes.</p>
      <p>This pack includes ${pack.movieCount} movies from the ${pack.name} collection.</p>
      <p>A new puzzle is available every day!</p>

      <h2>How to Play</h2>
      <ol>
        <li>Read the first quote</li>
        <li>Try to guess which ${pack.name} movie it's from</li>
        <li>Reveal more quotes if you need hints</li>
        <li>Submit your answer!</li>
      </ol>

      <p><a href="/">← Back to all movie packs</a></p>
    `,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Game",
      "name": `Scriptle: ${pack.name}`,
      "description": `Guess the ${pack.name} movie from quotes`,
      "gameItem": {
        "@type": "Thing",
        "name": pack.name
      },
      "numberOfPlayers": {
        "@type": "QuantitativeValue",
        "minValue": 1,
        "maxValue": 1
      }
    }
  };

  return injectMetadata(template, metadata);
};

// Generate About page HTML
const generateAboutPage = (template) => {
  const metadata = {
    url: '/about',
    title: 'About Scriptle - How to Play the Daily Movie Quote Game',
    ogTitle: 'About Scriptle',
    description: 'Learn how to play Scriptle, the daily movie quote guessing game. Reveal quotes one at a time and test your movie knowledge. Free to play!',
    keywords: 'about scriptle, how to play, movie quote game rules, daily puzzle game',
    noscriptContent: `
      <h1>About Scriptle</h1>
      <p>Scriptle is a daily movie quote guessing game where you gradually reveal quotes to identify the film.</p>
    `
  };

  return injectMetadata(template, metadata);
};

// Generate Stats page HTML
const generateStatsPage = (template) => {
  const metadata = {
    url: '/stats',
    title: 'Your Scriptle Stats - Movie Quote Game Progress',
    ogTitle: 'Scriptle Stats',
    description: 'View your Scriptle statistics and track your movie quote game performance across all packs.',
    keywords: 'scriptle stats, game statistics, movie quiz progress',
    noscriptContent: `
      <h1>Your Scriptle Stats</h1>
      <p>View your game statistics and progress across all movie packs.</p>
    `
  };

  return injectMetadata(template, metadata);
};

// Main prerender function
const prerender = () => {
  console.log('🎬 Starting pre-rendering...');

  const template = getTemplate();

  // Generate homepage
  console.log('📄 Rendering homepage...');
  const homeHtml = generateHomepage(template);
  writeFileSync('./dist/index.html', homeHtml);

  // Generate pack pages
  console.log(`📄 Rendering ${packsData.packs.length} pack pages...`);
  packsData.packs.forEach(pack => {
    const packHtml = generatePackPage(template, pack);
    const dir = `./dist/play/${pack.id}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/index.html`, packHtml);
  });

  // Generate About page
  console.log('📄 Rendering about page...');
  const aboutHtml = generateAboutPage(template);
  const aboutDir = './dist/about';
  mkdirSync(aboutDir, { recursive: true });
  writeFileSync(`${aboutDir}/index.html`, aboutHtml);

  // Generate Stats page
  console.log('📄 Rendering stats page...');
  const statsHtml = generateStatsPage(template);
  const statsDir = './dist/stats';
  mkdirSync(statsDir, { recursive: true });
  writeFileSync(`${statsDir}/index.html`, statsHtml);

  console.log(`✅ Pre-rendered ${packsData.packs.length + 3} pages successfully!`);
};

// Run prerender
try {
  prerender();
} catch (error) {
  console.error('❌ Pre-rendering failed:', error.message);
  process.exit(1);
}
