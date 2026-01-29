function createSeededRng(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

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
    if (max === r) {
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / d + 2) / 6;
    } else {
      h = ((r - g) / d + 4) / 6;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

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

function generateFlowerColors(cardColor, rng) {
  const cardHsl = hexToHsl(cardColor);

  const strategy = Math.floor(rng() * 3);

  let petalHue, centerHue;

  switch (strategy) {
    case 0:
      petalHue = (cardHsl.h + 180) % 360;
      centerHue = (petalHue + 30 + rng() * 30) % 360;
      break;
    case 1:
      petalHue = (cardHsl.h + 150 + rng() * 60) % 360;
      centerHue = (petalHue + 120) % 360;
      break;
    default:
      petalHue = (cardHsl.h + 120) % 360;
      centerHue = (petalHue + 120) % 360;
      break;
  }

  const petalSat = 70 + rng() * 25;
  const petalLight = 55 + rng() * 20;
  const centerSat = 60 + rng() * 35;
  const centerLight = petalLight > 65 ? 40 + rng() * 15 : 65 + rng() * 20;

  return {
    petalColor: hslToHex(petalHue, petalSat, petalLight),
    centerColor: hslToHex(centerHue, centerSat, centerLight)
  };
}

export function generateFlower(seed, cardColor = '#cccccc') {
  const numericSeed = typeof seed === 'string' ? stringToSeed(seed) : seed;
  const rng = createSeededRng(numericSeed);

  const totalRadius = 45;
  const petalCount = Math.floor(rng() * 4) + 5;
  const petalOffset = 3 + rng() * 6;
  const petalLength = totalRadius - petalOffset;
  const petalWidth = 10 + rng() * 12;
  const centerRadius = 6 + rng() * 8;
  const rotation = rng() * 360;

  const { petalColor, centerColor } = generateFlowerColors(cardColor, rng);

  let petals = '';
  const petalCy = 50 - petalLength / 2 - petalOffset;

  for (let i = 0; i < petalCount; i++) {
    const angle = (360 / petalCount) * i + rotation;

    petals += `<ellipse
      cx="50"
      cy="${petalCy}"
      rx="${petalWidth / 2}"
      ry="${petalLength / 2}"
      fill="${petalColor}"
      transform="rotate(${angle} 50 50)"
    />`;
  }

  const hasInnerPetals = rng() > 0.5;
  if (hasInnerPetals) {
    const innerRadius = totalRadius * 0.65; // Inner layer reaches 65% of total radius
    const innerPetalOffset = petalOffset * 0.8;
    const innerPetalLength = innerRadius - innerPetalOffset;
    const innerPetalWidth = petalWidth * 0.5;
    const innerPetalCy = 50 - innerPetalLength / 2 - innerPetalOffset;
    const innerAngleOffset = 180 / petalCount;

    for (let i = 0; i < petalCount; i++) {
      const angle = (360 / petalCount) * i + rotation + innerAngleOffset;

      petals += `<ellipse
        cx="50"
        cy="${innerPetalCy}"
        rx="${innerPetalWidth / 2}"
        ry="${innerPetalLength / 2}"
        fill="${petalColor}"
        transform="rotate(${angle} 50 50)"
        opacity="0.85"
      />`;
    }
  }

  const center = `<circle cx="50" cy="50" r="${centerRadius}" fill="${centerColor}" />`;

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

  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');

  return `data:image/svg+xml,${encoded}`;
}

function generateBeetleColors(cardColor, rng) {
  const cardHsl = hexToHsl(cardColor);

  const strategy = Math.floor(rng() * 3);

  let bodyHue, accentHue;

  switch (strategy) {
    case 0:
      bodyHue = (cardHsl.h + 180) % 360;
      accentHue = (bodyHue + 30 + rng() * 30) % 360;
      break;
    case 1:
      bodyHue = (cardHsl.h + 150 + rng() * 60) % 360;
      accentHue = (bodyHue + 120) % 360;
      break;
    default:
      bodyHue = (cardHsl.h + 120) % 360;
      accentHue = (bodyHue + 120) % 360;
      break;
  }

  const bodySat = 70 + rng() * 25;
  const bodyLight = 35 + rng() * 20; // Darker than flowers for beetle body
  const accentSat = 60 + rng() * 35;
  const accentLight = bodyLight + 20 + rng() * 15; // Lighter for accent

  return {
    bodyColor: hslToHex(bodyHue, bodySat, bodyLight),
    accentColor: hslToHex(accentHue, accentSat, accentLight)
  };
}

// Default beetle parameters (locked in from tester)
const BEETLE_DEFAULTS = {
  shellWidthMin: 27, shellWidthMax: 37,
  shellHeightMin: 24, shellHeightMax: 58,
  shellTopFlatnessMin: 0.3, shellTopFlatnessMax: 0.8,
  shellBottomRoundnessMin: 0.5, shellBottomRoundnessMax: 0.9,
  shellSidesCurveMin: 0.4, shellSidesCurveMax: 1.65,
  thoraxWidthRatioMin: 0.65, thoraxWidthRatioMax: 0.7,
  thoraxHeightMin: 7, thoraxHeightMax: 14,
  thoraxOverlapMin: 2, thoraxOverlapMax: 3,
  headWidthRatioMin: 0.45, headWidthRatioMax: 1,
  headHeightRatioMin: 0.6, headHeightRatioMax: 0.8,
  headOverlapMin: 2, headOverlapMax: 5,
  legLengthMin: 10, legLengthMax: 18,
  legThickness: 3.5,
  legKinkPositionMin: 0.4, legKinkPositionMax: 0.6,
  legKinkAngleMin: 20, legKinkAngleMax: 50,
  frontLegAngleMin: -45, frontLegAngleMax: -15,
  middleLegAngleMin: 5, middleLegAngleMax: 25,
  backLegAngleMin: 40, backLegAngleMax: 65,
  antennaLengthMin: 10, antennaLengthMax: 18,
  antennaThickness: 2.5,
  antennaAngleMin: 10, antennaAngleMax: 90,
  strokeWidth: 2.75,
  showElytraLine: true
};

export function generateBeetle(seed, cardColor = '#cccccc') {
  const numericSeed = typeof seed === 'string' ? stringToSeed(seed) : seed;
  const rng = createSeededRng(numericSeed);
  const { bodyColor, accentColor } = generateBeetleColors(cardColor, rng);
  const params = BEETLE_DEFAULTS;

  // Random value between min and max
  const range = (min, max) => min + rng() * (max - min);

  // Shell/elytra dimensions
  const shellWidth = range(params.shellWidthMin, params.shellWidthMax);
  const shellHeight = range(params.shellHeightMin, params.shellHeightMax);
  const shellCenterY = 55;

  // Thorax/pronotum
  const thoraxWidthRatio = range(params.thoraxWidthRatioMin, params.thoraxWidthRatioMax);
  const thoraxWidth = shellWidth * thoraxWidthRatio;
  const thoraxHeight = range(params.thoraxHeightMin, params.thoraxHeightMax);
  const thoraxOverlap = range(params.thoraxOverlapMin, params.thoraxOverlapMax);
  const thoraxY = shellCenterY - shellHeight / 2 - thoraxHeight / 2 + thoraxOverlap;

  // Head
  const headWidthRatio = range(params.headWidthRatioMin, params.headWidthRatioMax);
  const headWidth = thoraxWidth * headWidthRatio;
  const headHeightRatio = range(params.headHeightRatioMin, params.headHeightRatioMax);
  const headHeight = headWidth * headHeightRatio;
  const headOverlap = range(params.headOverlapMin, params.headOverlapMax);
  const headY = thoraxY - thoraxHeight / 2 - headHeight / 2 + headOverlap;

  // Fixed parameters
  const legLength = range(params.legLengthMin, params.legLengthMax);
  const legThickness = params.legThickness;
  const antennaLength = range(params.antennaLengthMin, params.antennaLengthMax);
  const antennaThickness = params.antennaThickness;
  const antennaAngle = range(params.antennaAngleMin, params.antennaAngleMax);
  const strokeWidth = params.strokeWidth;

  // Shell shape parameters
  const shellTopFlatness = range(params.shellTopFlatnessMin, params.shellTopFlatnessMax);
  const shellBottomRoundness = range(params.shellBottomRoundnessMin, params.shellBottomRoundnessMax);
  const shellSidesCurve = range(params.shellSidesCurveMin, params.shellSidesCurveMax);

  // Shell (elytra) - flat top edge, variable bottom
  const shellLeft = 50 - shellWidth / 2;
  const shellRight = 50 + shellWidth / 2;
  const shellTop = shellCenterY - shellHeight / 2;
  const shellBottom = shellCenterY + shellHeight / 2;

  const topEdgeWidth = shellWidth * (0.5 + 0.4 * shellTopFlatness);
  const topLeft = 50 - topEdgeWidth / 2;
  const topRight = 50 + topEdgeWidth / 2;
  const sideBulge = shellWidth * 0.05 * shellSidesCurve;
  const widestY = shellCenterY + shellHeight * 0.1;
  const bottomControlSpread = shellWidth * 0.3 * shellBottomRoundness;

  const shellPath = `
    M ${topLeft} ${shellTop}
    L ${topRight} ${shellTop}
    C ${shellRight + sideBulge * 0.5} ${shellTop + shellHeight * 0.1}, ${shellRight + sideBulge} ${widestY - shellHeight * 0.1}, ${shellRight} ${widestY}
    C ${shellRight + sideBulge * 0.3} ${widestY + shellHeight * 0.2}, ${50 + bottomControlSpread} ${shellBottom - shellHeight * 0.1}, 50 ${shellBottom}
    C ${50 - bottomControlSpread} ${shellBottom - shellHeight * 0.1}, ${shellLeft - sideBulge * 0.3} ${widestY + shellHeight * 0.2}, ${shellLeft} ${widestY}
    C ${shellLeft - sideBulge} ${widestY - shellHeight * 0.1}, ${shellLeft - sideBulge * 0.5} ${shellTop + shellHeight * 0.1}, ${topLeft} ${shellTop}
    Z
  `;
  const shell = `<path d="${shellPath}" fill="${bodyColor}" stroke="${accentColor}" stroke-width="${strokeWidth}" />`;

  // Thorax/pronotum
  const thorax = `<ellipse cx="50" cy="${thoraxY}" rx="${thoraxWidth / 2}" ry="${thoraxHeight / 2}" fill="${bodyColor}" stroke="${accentColor}" stroke-width="${strokeWidth}" />`;

  // Head
  const head = `<ellipse cx="50" cy="${headY}" rx="${headWidth / 2}" ry="${headHeight / 2}" fill="${bodyColor}" stroke="${accentColor}" stroke-width="${strokeWidth}" />`;

  // Legs with joints
  let legs = '';
  const frontLegAngle = range(params.frontLegAngleMin, params.frontLegAngleMax);
  const middleLegAngle = range(params.middleLegAngleMin, params.middleLegAngleMax);
  const backLegAngle = range(params.backLegAngleMin, params.backLegAngleMax);

  const shellTopY = shellCenterY - shellHeight / 2;
  const visibleThoraxY = Math.max(thoraxY, shellTopY - thoraxHeight * 0.3);

  const legConfigs = [
    { attachY: visibleThoraxY, splayAngle: frontLegAngle, useWidth: thoraxWidth },
    { attachY: shellCenterY - shellHeight * 0.15, splayAngle: middleLegAngle, useWidth: shellWidth },
    { attachY: shellCenterY + shellHeight * 0.1, splayAngle: backLegAngle, useWidth: shellWidth }
  ];

  legConfigs.forEach((config, index) => {
    const attachWidth = config.useWidth / 2;
    const angleRad = config.splayAngle * Math.PI / 180;
    const kinkPosition = range(params.legKinkPositionMin, params.legKinkPositionMax);
    const kinkAngle = range(params.legKinkAngleMin, params.legKinkAngleMax);
    const bendDirection = index === 0 ? -1 : 1;
    const segment1Length = legLength * kinkPosition;
    const segment2Length = legLength * (1 - kinkPosition);

    // Right leg
    const rightStartX = 50 + attachWidth - 1;
    const rightKinkX = rightStartX + segment1Length * Math.cos(angleRad);
    const rightKinkY = config.attachY + segment1Length * Math.sin(angleRad);
    const rightKinkAngleRad = angleRad + bendDirection * kinkAngle * Math.PI / 180;
    const rightEndX = rightKinkX + segment2Length * Math.cos(rightKinkAngleRad);
    const rightEndY = rightKinkY + segment2Length * Math.sin(rightKinkAngleRad);
    legs += `<line x1="${rightStartX}" y1="${config.attachY}" x2="${rightKinkX}" y2="${rightKinkY}" stroke="${accentColor}" stroke-width="${legThickness}" stroke-linecap="round" />`;
    legs += `<line x1="${rightKinkX}" y1="${rightKinkY}" x2="${rightEndX}" y2="${rightEndY}" stroke="${accentColor}" stroke-width="${legThickness}" stroke-linecap="round" />`;

    // Left leg
    const leftStartX = 50 - attachWidth + 1;
    const leftKinkX = leftStartX - segment1Length * Math.cos(angleRad);
    const leftKinkY = config.attachY + segment1Length * Math.sin(angleRad);
    const leftKinkAngleRad = Math.PI - angleRad - bendDirection * kinkAngle * Math.PI / 180;
    const leftEndX = leftKinkX + segment2Length * Math.cos(leftKinkAngleRad);
    const leftEndY = leftKinkY + segment2Length * Math.sin(leftKinkAngleRad);
    legs += `<line x1="${leftStartX}" y1="${config.attachY}" x2="${leftKinkX}" y2="${leftKinkY}" stroke="${accentColor}" stroke-width="${legThickness}" stroke-linecap="round" />`;
    legs += `<line x1="${leftKinkX}" y1="${leftKinkY}" x2="${leftEndX}" y2="${leftEndY}" stroke="${accentColor}" stroke-width="${legThickness}" stroke-linecap="round" />`;
  });

  // Antennae
  const antennaStartY = headY - headHeight * 0.3;
  const leftAntennaEndX = 50 - antennaLength * Math.sin(antennaAngle * Math.PI / 180);
  const leftAntennaEndY = antennaStartY - antennaLength * Math.cos(antennaAngle * Math.PI / 180);
  const leftControlX = 50 - antennaLength * 0.4;
  const leftControlY = antennaStartY - antennaLength * 0.5;
  const rightAntennaEndX = 50 + antennaLength * Math.sin(antennaAngle * Math.PI / 180);
  const rightAntennaEndY = antennaStartY - antennaLength * Math.cos(antennaAngle * Math.PI / 180);
  const rightControlX = 50 + antennaLength * 0.4;
  const rightControlY = antennaStartY - antennaLength * 0.5;
  const antennae = `
    <path d="M 50 ${antennaStartY} Q ${leftControlX} ${leftControlY} ${leftAntennaEndX} ${leftAntennaEndY}" stroke="${accentColor}" stroke-width="${antennaThickness}" fill="none" stroke-linecap="round" />
    <path d="M 50 ${antennaStartY} Q ${rightControlX} ${rightControlY} ${rightAntennaEndX} ${rightAntennaEndY}" stroke="${accentColor}" stroke-width="${antennaThickness}" fill="none" stroke-linecap="round" />
  `;

  // Optional elytra line
  let shellDetail = '';
  if (params.showElytraLine && rng() > 0.4) {
    shellDetail = `<line x1="50" y1="${shellCenterY - shellHeight / 2 + 3}" x2="50" y2="${shellCenterY + shellHeight / 2 - 3}" stroke="${accentColor}" stroke-width="${antennaThickness}" opacity="0.4" />`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    ${legs}
    ${antennae}
    ${head}
    ${thorax}
    ${shell}
    ${shellDetail}
  </svg>`;

  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');

  return `data:image/svg+xml,${encoded}`;
}

export function stringToSeed(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
