'use strict';

const assert = require('bsert');
const {Lock, MapLock} = require('bmutex');
const Logger = require('blgr');
const common = require('./common');
const {LockStatus, StackInfo} = require('./lockstatus');

const CWD = process.cwd();
const LOCAL_STACK_N = 3;

class LockLoggerBase {
  constructor(lock, options, name = 'lock-logger') {
    this.options = new LockLoggerOptions(name, options);
    this.typeName = name;
    this.propName = this.options.propName;
    this.objName = this.options.objName;

    this.logger = this.options.logger.context(
      `<${this.typeName}>${this.objName}.${this.propName}`
    );

    this.options.logger.setLevel(this.options.level);
    this.options.logger.closed = false;

    this._lock = lock;
    this.destroyed = false;

    this.id = 0;
  }

  lock() {
    throw new Error('abstract');
  }

  /**
   * @returns {LockStatus}
   */

  getStatus() {
    throw new Error('abstract');
  }
}

class NormalLockLogger extends LockLoggerBase {
  constructor(lock, options) {
    super(lock, options, 'Lock');

    assert(lock instanceof exports.Lock);

    this.named = lock.named;
    this.queue = [];
    this.loggerOpts = this.options.loggerOpts;
  }

  get waiting() {
    return this.queue.length;
  }

  get progress() {
    return this.queue.length ? 1 : 0;
  }

  getStatus() {
    const from = this.loggerOpts.from + LOCAL_STACK_N;
    const stack = StackInfo.getStack(this.id, from);
    this.id++;

    return new LockStatus({
      lockLogger: this,
      stack: stack,
      stackOptions: this.loggerOpts,
      named: this.named
    });
  }

  /**
   * @param {LockStatus} status
   */

  printStatuses(status) {
    if (status.state === common.STATE_WAITING)
      this.logger.debug(`new lock${status.name}: ${status.formatStack()}`);

    if (status.state === common.STATE_PROCESSING)
      this.logger.debug(`processing${status.name}: ${status.formatStack()}`);

    if (status.state === common.STATE_FINISHED)
      this.logger.debug(`finished${status.name}: ${status.formatStack()}`);

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

    if (this.named && arg1)
      status.name = arg1;

    this.printStatuses(status);
    this.queue.push(status);

    const unlocker = await this._lock.lock(arg1, arg2);
    this.queue.shift();
    status.state = common.STATE_PROCESSING;
    this.printStatuses(status);

    return () => {
      status.state = common.STATE_FINISHED;
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

class MapLockLogger extends LockLoggerBase {
  constructor(lock, options) {
    super(lock, options, 'MapLock');

    assert(lock instanceof exports.MapLock);

    this.jobs = new lock.Map();
    this.queue = [];
    this._progress = 0;
    this.loggerOpts = this.options.loggerOpts;
  }

  get waiting() {
    return this.queue.size;
  }

  get progress() {
    return this._progress;
  }

  has(name) {
    return this._lock.has(name);
  }

  pending(name) {
    return this._lock.pending(name);
  }

  getStatus() {
    const from = this.loggerOpts.from + LOCAL_STACK_N;
    const stack = StackInfo.getStack(this.id, from);
    this.id++;

    return new LockStatus({
      lockLogger: this,
      stack: stack,
      stackOptions: this.loggerOpts,
      map: true
    });
  }

  /**
   * @param {LockStatus} status
   */

  printStatuses(status) {
    if (status.state === common.STATE_WAITING)
      this.logger.debug(`new lock<${status.name}>: ${status.formatStack()}`);

    if (status.state === common.STATE_PROCESSING)
      this.logger.debug(`processing<${status.name}>: ${status.formatStack()}`);

    if (status.state === common.STATE_FINISHED)
      this.logger.debug(`finished<${status.name}>: ${status.formatStack()}`);

    for (const qstatus of this.queue) {
      if (qstatus === status)
        continue;
      this.logger.spam('  ', qstatus.formatStatus());
    }
  }

  async lock(key, force) {
    const status = this.getStatus();
    status.name = key;

    if (key == null)
      return this._lock.lock(key, force);

    this.printStatuses(status);
    this.queue.push(status);

    const unlocker = await this._lock.lock(key, force);
    this._progress++;
    status.state = common.STATE_PROCESSING;
    this.printStatuses(status);

    return () => {
      status.state = common.STATE_FINISHED;
      this._progress--;
      this.queue.shift();
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

class LockLoggerOptions {
  constructor(defaultName, options) {
    this.typeName = defaultName;
    this.objName = '';
    this.propName = '?prop?';
    this.logger = new Logger({
      console: true
    });
    this.level = 'spam';

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
    assert(typeof options === 'object', 'Options are required.');

    if (options.propName != null) {
      assert(typeof options.propName === 'string', 'name must be a string.');
      this.propName = options.propName;
    }

    if (options.objName != null) {
      assert(typeof options.objName === 'string', 'name must be a string.');
      this.objName = options.objName;
    }

    if (options.level != null) {
      assert(typeof options.level === 'string', 'level must be a string.');
      this.level = options.level;
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

// in case someone links, you can use this to overwrite.
exports.Lock = Lock;
exports.MapLock = MapLock;

exports.NormalLockLogger = NormalLockLogger;
exports.MapLockLogger = MapLockLogger;

exports.wrapper = (object, options) => {
  if (typeof options !== 'object')
    options = {};

  if (object instanceof exports.Lock)
    return new NormalLockLogger(object, options);

  if (object instanceof exports.MapLock)
    return new MapLockLogger(object, options);

  throw new Error('Unknown type of lock');
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
