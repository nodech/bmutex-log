'use strict';

const {Lock} = require('bmutex');
const assert = require('assert');
const Logger = require('blgr');
const common = require('./common');
const {LockStatus} = require('./lockstatus');
const {StackInfo} = require('./stackinfo');

const CWD = process.cwd();
const LOCAL_STACK_N = 3;

class LockLoggerBase {
  constructor() {
    this.id = 0;
  }

  lock() {
    throw new Error('abstract');
  }

  getStatus() {
    const from = this.loggerOpts.from + LOCAL_STACK_N;
    const stack = StackInfo.getStack(this.id, from);
    this.id++;

    return new LockStatus(this, stack, this.loggerOpts);
  }
}

class NormalLockLogger extends LockLoggerBase {
  constructor(lock, options) {
    super();

    assert(lock instanceof Lock);

    this._lock = lock;
    this.destroyed = false;
    this.queue = [];
    this.options = new NormalLockLoggerOptions(options);
    this.logger = this.options.logger.context('normal-lock');
    this.loggerOpts = this.options.loggerOpts;
  }

  get waiting() {
    return this.queue.length;
  }

  printStatuses(status) {
    if (status.state === common.STATE_WAITING)
      this.logger.debug(`new lock: ${status.formatStack()}`);

    if (status.state === common.STATE_PROCESSING)
      this.logger.debug(`processing: ${status.formatStack()}`);

    if (status.state === common.STATE_FINISHED)
      this.logger.debug(`finished: ${status.formatStack()}`);

    for (const status of this.queue)
      this.logger.spam('  ', status.formatStatus());
  }

  has(name) {
    return this._lock.has(name);
  }

  pending(name) {
    return this._lock.pending(name);
  }

  /**
   * @param {String?} name - Job name
   * @param {Boolean?} force - Bypass the lock
   * @returns {Promise<Function>}
   */

  async lock(arg1, arg2) {
    const status = this.getStatus();

    this.printStatuses(status);
    this.queue.push(status);

    const unlocker = await this._lock.lock(arg1, arg2);
    status.state = common.STATE_PROCESSING;
    this.printStatuses(status);

    return () => {
      const finished = this.queue.shift();
      finished.state = common.STATE_FINISHED;
      this.printStatuses(status);

      unlocker();
    };
  }

  unlock() {
    return this._lock.unlock();
  }

  destroy() {
    this.destroyed = true;
    return this._lock.destroy();
  }
}

class NormalLockLoggerOptions {
  constructor(options) {
    this.logger = Logger.global;
    this.loggerOpts = {
      from: 0,
      root: CWD,
      showLoc: true,
      depth: 2,
      joinStr: ' called by '
    };

    if (options)
      this.fromOptions(options);
  }

  fromOptions(options) {
    assert(options, 'Options are required.');

    if (options.logger != null) {
      assert(typeof options.logger === 'object');
      this.logger = options.logger;
    }

    if (!options.loggerOptions)
      return this;

    const {loggerOptions: loggerOpts} = options;

    if (typeof loggerOpts.depth === 'number' && loggerOpts.depth > 1)
      this.loggerOpts.depth = loggerOpts.depth;

    if (typeof loggerOpts.root === 'string')
      this.loggerOpts.root = loggerOpts.root;

    if (typeof loggerOpts.showLoc === 'boolean')
      this.loggerOpts.showLoc = loggerOpts.showLoc;

    if (typeof loggerOpts.joinStr === 'string')
      this.loggerOpts.joinStr = loggerOpts.joinStr;

    return this;
  }
}

class LockLogger {
  constructor(options) {
    this.options = options || {};
  }

  hijack(object) {
    for (const prop of Object.getOwnPropertyNames(object)) {
      const val = object[prop];

      if (val instanceof Lock)
        object[prop] = new NormalLockLogger(val, this.options);
    }
  }
}

exports.LockLogger = LockLogger;
exports.StackInfo = StackInfo;
