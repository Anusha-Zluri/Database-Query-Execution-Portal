/*jest.mock('fs/promises', () => ({
  readFile: jest.fn()
}));

jest.mock('mongodb', () => {
  const mDb = { collection: jest.fn(() => ({})) };
  const mClient = {
    connect: jest.fn(),
    close: jest.fn(),
    db: jest.fn(() => mDb)
  };
  return {
    MongoClient: jest.fn(() => mClient)
  };
});

jest.mock('../src/execution/script/vm.runner', () => jest.fn());

const fs = require('fs/promises');
const runUserScript = require('../src/execution/script/vm.runner');
const executeMongoScript = require('../src/execution/mongodb/script.executor');

test('executes mongo script via vm runner', async () => {
  fs.readFile.mockResolvedValue('return 1;');
  runUserScript.mockResolvedValue({ ok: true });

  const result = await executeMongoScript(
    { file_path: './x.js', db_name: 'test' },
    { baseUrl: 'mongodb://localhost' }
  );

  expect(runUserScript).toHaveBeenCalled();
  expect(result).toEqual({ ok: true });
});

*/

//gemini :
const fs = require('fs/promises');
const { MongoClient } = require('mongodb');
const runUserScript = require('../src/execution/script/vm.runner');
const executeMongoScript = require('../src/execution/mongodb/script.executor');

jest.mock('fs/promises', () => ({
  readFile: jest.fn()
}));

jest.mock('mongodb', () => {
  const mCol = {
    find: jest.fn().mockReturnValue({
      toArray: jest.fn().mockResolvedValue([{ id: 1 }])
    }),
    insertOne: jest.fn().mockResolvedValue({ insertedId: 1 })
  };

  const mDb = {
    collection: jest.fn(() => mCol)
  };

  const mClient = {
    connect: jest.fn(),
    close: jest.fn(),
    db: jest.fn(() => mDb)
  };

  return {
    MongoClient: jest.fn(() => mClient)
  };
});

jest.mock('../src/execution/script/vm.runner', () => jest.fn());

describe('executeMongoScript coverage', () => {
  let mockClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = new MongoClient();
  });

  test('executes with explicit db_name and triggers Proxy find', async () => {
    fs.readFile.mockResolvedValue('mongo.find("users", {})');
    runUserScript.mockImplementation(async ({ context }) => {
      // Manually trigger the Proxy 'find' operation to cover that branch
      return await context.mongo.find('users', { name: 'test' });
    });

    const result = await executeMongoScript(
      { file_path: './test.js', db_name: 'prod_db' },
      { baseUrl: 'mongodb://localhost' }
    );

    expect(mockClient.db).toHaveBeenCalledWith('prod_db');
    expect(result).toEqual([{ id: 1 }]); // Result from the mocked toArray
  });

  test('uses default db_name (sample_mflix) when db_name is missing', async () => {
    fs.readFile.mockResolvedValue('return 1;');
    runUserScript.mockResolvedValue(1);

    await executeMongoScript(
      { file_path: './test.js' }, // Missing db_name
      { baseUrl: 'mongodb://localhost' }
    );

    expect(mockClient.db).toHaveBeenCalledWith('sample_mflix');
  });

  test('triggers Proxy generic operation (non-find)', async () => {
    fs.readFile.mockResolvedValue('mongo.insertOne("users", { id: 1 })');
    runUserScript.mockImplementation(async ({ context }) => {
      // Trigger a generic operation (like insertOne) to cover the Proxy 'else' branch
      return await context.mongo.insertOne('users', { id: 1 });
    });

    const result = await executeMongoScript(
      { file_path: './test.js' },
      { baseUrl: 'mongodb://localhost' }
    );

    expect(result).toEqual({ insertedId: 1 });
  });

  test('throws error if database driver fails to initialize collection method', async () => {
    // Force db.collection to be undefined to trigger the error branch
    mockClient.db.mockReturnValueOnce({ collection: undefined });
    fs.readFile.mockResolvedValue('return 1;');

    await expect(executeMongoScript(
      { file_path: './test.js', db_name: 'fail_db' },
      { baseUrl: 'mongodb://localhost' }
    )).rejects.toThrow('Connection to database "fail_db" failed to initialize collection driver.');
    
    // Ensure the client still closes even on error (covers finally block)
    expect(mockClient.close).toHaveBeenCalled();
  });
});
