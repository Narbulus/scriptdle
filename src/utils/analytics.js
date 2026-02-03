// Track events for testing (exposed on window in dev/test)
const eventLog = [];

// Global context that will be included in all events
// Build info will be loaded lazily on first use
let globalContext = {};
let buildInfoLoaded = false;

// Lazy load build info
async function ensureBuildInfo() {
  if (!buildInfoLoaded) {
    try {
      const { BUILD_INFO } = await import('../build-info.js');
      globalContext.build_version = BUILD_INFO.version;
      globalContext.commit_hash = BUILD_INFO.commitHash;
      buildInfoLoaded = true;
    } catch {
      // Build info not available (dev environment before build)
      globalContext.build_version = 'dev';
      globalContext.commit_hash = 'unknown';
      buildInfoLoaded = true;
    }
  }
}

/**
 * Set global context parameters that will be included in all analytics events
 * @param {object} context - Key-value pairs to include in all events
 */
export function setGlobalContext(context) {
  ensureBuildInfo(); // Load build info if not already loaded
  // Preserve build info when updating context
  globalContext = {
    ...globalContext,
    ...context
  };
}

/**
 * Clear the global context (but preserve build info)
 */
export function clearGlobalContext() {
  ensureBuildInfo(); // Load build info if not already loaded
  const buildVersion = globalContext.build_version;
  const commitHash = globalContext.commit_hash;
  globalContext = {
    build_version: buildVersion,
    commit_hash: commitHash
  };
}

/**
 * Track an analytics event with automatic global context inclusion
 * @param {string} event - Event name
 * @param {object} params - Event parameters (will be merged with global context)
 */
export function track(event, params = {}) {
  ensureBuildInfo(); // Ensure build info is loaded
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
