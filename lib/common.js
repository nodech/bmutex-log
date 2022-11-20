'use strict';

const common = exports;

common.STATE_WAITING = 'waiting';
common.STATE_PROCESSING = 'processing';
common.STATE_FINISHED = 'finished';

/**
 * @param {String|Buffer} name
 * @returns {String}
 */


common.formatName = (name) => {
  if (Buffer.isBuffer(name))
    return name.toString('hex').slice(0, 6);

  return name;
};
