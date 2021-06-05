'use strict';

const Logger = require('blgr');
const {Lock, MapLock} = require('bmutex');
const {LockLogger} = require('../lib/bmutex-log');

class TestClass {
  constructor() {
    this.normalLock = new Lock();
    this.mapLock = new MapLock();
  }

  async doWork1() {
    const unlock = await this.normalLock.lock();
    try {
      return await this._doWork1();
    } finally {
      unlock();
    }
  }
  async _doWork1() {
    return new Promise((resolve, reject) => {
      setTimeout(resolve, 1000);
    });
  }
}

const logger = new Logger({ console: true });
const lockLogger = new LockLogger({ logger });
const test1 = new TestClass();

lockLogger.hijack(test1);

(async () => {
  await logger.open();
  logger.setLevel('spam');

  test1.doWork1().then(() => {
    console.log('done.');
  });

  for (let i = 0; i < 3; i++)
    test1.doWork1();

  await test1.doWork1();
  await logger.close();
})().catch((e) => {
  console.error(e);
});

