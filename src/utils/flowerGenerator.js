/**
 * Procedural flower generator
 * Generates unique SVG flowers based on a seed
 * Uses color theory to create harmonious colors
 */

function createSeededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// Convert hex to HSL
function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

// Convert HSL to hex
function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; // Normalize hue to 0-360
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;

  let r, g, b;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Generate harmonious flower colors based on card color
function generateFlowerColors(cardColor, rng) {
  const cardHsl = hexToHsl(cardColor);

  // Choose a color harmony strategy
  const strategy = Math.floor(rng() * 3);

  let petalHue, centerHue;

  switch (strategy) {
    case 0:
      // Complementary: petal is opposite the card color
      petalHue = (cardHsl.h + 180) % 360;
      // Center is analogous to petal (30° offset)
      centerHue = (petalHue + 30 + rng() * 30) % 360;
      break;
    case 1:
      // Split-complementary: petal is 150° from card
      petalHue = (cardHsl.h + 150 + rng() * 60) % 360;
      // Center is triadic from petal
      centerHue = (petalHue + 120) % 360;
      break;
    case 2:
      // Triadic: petal is 120° from card
      petalHue = (cardHsl.h + 120) % 360;
      // Center is another 120° away
      centerHue = (petalHue + 120) % 360;
      break;
  }

  // Petals: vibrant and saturated
  const petalSat = 70 + rng() * 25; // 70-95%
  const petalLight = 55 + rng() * 20; // 55-75%

  // Center: ensure good contrast with petals
  // Either much darker/lighter or different saturation
  const centerSat = 60 + rng() * 35; // 60-95%
  // Make center noticeably different in lightness
  const centerLight = petalLight > 65 ? 40 + rng() * 15 : 65 + rng() * 20;

  return {
    petalColor: hslToHex(petalHue, petalSat, petalLight),
    centerColor: hslToHex(centerHue, centerSat, centerLight)
  };
}

// Generate a flower SVG as a data URI
export function generateFlower(seed, cardColor = '#cccccc') {
  const rng = createSeededRng(seed);

  // Flower parameters - fixed total radius, varying internals
  const totalRadius = 45; // Consistent outer radius for all flowers
  const petalCount = Math.floor(rng() * 4) + 5; // 5-8 petals
  const petalOffset = 3 + rng() * 6; // 3-9: how far petal starts from center
  const petalLength = totalRadius - petalOffset; // Calculated to hit target radius
  const petalWidth = 10 + rng() * 12; // 10-22: varies independently
  const centerRadius = 6 + rng() * 8; // 6-14: varies but stays proportional
  const rotation = rng() * 360;

  // Generate colors based on card color
  const { petalColor, centerColor } = generateFlowerColors(cardColor, rng);

  // Build petals - perfect radial symmetry
  let petals = '';
  const petalCy = 50 - petalLength/2 - petalOffset;

  for (let i = 0; i < petalCount; i++) {
    const angle = (360 / petalCount) * i + rotation;

    petals += `<ellipse
      cx="50"
      cy="${petalCy}"
      rx="${petalWidth/2}"
      ry="${petalLength/2}"
      fill="${petalColor}"
      transform="rotate(${angle} 50 50)"
    />`;
  }

  // Optional: add a second layer of smaller petals (also radially symmetric)
  const hasInnerPetals = rng() > 0.5;
  if (hasInnerPetals) {
    const innerRadius = totalRadius * 0.65; // Inner layer reaches 65% of total radius
    const innerPetalOffset = petalOffset * 0.8;
    const innerPetalLength = innerRadius - innerPetalOffset;
    const innerPetalWidth = petalWidth * 0.5;
    const innerPetalCy = 50 - innerPetalLength/2 - innerPetalOffset;
    const innerAngleOffset = 180 / petalCount;

    for (let i = 0; i < petalCount; i++) {
      const angle = (360 / petalCount) * i + rotation + innerAngleOffset;

      petals += `<ellipse
        cx="50"
        cy="${innerPetalCy}"
        rx="${innerPetalWidth/2}"
        ry="${innerPetalLength/2}"
        fill="${petalColor}"
        transform="rotate(${angle} 50 50)"
        opacity="0.85"
      />`;
    }
  }

  // Center of flower
  const center = `<circle cx="50" cy="50" r="${centerRadius}" fill="${centerColor}" />`;

  // Optional center details
  let centerDetail = '';
  if (rng() > 0.4) {
    const dotCount = Math.floor(rng() * 5) + 3;
    const dotRadius = centerRadius * 0.6;
    for (let i = 0; i < dotCount; i++) {
      const angle = (360 / dotCount) * i;
      const radians = (angle * Math.PI) / 180;
      const x = 50 + Math.cos(radians) * dotRadius;
      const y = 50 + Math.sin(radians) * dotRadius;
      centerDetail += `<circle cx="${x}" cy="${y}" r="2" fill="${petalColor}" opacity="0.6" />`;
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    ${petals}
    ${center}
    ${centerDetail}
  </svg>`;

  // Convert to data URI
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');

  return `data:image/svg+xml,${encoded}`;
}

// Generate a deterministic seed from a string (pack ID + date)
export function stringToSeed(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
