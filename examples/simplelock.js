'use strict';

const {Lock} = require('bmutex');
const BmutexLock = require('../lib/bmutex-log');

class TestClass {
  constructor() {
    this.normalLock = new Lock();
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

(async () => {
  const test1 = new TestClass();

  BmutexLock.Lock = Lock;
  BmutexLock.hijack(test1, {
    objName: 'test1'
  });

  test1.doWork1().then(() => {
    console.log('done.');
  });

  for (let i = 0; i < 3; i++)
    test1.doWork1();

  await test1.doWork1();
})().catch((e) => {
  console.error(e);
});

