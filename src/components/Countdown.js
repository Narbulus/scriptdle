import { getTimeUntilMidnight } from '../utils/time.js';

export function Countdown() {
    const container = document.createElement('div');
    container.className = 'countdown-container';


    // const label = document.createElement('div');
    // label.textContent = 'NEXT PUZZLE';
    // label.className = 'countdown-label';

    const timer = document.createElement('div');
    timer.className = 'timer-display';

    // container.appendChild(label);
    container.appendChild(timer);

    function update() {
        const { hours, minutes, seconds } = getTimeUntilMidnight();
        const h = String(hours).padStart(2, '0');
        const m = String(minutes).padStart(2, '0');
        const s = String(seconds).padStart(2, '0');
        timer.textContent = `${h}:${m}:${s}`;
    }

    // Initial update
    update();

    // Start interval
    const intervalId = setInterval(update, 1000);

    // Cleanup method attached to element (to be called if removed manually, though simple DOM removal usually suffices for small apps)
    container._cleanup = () => clearInterval(intervalId);

    return container;
}
