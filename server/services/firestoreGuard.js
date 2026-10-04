const state = {
  quotaPausedUntil: 0,
  cache: new Map(),
};

const QUOTA_PAUSE_MS = 5 * 60 * 1000;

function isQuotaExceededError(error) {
  if (!error) return false;
  if (error.code === 8 || error.code === 'RESOURCE_EXHAUSTED') return true;
  const details = [error.details, error.message].filter(Boolean).join(' ');
  return !!details && /quota exceeded|RESOURCE_EXHAUSTED|resource_exhausted/i.test(details);
}

function markQuotaExceeded(error) {
  if (!isQuotaExceededError(error)) return false;
  state.quotaPausedUntil = Date.now() + QUOTA_PAUSE_MS;
  console.warn('Firestore free-tier safe mode enabled for 5 minutes to prevent repeated quota failures.');
  return true;
}

function isQuotaPaused() {
  return Date.now() < state.quotaPausedUntil;
}

function getCachedValue(key, ttlMs) {
  const item = state.cache.get(key);
  if (!item) return undefined;
  if (Date.now() > item.expiresAt) {
    state.cache.delete(key);
    return undefined;
  }
  return item.value;
}

function setCachedValue(key, value, ttlMs) {
  state.cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
  return value;
}

module.exports = {
  QUOTA_PAUSE_MS,
  isQuotaExceededError,
  markQuotaExceeded,
  isQuotaPaused,
  getCachedValue,
  setCachedValue,
};
