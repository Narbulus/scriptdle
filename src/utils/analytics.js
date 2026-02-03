import { BUILD_INFO } from '../build-info.js';

// Track events for testing (exposed on window in dev/test)
const eventLog = [];

// Global context that will be included in all events
// Initialize with build info
let globalContext = {
  build_version: BUILD_INFO.version,
  commit_hash: BUILD_INFO.commitHash
};

/**
 * Set global context parameters that will be included in all analytics events
 * @param {object} context - Key-value pairs to include in all events
 */
export function setGlobalContext(context) {
  // Preserve build info when updating context
  globalContext = {
    build_version: BUILD_INFO.version,
    commit_hash: BUILD_INFO.commitHash,
    ...context
  };
}

/**
 * Clear the global context (but preserve build info)
 */
export function clearGlobalContext() {
  globalContext = {
    build_version: BUILD_INFO.version,
    commit_hash: BUILD_INFO.commitHash
  };
}

/**
 * Track an analytics event with automatic global context inclusion
 * @param {string} event - Event name
 * @param {object} params - Event parameters (will be merged with global context)
 */
export function track(event, params = {}) {
  // Merge global context with event params (event params take precedence)
  const mergedParams = { ...globalContext, ...params };

  if (typeof gtag !== 'undefined') {
    gtag('event', event, mergedParams);
  }
  // Always log for testability
  eventLog.push({ event, params: mergedParams, timestamp: Date.now() });
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
