'use strict';

const {MapLock} = require('bmutex');

class TestClass {
  constructor() {
    this.mapLock = new MapLock();
  }

  async doWorkA() {
    const unlock = await this.mapLock.lock('A');
    try {
      return await this._doWorkA();
    } finally {
      unlock();
    }
  }

  async _doWorkA() {
    return new Promise((resolve, reject) => {
      console.log('A done');
      setTimeout(resolve, 200);
    });
  }

  async doWorkB() {
    const unlock = await this.mapLock.lock('B');

    try {
      return await this._doWorkB();
    } finally {
      unlock();
    }
  }

  async _doWorkB() {
    return new Promise((resolve, reject) => {
      console.log('B done');
      setTimeout(resolve, 200);
    });
  }
}

(async () => {
  const test1 = new TestClass();

  require('../lib/bmutex-log').hijack(test1, {
    objName: 'TestClass'
  });

  let promises;

  promises = [0, 1, 2].map(() => test1.doWorkA());
  await Promise.all(promises);

  promises = [];

  for (let i = 0; i < 5; i++) {
    promises.push(test1.doWorkA());
    promises.push(test1.doWorkB());
  }

  await Promise.all(promises);

  test1.doWorkA();
  test1.doWorkB();
})().catch((e) => {
  console.error(e);
});

