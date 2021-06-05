'use strict';

const common = require('./common');
const custom = require('util').inspect.custom || 'inspect';

class LockStatus {
  constructor(lockLogger, stack, stackOptions) {
    this.lockLogger = lockLogger;
    this.state = common.STATE_WAITING;
    this.stack = stack;
    this.stackOptions = stackOptions;
  }

  [custom]() {
    return `<LockStatus
    state=${this.state}
    waiting=${this.lockLogger.waiting}
    stack=${this.stack.format(this.stackOptions)}
    />`;
  }

  formatStack(options) {
    options = typeof options === 'object' ? options : {};
    const opts = {
      ...this.stackOptions,
      ...options
    };

    return this.stack.format(opts);
  }

  formatStatus() {
    const status = `${this.state} - ` + this.formatStack({
      depth: 2
    });

    return status;
  }
}

exports.LockStatus = LockStatus;
