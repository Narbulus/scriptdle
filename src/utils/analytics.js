export function track(event, params = {}) {
  if (typeof gtag !== 'undefined') {
    gtag('event', event, params);
  }
}
