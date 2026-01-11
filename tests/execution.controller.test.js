/*
const { pool } = require('../src/config/db');
const { Pool } = require('pg');
const { MongoClient } = require('mongodb');
const fs = require('fs/promises');
const instanceRegistry = require('../src/registry/instances.registry');
const controller = require('../src/controllers/execution.controller');

// Mock specific executors
jest.mock(
  '../src/execution/postgres/script.executor',
  () => jest.fn().mockResolvedValue({ rowCount: 1, rows: [] })
);

jest.mock(
  '../src/execution/mongodb/script.executor',
  () => jest.fn().mockResolvedValue({ rowCount: 1, rows: [] })
);

const executePostgresScript = require('../src/execution/postgres/script.executor');
const executeMongoScript = require('../src/execution/mongodb/script.executor');



// Mock Registry
jest.mock('../src/registry/instances.registry', () => ({
  pg_inst: { engine: 'postgres', baseUrl: 'http://localhost:5432' },
  mg_inst: { engine: 'mongodb', baseUrl: 'mongodb://localhost:27017' },
  bad_inst: { engine: 'unknown', baseUrl: 'xxx' }
}));

// Mock DB and Libraries
jest.mock('../src/config/db', () => ({ pool: { query: jest.fn() } }));
jest.mock('pg', () => {
  const mPool = {
    query: jest.fn(),
    end: jest.fn()
  };
  return { Pool: jest.fn(() => mPool) };
});
jest.mock('mongodb', () => {
  const mCol = {
    find: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    toArray: jest.fn(),
    insertOne: jest.fn(),
    updateOne: jest.fn(),
    deleteMany: jest.fn(),
    aggregate: jest.fn()
  };
  const mDb = { collection: jest.fn(() => mCol) };
  const mClient = {
    connect: jest.fn(),
    db: jest.fn(() => mDb),
    close: jest.fn()
  };
  return { MongoClient: jest.fn(() => mClient) };
});
jest.mock('fs/promises');

describe('Execution Controller - 100% Coverage', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  });

  /* --- EXISTING BASIC COVERAGE --- */
