
// Global modal instance check
let modalCreated = false;
let animationInterval = null;

function stopAnimation() {
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
  }
}

export function openHelpModal() {
  if (!modalCreated) {
    createHelpModal();
    modalCreated = true;
  }

  const modal = document.getElementById('help-modal');
  if (modal) {
    modal.style.display = 'flex';
    startAnimation();
  }
}

function createHelpModal() {
  const modal = document.createElement('div');
  modal.id = 'help-modal';
  modal.className = 'modal-overlay';
  modal.style.display = 'none';

  modal.innerHTML = `
    <div class="modal-container" style="max-width: 500px;">
      <div class="modal-header">
        <h2 class="modal-title">How To Play</h2>
        <button id="help-modal-close" class="modal-close-btn">&times;</button>
      </div>
      <div class="modal-content">
        <div class="modal-body custom-scrollbar">
          <div class="help-section" style="text-align: center;">
            <p style="margin-bottom: 2rem;">
              Guess the <strong>MOVIE</strong> and the <strong>CHARACTER</strong> from the quote.
            </p>
            
            <div id="demo-script-container" style="background: #fff; padding: 1.5rem; border: 1px solid #ccc; border-radius: 8px; margin-bottom: 2rem; position: relative; overflow: hidden; min-height: 200px; display: flex; flex-direction: column; justify-content: center;">
                  <!-- Animation content injected here -->
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 1.5rem; text-align: left; margin-top: 1.5rem;">
              <div style="display: flex; gap: 1rem; align-items: flex-start;">
                <div style="background: #333; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 0.8rem; font-weight: bold; margin-top: 2px;">1</div>
                <div>
                  <strong>You have 5 attempts.</strong><br>
                  <span style="font-size: 0.9rem; color: #666;">Guess the movie correctly to lock it in.</span>
                </div>
              </div>

              <div style="display: flex; gap: 1rem; align-items: flex-start;">
                <div style="background: #333; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 0.8rem; font-weight: bold; margin-top: 2px;">2</div>
                <div>
                  <strong>Each wrong guess reveals more of the script.</strong><br>
                  <span style="font-size: 0.9rem; color: #666;">Reveals following lines from the movie.</span>
                </div>
              </div>

               <div style="display: flex; gap: 1rem; align-items: flex-start;">
                <div style="background: #333; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 0.8rem; font-weight: bold; margin-top: 2px;">3</div>
                <div>
                  <strong>A new puzzle every day at midnight.</strong><br>
                  <span style="font-size: 0.9rem; color: #666;">Come back to keep your streak alive!</span>
                </div>
              </div>
            </div>
            
            <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee; text-align: center;">
              <a href="/legal" data-link style="font-size: 0.8rem; color: #888; text-decoration: none;">Privacy Policy & Terms</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Bind events
  const closeBtn = document.getElementById('help-modal-close');
  closeBtn.addEventListener('click', () => {
    closeModal(modal);
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal(modal);
    }
  });

  // Escape key support
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      closeModal(modal);
    }
  });
}

function closeModal(modal) {
  modal.style.display = 'none';
  stopAnimation();
}

// Confetti effect helper
function fireMiniConfetti(container) {
  const colors = ['#a864fd', '#29cdff', '#78ff44', '#ff718d', '#fdff6a'];
  for (let i = 0; i < 40; i++) {
    const confetti = document.createElement('div');
    confetti.style.position = 'absolute';
    confetti.style.width = '6px';
    confetti.style.height = '6px';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.left = Math.random() * 100 + '%'; // Random horizontal start
    confetti.style.top = '-10px'; // Start above
    confetti.style.borderRadius = '50%';
    confetti.style.zIndex = '10';
    container.appendChild(confetti);

    // Physics
    const velocityY = 2 + Math.random() * 3;
    const velocityX = (Math.random() - 0.5) * 2;
    const rotation = Math.random() * 360;

    // Animate falling down
    confetti.animate([
      { transform: `translate(0, 0) rotate(0deg)`, opacity: 1 },
      { transform: `translate(${velocityX * 50}px, 250px) rotate(${rotation}deg)`, opacity: 0 }
    ], {
      duration: 1500 + Math.random() * 1000,
      easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
      fill: 'forwards'
    }).onfinish = () => confetti.remove();
  }
}

function startAnimation() {
  const container = document.getElementById('demo-script-container');
  if (!container) return;

  stopAnimation();

  // Define the script lines (Target + Context)
  const lines = [
    { text: "I love you.", char: "LEIA", type: 'target' },
    { text: "I know.", char: "HAN", type: 'context' },
    { text: "Put him in.", char: "VADER", type: 'context' }
  ];

  // Helper to render content that maintains EXACT geometric stability
  const renderStableContent = (text, isRevealed, maskType = 'bar', isTitle = false) => {
    // Container: relative inline-block. No whitespace used in template.
    const wrapperStyle = "position: relative; display: inline-block; vertical-align: middle;";

    // Base Text: Drives size. Always visible to ensure layout size.
    // The overlay covers it when opacity is 1.
    const textVisibility = "visibility: visible;";
    // Inherit font styles to ensure dimensions match perfectly
    const textStyle = `font-family: inherit; font-size: inherit; font-weight: inherit; line-height: inherit; ${textVisibility} white-space: nowrap;`;

    // Prepare Overlay Content
    let overlayInner = '';
    if (maskType === 'question') {
      const fSize = isTitle ? '0.7rem' : '0.6rem';
      if (isTitle) {
        // Title: Full width grey bar with centered ???
        overlayInner = `<span style="background-color: #e0e0e0; border-radius: 4px; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #333; font-size: ${fSize}; letter-spacing: 1px;">???</span>`;
      } else {
        // Character Name: Keep it full width for consistent masking feel
        overlayInner = `<span style="background-color: #e0e0e0; border-radius: 4px; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: #333; font-size: ${fSize}; letter-spacing: 1px;">???</span>`;
      }
    } else {
      // Grey Bar: Fills the space (width 100% of the text)
      overlayInner = `<span style="background-color: #e0e0e0; border-radius: 4px; width: 100%; height: 1em; display: block;"></span>`;
    }

    // Transition Logic
    // If revealed, opacity 0. If not, opacity 1.
    const opacity = isRevealed ? '0' : '1';
    // Snappy fade (0.5s ease)
    const transition = 'opacity 0.5s ease';
    const overlayStyle = `position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; opacity: ${opacity}; transition: ${transition}; pointer-events: none;`;

    return `<span style="${wrapperStyle}"><span style="${textStyle}">${text}</span><span style="${overlayStyle}">${overlayInner}</span></span>`;
  };

  const renderLine = (line, revealText, revealChar) => {
    const maskType = (line.type === 'target') ? 'question' : 'bar';
    const charContent = renderStableContent(line.char, revealChar, maskType);

    const isTextVisible = (line.type === 'target' || revealText);
    const textContent = renderStableContent(line.text, isTextVisible, 'bar');

    // Use Flexbox for perfect centering, REMOVED leading whitespace in string to prevent alignment skew
    return `<div class="script-line" style="display: flex; flex-direction: column; align-items: center; width: 100%; padding: 0.25rem 0; margin: 0;"><div class="character-name" style="font-size: 0.7rem; font-weight: bold; margin-bottom: 0.1rem; text-align: center; color: #000; letter-spacing: 0.5px; line-height: 1.2;">${charContent}</div><div class="dialogue-text" style="font-size: 0.8rem; text-align: center; color: #333; font-family: 'Courier New', monospace; line-height: 1.2;">${textContent}</div></div>`;
  };

  const render = (step) => {
    let html = '';

    // Step Logic (More granular):
    // 0: Initial (Target Quote Text visible, Target Char masked, Contexts masked)
    // 1: Reveal Line 2 Text
    // 2: Reveal Line 2 Char
    // 3: Reveal Line 3 Text
    // 4: Reveal Line 3 Char
    // 5: Win (Reveal Title, Reveal Target Char)

    const showLine2Text = step >= 1;
    const showLine2Char = step >= 2;
    const showLine3Text = step >= 3;
    const showLine3Char = step >= 4;
    const isWin = step >= 5;

    // Movie Header
    const realTitle = "Star Wars: Empire Strikes Back";
    // Title reveals on Win (Step 5)
    const titleContent = renderStableContent(realTitle, isWin, 'question', true);

    html += `<div style="text-align: center; margin-bottom: 1rem; color: #000; font-weight: 900; font-size: 0.85rem; letter-spacing: 1px; font-family: 'Courier New', monospace; display: flex; justify-content: center; line-height: 1.2;">${titleContent}</div>`;

    html += '<div style="flex: 1; display: flex; flex-direction: column; justify-content: center; position: relative; gap: 0.5rem; width: 100%;">';

    // Quote 1 (Target) - Text always visible
    // Target Char reveals on Win
    html += renderLine(lines[0], true, isWin);

    // Quote 2 (Context)
    html += renderLine(lines[1], showLine2Text, showLine2Char);

    // Quote 3 (Context)
    html += renderLine(lines[2], showLine3Text, showLine3Char);

    html += '</div>';

    container.innerHTML = html;

    if (step === 5) {
      fireMiniConfetti(container);
    }
  };

  let step = 0;
  render(step);

  animationInterval = setInterval(() => {
    step++;
    // Cycle: 0 -> 1 -> 2 -> 3 -> 4 -> 5 (Win/Confetti) -> 6,7 (Hold) -> Reset
    if (step > 7) {
      step = 0;
    }
    // Clamp to 5 for visual state so we hold on the win screen for a few ticks
    render(Math.min(step, 5));
  }, 1000); // 1.0s speed (snappier, but granual steps make it feel properly paced)
}
