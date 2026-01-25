import { router } from '../router.js';
import { getTimeUntilMidnight } from '../utils/time.js';

export function Footer() {
  const footer = document.createElement('div');
  footer.className = 'footer-bar';
  footer.setAttribute('data-testid', 'footer-bar');

  // Left side - About link
  const leftSide = document.createElement('div');
  leftSide.className = 'footer-left';

  const aboutLink = document.createElement('button');
  aboutLink.className = 'footer-link';
  aboutLink.textContent = 'ABOUT';
  aboutLink.onclick = (e) => {
    e.preventDefault();
    router.navigate('/about');
  };
  leftSide.appendChild(aboutLink);

  // Center - Next game countdown
  const center = document.createElement('div');
  center.className = 'footer-center';

  const countdownContainer = document.createElement('div');
  countdownContainer.className = 'footer-countdown';

  const updateCountdown = () => {
    const time = getTimeUntilMidnight();
    const hours = String(time.hours).padStart(2, '0');
    const minutes = String(time.minutes).padStart(2, '0');
    const seconds = String(time.seconds).padStart(2, '0');
    countdownContainer.textContent = `${hours}:${minutes}:${seconds}`;
  };

  updateCountdown();
  const intervalId = setInterval(updateCountdown, 1000);

  // Store cleanup function
  footer._cleanup = () => {
    clearInterval(intervalId);
  };

  center.appendChild(countdownContainer);

  // Right side - Feedback link
  const rightSide = document.createElement('div');
  rightSide.className = 'footer-right';

  const feedbackLink = document.createElement('a');
  feedbackLink.className = 'footer-link';
  feedbackLink.textContent = 'FEEDBACK';
  feedbackLink.href = 'mailto:feedback@scriptle.net?subject=Scriptle Feedback';
  feedbackLink.onclick = (e) => {
    // Let the default mailto: behavior handle this
  };
  rightSide.appendChild(feedbackLink);

  footer.appendChild(leftSide);
  footer.appendChild(center);
  footer.appendChild(rightSide);

  return footer;
}