/*
  test('400 invalid request id', async () => {
    await controller.executeRequest({ params: { id: 'NaN' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('404 request not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    await controller.executeRequest({ params: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('400 not approved', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ status: 'PENDING' }] });
    await controller.executeRequest({ params: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('Load script and execute Postgres Script', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'APPROVED', request_type: 'SCRIPT', db_instance: 'pg_inst', file_path: 'test.sql' }] }) // Fetch request
      .mockResolvedValueOnce({ rows: [{ id: 99 }] }); // Insert execution
    
    fs.readFile.mockResolvedValue('SELECT 1');

    await controller.executeRequest({ params: { id: 1 } }, res);
    
    expect(fs.readFile).toHaveBeenCalledWith('test.sql', 'utf-8');
    expect(executePostgresScript).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'SUCCESS' }));
  });

  
  test('Execute Postgres Query successfully', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'APPROVED', request_type: 'QUERY', db_instance: 'pg_inst', db_name: 'testdb', query_text: 'SELECT *' }] })
      .mockResolvedValueOnce({ rows: [{ id: 99 }] });

    const pgPoolInstance = new Pool();
    pgPoolInstance.query.mockResolvedValueOnce({ rowCount: 5, rows: [{ a: 1 }] });

    await controller.executeRequest({ params: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ rowCount: 5 }));
  });

  
  test('Mongo Query: Error on invalid JSON', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'APPROVED', request_type: 'QUERY', db_instance: 'mg_inst', query_text: 'invalid-json' }] })
      .mockResolvedValueOnce({ rows: [{ id: 99 }] });

    await controller.executeRequest({ params: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Mongo query must be valid JSON' }));
  });

  test('Mongo Query: Error on missing collection/operation', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'APPROVED', request_type: 'QUERY', db_instance: 'mg_inst', query_text: '{"db":"test"}' }] })
      .mockResolvedValueOnce({ rows: [{ id: 99 }] });

    await controller.executeRequest({ params: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Mongo query must include collection and operation' }));
  });

  test('Mongo Query: Find with limit (Branch Coverage)', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'APPROVED', request_type: 'QUERY', db_instance: 'mg_inst', query_text: '{"collection":"users","operation":"find","args":{"limit":10}}' }] })
      .mockResolvedValueOnce({ rows: [{ id: 99 }] });

    const client = new MongoClient();
    const col = client.db().collection();
    col.find().toArray.mockResolvedValue([{ name: 'John' }]);

    await controller.executeRequest({ params: { id: 1 } }, res);
    expect(col.limit).toHaveBeenCalledWith(10);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ rowCount: 1 }));
  });

  test('Mongo Query: Unsupported operation', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'APPROVED', request_type: 'QUERY', db_instance: 'mg_inst', query_text: '{"collection":"users","operation":"kaboom"}' }] })
      .mockResolvedValueOnce({ rows: [{ id: 99 }] });

    await controller.executeRequest({ params: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Unsupported Mongo operation: kaboom' }));
  });

  
  test('Mongo Helpers: Test result normalization paths', async () => {
    // We test multiple operations to hit all switch cases in normalizeMongoArgs
    const operations = [
      { op: 'insertOne', args: { document: { id: 1 } }, result: { insertedCount: 1 } },
      { op: 'updateMany', args: { filter: {}, update: {} }, result: { modifiedCount: 2 } },
      { op: 'deleteMany', args: { filter: {} }, result: { deletedCount: 3 } },
      { op: 'aggregate', args: { pipeline: [] }, result: { somethingElse: true } }
    ];

    for (const item of operations) {
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, status: 'APPROVED', request_type: 'QUERY', db_instance: 'mg_inst', query_text: JSON.stringify({ collection: 'c', operation: item.op, args: item.args }) }] })
        .mockResolvedValueOnce({ rows: [{ id: 99 }] });

      const client = new MongoClient();
      const col = client.db().collection();
      col[item.op] = jest.fn().mockResolvedValue(item.result);

      await controller.executeRequest({ params: { id: 1 } }, res);
    }
    expect(res.json).toHaveBeenCalledTimes(4);
  });

  
  test('Throws error for unsupported engine in dispatcher', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'APPROVED', request_type: 'QUERY', db_instance: 'bad_inst' }] })
      .mockResolvedValueOnce({ rows: [{ id: 99 }] });

    await controller.executeRequest({ params: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Unsupported engine: unknown' }));
  });

  test('Mongo Script execution', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'APPROVED', request_type: 'SCRIPT', db_instance: 'mg_inst', file_path: 's.js' }] })
      .mockResolvedValueOnce({ rows: [{ id: 99 }] });
    
    fs.readFile.mockResolvedValue('db.runCommand(...)');
    
    await controller.executeRequest({ params: { id: 1 } }, res);
    expect(executeMongoScript).toHaveBeenCalled();
  });


  test('NormalizeMongoArgs: hit default branch with array and non-array args', async () => {
    // This hits the "default" case in the switch and the ternary (Array.isArray)
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'APPROVED', request_type: 'QUERY', db_instance: 'mg_inst', query_text: JSON.stringify({ collection: 'c', operation: 'customOp', args: { data: 1 } }) }] })
      .mockResolvedValueOnce({ rows: [{ id: 99 }] });

    const client = new MongoClient();
    const col = client.db().collection();
    col.customOp = jest.fn().mockResolvedValue({ someRawData: true });

    await controller.executeRequest({ params: { id: 1 } }, res);
    
    // Also test with array args to hit the other side of the ternary
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'APPROVED', request_type: 'QUERY', db_instance: 'mg_inst', query_text: JSON.stringify({ collection: 'c', operation: 'customOp', args: [1, 2] }) }] })
      .mockResolvedValueOnce({ rows: [{ id: 99 }] });

    await controller.executeRequest({ params: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalled();
  });

  test('NormalizeMongoResult: hit default fallback branch', async () => {
    // This hits the final return { rowCount: 0, rows: [], raw: result }
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'APPROVED', request_type: 'QUERY', db_instance: 'mg_inst', query_text: JSON.stringify({ collection: 'c', operation: 'aggregate', args: { pipeline: [] } }) }] })
      .mockResolvedValueOnce({ rows: [{ id: 99 }] });

    const client = new MongoClient();
    const col = client.db().collection();
    // Return something that has NO count properties
    col.aggregate.mockResolvedValue({ just: 'data' });

    await controller.executeRequest({ params: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ rowCount: 0, raw: { just: 'data' } }));
  });

  test('Controller: Full Error Path (catch block)', async () => {
    // Force an error during dispatchExecution (e.g., DB connection failure)
    pool.query
      .mockResolvedValueOnce({ rows: [{ id: 1, status: 'APPROVED', request_type: 'QUERY', db_instance: 'pg_inst', db_name: 'db', query_text: 'SELECT' }] })
      .mockResolvedValueOnce({ rows: [{ id: 99 }] }); // Execution ID 99

    const pgPoolInstance = new Pool();
    pgPoolInstance.query.mockRejectedValueOnce(new Error('Database Crash'));

    await controller.executeRequest({ params: { id: 1 } }, res);

    // Verify it called the UPDATE with 'FAILED'
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'FAILED'"),
      expect.arrayContaining([99, expect.any(Number), 'Database Crash'])
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'FAILED' }));
  });
  

   */








