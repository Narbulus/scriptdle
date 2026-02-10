import confetti from 'canvas-confetti';

/**
 * Fires a single small puff of confetti from both sides of the screen
 * @param {string[]} colors - Array of color strings for the confetti
 */
export function fireConfetti(customColors = null) {
  const colors = customColors || ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];

  // Single small puff from left side
  confetti({
    particleCount: 30,
    angle: 60,
    spread: 55,
    origin: { x: 0 },
    colors: colors
  });

  // Single small puff from right side
  confetti({
    particleCount: 30,
    angle: 120,
    spread: 55,
    origin: { x: 1 },
    colors: colors
  });
}

/**
 * Fires a burst of confetti from a specific position (the flower/star)
 * @param {HTMLElement} flowerElement - The flower element to get position and colors from
 */
export function fireFlowerBurst(flowerElement) {
  if (!flowerElement) {
    console.warn('No flower element provided for burst');
    return;
  }

  // Get the position of the flower
  const rect = flowerElement.getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;

  // Extract colors from the flower SVG
  const colors = extractFlowerColors(flowerElement);

  // Fire multiple bursts with different characteristics
  const fire = (particleRatio, opts) => {
    const count = Math.floor(200 * particleRatio);
    confetti({
      ...opts,
      origin: { x, y },
      particleCount: count,
      colors: colors
    });
  };

  fire(0.25, {
    spread: 26,
    startVelocity: 55,
  });
  fire(0.2, {
    spread: 60,
  });
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 45,
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
 */
export function fireGoldenSparkles(colors, flowerElement) {
  // Start with side jets
  fireConfetti(colors);

  // After 1 second, fire the flower burst
  setTimeout(() => {
    fireFlowerBurst(flowerElement);
  }, 1000);
}
