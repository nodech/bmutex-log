'use strict';

const {Lock, MapLock} = require('bmutex');
const {NormalLockLogger, MapLockLogger} = require('./lock-logger');

// in case someone links, you can use this to overwrite.
exports.Lock = Lock;
exports.MapLock = MapLock;

exports.NormalLockLogger = NormalLockLogger;
exports.MapLockLogger = MapLockLogger;

exports.wrapper = (object, options) => {
  if (typeof options !== 'object')
    options = {};

  if (object instanceof exports.Lock)
    return new NormalLockLogger(object, options, exports.Lock);

  if (object instanceof exports.MapLock)
    return new MapLockLogger(object, options, exports.MapLock);

  return object;
};

/**
 * @param {Object} obj - Object to hijack
 * @param {Object} options - logger options
 */

exports.hijack = (object, options) => {
  if (typeof options !== 'object')
    options = {};

  for (const prop of Object.getOwnPropertyNames(object)) {
    const val = object[prop];
    object[prop] = exports.wrapper(val, {
      propName: prop,
      ...options
    });
  }
};
