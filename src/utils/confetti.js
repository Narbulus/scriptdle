// Lazy load canvas-confetti to avoid SSR/prerender issues
let confetti = null;
let confettiModule = null;

async function getConfetti() {
  if (!confetti) {
    confettiModule = await import('canvas-confetti');
    // Create confetti instance without workers to avoid CSP issues
    confetti = confettiModule.default.create(undefined, {
      resize: true,
      useWorker: false
    });
  }
  return confetti;
}


/**
 * Fires a single small puff of confetti from both sides of the screen
 * @param {string[]} colors - Array of color strings for the confetti
 */
export async function fireConfetti(customColors = null) {
  if (document.documentElement.hasAttribute('data-reduced-motion')) return;
  const confettiFunc = await getConfetti();
  const colors = customColors || ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];

  // Increased particle count from 30 to 60 per side
  confettiFunc({
    particleCount: 60,
    angle: 60,
    spread: 55,
    origin: { x: 0, y: 0.8 }, // Shoot from 80% down from top
    colors: colors
  });

  // Increased particle count from 30 to 60 per side
  confettiFunc({
    particleCount: 60,
    angle: 120,
    spread: 55,
    origin: { x: 1, y: 0.8 }, // Shoot from 80% down from top
    colors: colors
  });
}

/**
 * Fires a burst of confetti from a specific position (the flower/star)
 * @param {HTMLElement} flowerElement - The flower element to get position and colors from
 * @param {boolean} isPerfect - Whether this is a perfect win (more particles)
 * @param {boolean} isFailure - Whether this is a failure (fewer, lamer particles)
 */
export async function fireFlowerBurst(flowerElement, isPerfect = false, isFailure = false) {
  if (document.documentElement.hasAttribute('data-reduced-motion')) return;
  if (!flowerElement) {
    console.warn('No flower element provided for burst');
    return;
  }

  const confettiFunc = await getConfetti();

  // Get the position of the flower
  const rect = flowerElement.getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;

  // Extract colors from the flower SVG
  const colors = extractFlowerColors(flowerElement);

  // Scale particle count and adjust parameters based on win type
  let baseMultiplier, velocityMultiplier, gravityValue, spreadMultiplier;

  if (isFailure) {
    // Lame beetle confetti - very few particles, weak burst, slow float
    baseMultiplier = 0.15; // Much fewer particles
    velocityMultiplier = 0.3; // Very weak burst
    gravityValue = 0.4; // Extra slow float
    spreadMultiplier = 0.6; // Doesn't spread as wide
  } else if (isPerfect) {
    // Perfect win - full power
    baseMultiplier = 1;
    velocityMultiplier = 1;
    gravityValue = 0.6;
    spreadMultiplier = 1;
  } else {
    // Regular win - moderate
    baseMultiplier = 0.5;
    velocityMultiplier = 0.7;
    gravityValue = 0.6;
    spreadMultiplier = 1;
  }

  // Fire multiple bursts with different characteristics
  const fire = (particleRatio, opts) => {
    const count = Math.floor(200 * particleRatio * baseMultiplier);
    const config = {
      ...opts,
      origin: { x, y },
      particleCount: count,
      colors: colors,
      startVelocity: (opts.startVelocity || 30) * velocityMultiplier,
      spread: (opts.spread || 60) * spreadMultiplier,
      gravity: gravityValue
    };

    confettiFunc(config);
  };

  fire(0.25, {
    spread: 26,
    startVelocity: 38,
  });
  fire(0.2, {
    spread: 60,
  });
  fire(0.35, {
    spread: 100,
    decay: 0.88,
    scalar: 0.8
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 18,
    decay: 0.88,
    scalar: 1.2
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 31,
  });
}

/**
 * Extract colors from the flower SVG background image
 * @param {HTMLElement} element - The element with the flower SVG
 * @returns {string[]} Array of color strings
 */
function extractFlowerColors(element) {
  const defaultGold = ['#FFD700', '#FFC125', '#FFDF00', '#FFB90F'];

  if (!element || !element.style) {
    return defaultGold;
  }

  try {
    const bgImage = element.style.backgroundImage;
    if (!bgImage) return defaultGold;

    // Extract SVG data URL
    const dataUrlMatch = bgImage.match(/url\(['"]?(data:image\/svg\+xml[^'"]+)['"]?\)/);
    if (!dataUrlMatch) return defaultGold;

    // Decode the SVG
    const svgData = decodeURIComponent(dataUrlMatch[1].replace('data:image/svg+xml,', ''));

    // Extract fill colors from SVG
    const colorMatches = svgData.match(/fill=["']#[0-9a-fA-F]{6}["']/g) || [];
    const colors = colorMatches
      .map(match => match.match(/#[0-9a-fA-F]{6}/)[0])
      .filter((color, index, self) => self.indexOf(color) === index); // unique colors

    return colors.length > 0 ? colors : defaultGold;
  } catch (e) {
    console.warn('Could not extract flower colors:', e);
    return defaultGold;
  }
}

/**
 * Fires golden sparkles for perfect wins
 * Side jets for 2.5s, then after 1s delay, burst from flower
 * @param {string[]} colors - Colors for the side jets
 * @param {HTMLElement} flowerElement - The flower element for the burst
 * @param {boolean} isPerfect - Whether this is a perfect win
 */
export async function fireGoldenSparkles(colors, flowerElement, isPerfect = true) {
  if (document.documentElement.hasAttribute('data-reduced-motion')) return;
  // Start with side jets
  await fireConfetti(colors);

  // After 1 second, fire the flower burst
  setTimeout(async () => {
    await fireFlowerBurst(flowerElement, isPerfect);
  }, 1000);
}
