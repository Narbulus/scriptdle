// Track events for testing (exposed on window in dev/test)
const eventLog = [];

export function track(event, params = {}) {
  if (typeof gtag !== 'undefined') {
    gtag('event', event, params);
  }
  // Always log for testability
  eventLog.push({ event, params, timestamp: Date.now() });
}

export function getEventLog() {
  return [...eventLog];
}

export function clearEventLog() {
  eventLog.length = 0;
}

// Expose for Playwright tests
if (typeof window !== 'undefined') {
  window.__analyticsEventLog = eventLog;
}
