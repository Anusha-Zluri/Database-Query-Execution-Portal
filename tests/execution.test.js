/**
 * execution.test.js
 *
 * Covers:
 * - utils.js
 * - vm.runner.js
 * - Mongo helpers (positive + negative)
 * - Script execution behavior
 */

const vmRunner = require('../src/execution/script/vm.runner');
const utils = require('../src/execution/script/utils');

describe('utils.js', () => {
  test('sleep resolves after time', async () => {
    const start = Date.now();
    await utils.sleep(10);
    expect(Date.now() - start).toBeGreaterThanOrEqual(10);
  });

  test('now returns Date instance', () => {
    const now = utils.now();
    expect(now).toBeInstanceOf(Date);
  });
});

describe('vm.runner.js', () => {
  test('executes valid script and returns result', async () => {
    const scriptCode = `
      module.exports = async function () {
        return { rowCount: 1, rows: [{ ok: true }] };
      };
    `;

    const result = await vmRunner({
      scriptCode,
      context: {},
      timeoutMs: 1000
    });

    expect(result.rowCount).toBe(1);
    expect(result.rows[0].ok).toBe(true);
  });

  test('throws if script does not export a function', async () => {
    const scriptCode = `
      module.exports = 123;
    `;

    await expect(
      vmRunner({ scriptCode, context: {} })
    ).rejects.toThrow('Script must export a function');
  });

  test('throws if script exports nothing', async () => {
    const scriptCode = `
      const a = 1;
    `;

    await expect(
      vmRunner({ scriptCode, context: {} })
    ).rejects.toThrow('Script must export a function');
  });

  test('throws if script returns invalid shape', async () => {
    const scriptCode = `
      module.exports = async function () {
        return { foo: 'bar' };
      };
    `;

    await expect(
      vmRunner({ scriptCode, context: {} })
    ).rejects.toThrow('Script must return { rowCount, rows }');
  });

  test('throws if script throws internally', async () => {
    const scriptCode = `
      module.exports = async function () {
        throw new Error('boom');
      };
    `;

    await expect(
      vmRunner({ scriptCode, context: {} })
    ).rejects.toThrow('boom');
  });
});

describe('Mongo helper behavior (sandboxed)', () => {
  function mockMongoDb() {
    return {
      collection: jest.fn(() => ({
        insertOne: jest.fn().mockResolvedValue({ insertedId: '1' }),
        insertMany: jest.fn().mockResolvedValue({ insertedCount: 2 }),
        find: jest.fn(() => ({
          toArray: jest.fn().mockResolvedValue([{ a: 1 }])
        })),
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
        deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 })
      }))
    };
  }

  test('mongo.insertOne works', async () => {
    const db = mockMongoDb();

    const scriptCode = `
      module.exports = async function ({ db }) {
        const col = db.collection('movies');
        await col.insertOne({ title: 'A' });
        const docs = await col.find({}).toArray();
        return { rowCount: docs.length, rows: docs };
      };
    `;

    const result = await vmRunner({
      scriptCode,
      context: { db }
    });

    expect(result.rowCount).toBe(1);
    expect(db.collection).toHaveBeenCalledWith('movies');
  });

  test('mongo.insertMany works', async () => {
    const db = mockMongoDb();

    const scriptCode = `
      module.exports = async function ({ db }) {
        const col = db.collection('movies');
        await col.insertMany([{ a: 1 }, { a: 2 }]);
        return { rowCount: 2, rows: [] };
      };
    `;

    const result = await vmRunner({
      scriptCode,
      context: { db }
    });

    expect(result.rowCount).toBe(2);
  });

  test('mongo.updateOne works', async () => {
    const db = mockMongoDb();

    const scriptCode = `
      module.exports = async function ({ db }) {
        const col = db.collection('movies');
        await col.updateOne({ a: 1 }, { $set: { b: 2 } });
        return { rowCount: 1, rows: [] };
      };
    `;

    const result = await vmRunner({
      scriptCode,
      context: { db }
    });

    expect(result.rowCount).toBe(1);
  });

  test('mongo.deleteOne works', async () => {
    const db = mockMongoDb();

    const scriptCode = `
      module.exports = async function ({ db }) {
        const col = db.collection('movies');
        await col.deleteOne({ a: 1 });
        return { rowCount: 1, rows: [] };
      };
    `;

    const result = await vmRunner({
      scriptCode,
      context: { db }
    });

    expect(result.rowCount).toBe(1);
  });

  test('throws if db.collection is missing', async () => {
    const scriptCode = `
      module.exports = async function ({ db }) {
        db.collection('x');
        return { rowCount: 0, rows: [] };
      };
    `;

    await expect(
      vmRunner({
        scriptCode,
        context: { db: {} }
      })
    ).rejects.toThrow();
  });
});
