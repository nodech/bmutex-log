// @ts-check
'use strict';

const assert = require('bsert');
const common = require('./common');
const custom = require('util').inspect.custom || 'inspect';
const {relative} = require('path');

class StackInfo {
  /**
   * @param {Number} id
   * @param {CallSite[]} callsites
   */

  constructor(id, callsites) {
    this.id = id;
    this.callsites = Array.isArray(callsites) ? callsites : [];
  }

  /**
   * Format callsites, uses Stack Trace API.
   * @see {@link https://v8.dev/docs/stack-trace-api|V8 Blog}
   * @param {Object} options
   * @returns {String}
   */

  format(options) {
    const parts = [];

    for (let i = 0; i < options.depth && i < this.callsites.length; i++) {
      const callsite = this.callsites[i];
      const typeName = callsite.getTypeName();
      const fnName = callsite.getFunctionName();

      let formatted = `#${this.id} `;

      formatted += typeName ? typeName + '.' : '';
      formatted += fnName ? fnName : '<anon>';

      if (options.showLoc) {
        const file = callsite.getFileName();
        const line = callsite.getLineNumber();
        const col = callsite.getColumnNumber();

        if (file)
          formatted += ` (${relative(options.root, file)}:${line}:${col})`;
      }

      parts.push(formatted);
    }

    return parts.join(options.joinStr);
  }

  /**
   * Stack Trace API
   * @see {@link https://v8.dev/docs/stack-trace-api|V8 Blog}
   * @param {Number} id
   * @param {Number} [from=1] - skip first from entries
   * @returns {String}
   */

  static getStack(id, from) {
    const _prepareStackTrace = Error.prepareStackTrace;

    const err = new Error();
    Error.prepareStackTrace = (_err, callsites) => {
      return new StackInfo(id, callsites.slice(from || 1));
    };

    const stack = err.stack;
    Error.prepareStackTrace = _prepareStackTrace;

    return stack;
  }
}

class LockStatus {
  /**
   * @param {Object} options
   */

  constructor(options) {
    this.options = new LockStatusOptions(options);
    this.stackOptions = this.options.stackOptions;
    this.lockLogger = this.options.lockLogger;
    this.stack = this.options.stack;
    this.named = this.options.named;
    this.map = this.options.map;
    this.state = common.STATE_WAITING;

    this._name = '';
  }

  /**
   * @returns {String}
   */

  get name() {
    return this._name;
  }

  /**
   * @param {String} str
   */

  set name(str) {
    this._name = '(' + str + ')';
  }

  [custom]() {
    return `<LockStatus
    state=${this.state}
    waiting=${this.lockLogger.waiting}
    stack=${this.stack.format(this.stackOptions)}
    />`;
  }

  /**
   * @param {Object} options
   */

  formatStack(options) {
    options = typeof options === 'object' ? options : {};
    const opts = {
      ...this.stackOptions,
      ...options
    };

    return this.stack.format(opts);
  }

  formatStatus() {
    let status = `${this.state}`;

    if (this.named)
      status += ` ${this.name} - `;
    else if (this.map)
      status += ` <${this.name}> - `;
    else
      status += ' - ';

    status += this.formatStack({ depth: 2 });

    return status;
  }
}

class LockStatusOptions {
  /**
   * @param {Object} options
   */

  constructor(options) {
    this.lockLogger = null;
    this.stack = null;
    this.stackOptions = {};
    this.named = false;
    this.map = false;

    this.fromOptions(options);
  }

  /**
   * @param {Object} options
   */

  fromOptions(options) {
    assert(options);
    assert(typeof options.lockLogger === 'object');
    assert(options.stack instanceof StackInfo);

    this.lockLogger = options.lockLogger;
    this.stack = options.stack;

    if (options.stackOptions != null) {
      assert(typeof options.stackOptions === 'object');
      this.stackOptions = options.stackOptions;
    }

    if (options.named != null) {
      assert(typeof options.named === 'boolean');
      this.named = options.named;
    }

    if (options.map != null) {
      assert(typeof options.map === 'boolean');
      this.map = options.map;
    }
  }
}

exports.LockStatus = LockStatus;
exports.StackInfo = StackInfo;
