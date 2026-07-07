'use strict';

/**
 * developerLogger.js
 *
 * Maintains a fixed-size ring buffer of all developer events received
 * from the backend process. The buffer is keyed by requestId — each
 * requestId groups all events belonging to one user message into a
 * FullRequestSummary object.
 *
 * Architecture:
 *   • ring buffer holds up to MAX_REQUESTS FullRequestSummary objects
 *   • events from the backend (via devEventBus) update the in-progress
 *     summary for the current requestId
 *   • when a FullRequestSummary event arrives, the request is finalized
 *     and pushed to the history array
 *   • getHistory() returns a copy of the ring buffer, newest last
 *   • clear() resets everything
 *
 * Performance:
 *   • No serialization inside this module — raw objects only
 *   • O(1) push with automatic oldest-entry eviction
 */

const MAX_REQUESTS = 500;

// ─── State ────────────────────────────────────────────────────────────────────

/** @type {import('./developerManager').FullRequestSummary[]} */
let _history = [];

/** @type {Map<string, Partial<import('./developerManager').FullRequestSummary>>} */
const _inProgress = new Map();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Push a raw backend DEV_EVENT into the logger.
 * Partial events are accumulated per requestId.
 * FullRequestSummary events finalize the record.
 *
 * @param {{ id: string, timestamp: string, type: string, requestId: string, payload: object }} event
 */
function push(event) {
  const { type, requestId, payload, timestamp, id } = event;

  if (type === 'FullRequestSummary') {
    // Finalize this request — merge in-progress partial data with the full summary
    const partial = _inProgress.get(requestId) || {};
    const summary = {
      ...partial,
      ...payload,
      id,
      requestId,
      finalizedAt: timestamp,
    };
    _inProgress.delete(requestId);
    _pushToHistory(summary);
    return;
  }

  // Accumulate partial data by type
  const partial = _inProgress.get(requestId) || { requestId, startedAt: timestamp, events: [] };

  // Track all raw events for the EventStream panel
  partial.events = partial.events || [];
  partial.events.push({ type, timestamp, payload, id });

  // Merge type-specific fields for quick access in panels
  switch (type) {
    case 'IntentDetected':
      partial.intent    = payload.intent;
      partial.tool      = payload.tool;
      partial.userPrompt = payload.userPrompt;
      break;
    case 'MemoryRetrieved':
      partial.memoryDetails = payload;
      break;
    case 'PromptBuilt':
      partial.promptDetails = payload;
      partial.estimatedTokens = payload.estimatedTokens;
      break;
    case 'ModelSelected':
      partial.modelCandidates = payload.candidates;
      partial.selectedModel = payload.selected;
      partial.modelSelectionReason = payload.reason;
      break;
    case 'ProviderCalled':
      partial.provider = payload.provider;
      partial.model = payload.model;
      break;
    case 'ProviderSucceeded':
      partial.latencyMs = payload.latencyMs;
      partial.success = true;
      break;
    case 'ProviderFailed':
      partial.success = false;
      partial.errorDetails = { code: payload.statusCode, message: payload.error, suggestion: payload.suggestion };
      break;
    case 'RetryStarted':
    case 'RetryFinished':
      partial.retryCount = (partial.retryCount || 0) + (type === 'RetryFinished' ? 0 : 1);
      break;
    case 'FallbackStarted':
      partial.fallbackOccurred = true;
      partial.fallbackChain = payload.fallbackChain || [payload.fromProvider, payload.toProvider];
      break;
    case 'ToolStarted':
    case 'ToolFinished':
      partial.toolTrace = partial.toolTrace || [];
      partial.toolTrace.push({ type, ...payload });
      break;
    default:
      break;
  }

  _inProgress.set(requestId, partial);
}

/**
 * Returns all finalized request summaries (copy), newest first.
 * @returns {object[]}
 */
function getHistory() {
  return [..._history].reverse();
}

/**
 * Returns all in-progress (partial) requests.
 * @returns {object[]}
 */
function getInProgress() {
  return Array.from(_inProgress.values());
}

/**
 * Clear all history and in-progress requests.
 */
function clear() {
  _history = [];
  _inProgress.clear();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _pushToHistory(summary) {
  _history.push(summary);
  // Evict oldest when over limit
  if (_history.length > MAX_REQUESTS) {
    _history.shift();
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = { push, getHistory, getInProgress, clear };
