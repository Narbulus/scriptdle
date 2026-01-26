export function fireConfetti(customColors = null) {
  const colors = customColors || ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'];
  const confettiCount = 100;
  const container = document.body;

  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';

    // Random properties
    const bg = colors[Math.floor(Math.random() * colors.length)];
    const left = Math.random() * 100 + 'vw';
    const animDuration = Math.random() * 3 + 2 + 's';
    const sizeVal = Math.random() * 10 + 5;
    const size = sizeVal + 'px';

    const shapeRandom = Math.random();
    let borderRadius = '0';
    let clipPath = 'none';

    if (shapeRandom < 0.33) {
      borderRadius = '50%';
    } else if (shapeRandom >= 0.66) {
      clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
    }

    Object.assign(confetti.style, {
      position: 'fixed',
      width: size,
      height: size,
      backgroundColor: bg,
      left: left,
      top: '-10px',
      borderRadius: borderRadius,
      clipPath: clipPath,
      zIndex: '9999',
      pointerEvents: 'none',
      animation: `fall ${animDuration} linear forwards`
    });

    container.appendChild(confetti);

    setTimeout(() => {
      confetti.remove();
    }, parseFloat(animDuration) * 1000);
  }
}

if (!document.getElementById('confetti-style')) {
  const style = document.createElement('style');
  style.id = 'confetti-style';
  style.textContent = `
    @keyframes fall {
      to {
        transform: translateY(100vh) rotate(720deg);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}
