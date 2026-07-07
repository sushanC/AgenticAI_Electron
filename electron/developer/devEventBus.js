'use strict';

/**
 * devEventBus.js
 *
 * Central Node.js EventEmitter for all developer console events.
 *
 * Usage:
 *   const bus = require('./devEventBus');
 *   bus.emit('IntentDetected', { ... });
 *   bus.on('IntentDetected', (event) => { ... });
 *
 * All events emitted here have already been fully constructed
 * by developerLogger.js. This bus is the single pub/sub hub —
 * no module emits directly to the renderer.
 */

const { EventEmitter } = require('events');

const devEventBus = new EventEmitter();

// Prevent Node.js MaxListenersExceededWarning — this bus can have
// many listeners (one per event type × subscriber count)
devEventBus.setMaxListeners(50);

module.exports = devEventBus;
