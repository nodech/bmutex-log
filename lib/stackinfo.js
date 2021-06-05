'use strict';

const {relative} = require('path');

class StackInfo {
  constructor(id, callsites) {
    this.id = id;
    this.callsites = Array.isArray(callsites) ? callsites : [];
  }

  /**
   * Format callsites, uses Stack Trace API.
   * @see {@link https://v8.dev/docs/stack-trace-api|V8 Blog}
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

        formatted += ` (${relative(options.root, file)}:${line}:${col})`;
      }

      parts.push(formatted);
    }

    return parts.join(options.joinStr);
  }

  /**
   * Stack Trace API
   * @see {@link https://v8.dev/docs/stack-trace-api|V8 Blog}
   * @param {Number} [from=1] - skip first from entries
   * @returns {StackInfo}
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

exports.StackInfo = StackInfo;
