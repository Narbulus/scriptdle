import { useState, useEffect } from 'preact/hooks';
import { router } from '../router.jsx';
import { getTimeUntilMidnight } from '../utils/time.js';

export function Footer() {
  const [countdown, setCountdown] = useState('00:00:00');

  useEffect(() => {
    const updateCountdown = () => {
      const time = getTimeUntilMidnight();
      const hours = String(time.hours).padStart(2, '0');
      const minutes = String(time.minutes).padStart(2, '0');
      const seconds = String(time.seconds).padStart(2, '0');
      setCountdown(`${hours}:${minutes}:${seconds}`);
    };

    updateCountdown();
    const intervalId = setInterval(updateCountdown, 1000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="footer-bar" data-testid="footer-bar">
      <div className="footer-left">
        <button
          className="footer-link"
          onClick={(e) => {
            e.preventDefault();
            router.navigate('/about');
          }}
        >
          ABOUT
        </button>
      </div>

      <div className="footer-center">
        <div className="footer-countdown">{countdown}</div>
      </div>

      <div className="footer-right">
        <a
          className="footer-link"
          href="mailto:feedback@scriptle.net?subject=Scriptle Feedback"
        >
          FEEDBACK
        </a>
      </div>
    </div>
  );
}