//new
const fs = require('fs/promises');
const { Pool } = require('pg');
const runUserScript = require('../src/execution/script/vm.runner');
const executePostgresScript = require('../src/execution/postgres/script.executor');

// 1. Mock the File System
jest.mock('fs/promises', () => ({
  readFile: jest.fn()
}));

// 2. Mock Postgres Pool with a query tracker
const mockPoolInstance = {
  query: jest.fn(),
  end: jest.fn().mockResolvedValue()
};
jest.mock('pg', () => ({
  Pool: jest.fn(() => mockPoolInstance)
}));

// 3. Mock the VM Runner
jest.mock('../src/execution/script/vm.runner', () => jest.fn());

describe('executePostgresScript - 100% Coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('hits happy path AND internal db.query logic', async () => {
    // Setup: Script calls db.query()
    fs.readFile.mockResolvedValue('const res = await db.query("SELECT 1");');
    
    // We simulate the VM runner actually calling the 'db' object provided in its context
    runUserScript.mockImplementation(async ({ context }) => {
      // THIS CALLS THE INTERNAL db.query function in your script.executor.js
      return await context.db.query('SELECT 1', [123]);
    });

    // Mock the actual DB response
    mockPoolInstance.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ success: true }] });

    const result = await executePostgresScript(
      { file_path: './script.js', db_name: 'test_db' },
      { baseUrl: 'postgres://localhost:5432' }
    );

    // Verify internal db.query was mapped correctly
    expect(mockPoolInstance.query).toHaveBeenCalledWith('SELECT 1', [123]);
    expect(result).toEqual({ rowCount: 1, rows: [{ success: true }] });
    // Verify cleanup
    expect(mockPoolInstance.end).toHaveBeenCalled();
  });

  test('hits the finally block during a script failure', async () => {
    // Setup: Script that will fail
    fs.readFile.mockResolvedValue('broken code');
    runUserScript.mockRejectedValue(new Error('VM Execution Failed'));

    // Execute and catch error
    await expect(executePostgresScript(
      { file_path: './script.js', db_name: 'test_db' },
      { baseUrl: 'postgres://localhost:5432' }
    )).rejects.toThrow('VM Execution Failed');

    // THIS IS THE KEY: Even if the script fails, the pool must close.
    // Checking this covers the 'finally' branch.
    expect(mockPoolInstance.end).toHaveBeenCalled();
  });
});