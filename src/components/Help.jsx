import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { Modal } from './common/Modal.jsx';
import { generateFlower, generateBeetle } from '../utils/flowerGenerator.js';

function HelpBadges() {
  const flowerSvg = generateFlower(12345, '#8BC34A');
  const beetleSvg = generateBeetle(67890, '#FF5722');

  const badgeStyle = {
    width: '64px',
    height: '64px',
    backgroundSize: 'contain',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2))'
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', marginTop: '2rem' }}>
      <div style={{ ...badgeStyle, backgroundImage: `url('${flowerSvg}')` }} />
      <div style={{ ...badgeStyle, backgroundImage: `url('${beetleSvg}')` }} />
    </div>
  );
}

const isHelpModalOpen = signal(false);

export function openHelpModal() {
  isHelpModalOpen.value = true;
}

export function HelpModal() {
  const animationIntervalRef = useRef(null);
  const stepRef = useRef(0);
  const confettiFiredRef = useRef(false);

  useEffect(() => {
    if (isHelpModalOpen.value) {
      startAnimation();
    } else {
      stopAnimation();
    }
    return () => stopAnimation();
  }, [isHelpModalOpen.value]);

  function stopAnimation() {
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }
  }

  function fireMiniConfetti(container) {
    const colors = ['#a864fd', '#29cdff', '#78ff44', '#ff718d', '#fdff6a'];
    for (let i = 0; i < 40; i++) {
      const confetti = document.createElement('div');
      confetti.style.position = 'absolute';
      confetti.style.width = '6px';
      confetti.style.height = '6px';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.left = Math.random() * 100 + '%';
      confetti.style.top = '-10px';
      confetti.style.borderRadius = '50%';
      confetti.style.zIndex = '10';
      container.appendChild(confetti);

      const velocityX = (Math.random() - 0.5) * 2;
      const rotation = Math.random() * 360;

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
    stopAnimation();
    confettiFiredRef.current = false;
    stepRef.current = 0;

    const container = document.getElementById('demo-script-container');
    if (!container) return;

    const lines = [
      { text: "I love you.", char: "LEIA", type: 'target' },
      { text: "I know.", char: "HAN", type: 'context' },
      { text: "Put him in.", char: "VADER", type: 'context' }
    ];

    const renderStableContent = (text, isRevealed, maskType = 'bar', isTitle = false) => {
      const wrapperStyle = "position: relative; display: inline-block; vertical-align: middle;";
      const textVisibility = "visibility: visible;";
      const textStyle = `font-family: inherit; font-size: inherit; font-weight: inherit; line-height: inherit; ${textVisibility} white-space: nowrap;`;

      let overlayInner = '';
      if (maskType === 'question') {
        const fSize = isTitle ? '0.7rem' : '0.6rem';
        overlayInner = `<span style="background-color: var(--placeholder-bg); border-radius: 4px; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-weight: bold; color: var(--text-primary); font-size: ${fSize}; letter-spacing: 1px;">???</span>`;
      } else {
        overlayInner = `<span style="background-color: var(--placeholder-bg); border-radius: 4px; width: 100%; height: 1em; display: block;"></span>`;
      }

      const opacity = isRevealed ? '0' : '1';
      const transition = 'opacity 0.5s ease';
      const overlayStyle = `position: absolute; left: 0; top: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; opacity: ${opacity}; transition: ${transition}; pointer-events: none;`;

      return `<span style="${wrapperStyle}"><span style="${textStyle}">${text}</span><span style="${overlayStyle}">${overlayInner}</span></span>`;
    };

    const renderLine = (line, revealText, revealChar) => {
      const maskType = (line.type === 'target') ? 'question' : 'bar';
      const charContent = renderStableContent(line.char, revealChar, maskType);

      const isTextVisible = (line.type === 'target' || revealText);
      const textContent = renderStableContent(line.text, isTextVisible, 'bar');

      return `<div class="script-line" style="display: flex; flex-direction: column; align-items: center; width: 100%; padding: 0.25rem 0; margin: 0;"><div class="character-name" style="font-size: 0.7rem; font-weight: bold; margin-bottom: 0.1rem; text-align: center; color: var(--script-text-primary); letter-spacing: 0.5px; line-height: 1.2;">${charContent}</div><div class="dialogue-text" style="font-size: 0.8rem; text-align: center; color: var(--script-text-secondary); font-family: var(--font-mono); line-height: 1.2;">${textContent}</div></div>`;
    };

    const render = (step) => {
      if (!container) return;

      let html = '';

      const showLine2Text = step >= 1;
      const showLine2Char = step >= 2;
      const showLine3Text = step >= 3;
      const showLine3Char = step >= 4;
      const isWin = step >= 5;

      const realTitle = "Star Wars: Empire Strikes Back";
      const titleContent = renderStableContent(realTitle, isWin, 'question', true);

      html += `<div style="text-align: center; margin-bottom: 1rem; color: var(--script-text-primary); font-weight: 900; font-size: 0.85rem; letter-spacing: 1px; font-family: var(--font-mono); display: flex; justify-content: center; line-height: 1.2;">${titleContent}</div>`;

      html += '<div style="flex: 1; display: flex; flex-direction: column; justify-content: center; position: relative; gap: 0.5rem; width: 100%;">';

      html += renderLine(lines[0], true, isWin);
      html += renderLine(lines[1], showLine2Text, showLine2Char);
      html += renderLine(lines[2], showLine3Text, showLine3Char);

      html += '</div>';

      container.innerHTML = html;

      if (step === 5 && !confettiFiredRef.current) {
        fireMiniConfetti(container);
        confettiFiredRef.current = true;
      }
    };

    render(stepRef.current);

    animationIntervalRef.current = setInterval(() => {
      stepRef.current++;
      if (stepRef.current > 7) {
        stepRef.current = 0;
        confettiFiredRef.current = false;
      }
      render(Math.min(stepRef.current, 5));
    }, 1000);
  }

  return (
    <Modal
      id="help-modal"
      isOpen={isHelpModalOpen.value}
      onClose={() => isHelpModalOpen.value = false}
      title="How To Play"
      theme="main"
    >
      <div class="modal-body custom-scrollbar">
        <div class="help-section" style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: '2rem' }}>
            Guess the <strong>MOVIE</strong> and the <strong>CHARACTER</strong> from the quote.
          </p>

          <div
            id="demo-script-container"
            data-theme="script"
            style={{
              background: 'var(--script-bg)',
              padding: '1.5rem',
              border: '1px solid var(--placeholder-bg)',
              borderRadius: '8px',
              marginBottom: '2rem',
              position: 'relative',
              overflow: 'hidden',
              minHeight: '200px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center'
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left', marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ background: 'var(--text-primary)', color: 'var(--btn-text)', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem', fontWeight: 'bold', marginTop: '2px' }}>1</div>
              <div>
                <strong>You have 5 attempts.</strong><br />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Guess the movie correctly to lock it in.</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ background: 'var(--text-primary)', color: 'var(--btn-text)', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem', fontWeight: 'bold', marginTop: '2px' }}>2</div>
              <div>
                <strong>Each wrong guess reveals more of the script.</strong><br />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Reveals following lines from the movie.</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ background: 'var(--text-primary)', color: 'var(--btn-text)', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem', fontWeight: 'bold', marginTop: '2px' }}>3</div>
              <div>
                <strong>A new puzzle every day at midnight.</strong><br />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Come back to keep your streak alive!</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ background: 'var(--text-primary)', color: 'var(--btn-text)', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.8rem', fontWeight: 'bold', marginTop: '2px' }}>4</div>
              <div>
                <strong>Winners get flowers. Losers get beetles.</strong>
              </div>
            </div>
          </div>

          <HelpBadges />
        </div>
      </div>
    </Modal>
  );
}
