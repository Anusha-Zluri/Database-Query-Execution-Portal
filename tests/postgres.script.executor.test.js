const fs = require('fs/promises');
const { Pool } = require('pg');
const runUserScript = require('../src/execution/script/vm.runner');
const executePostgresScript = require('../src/execution/postgres/script.executor');

jest.mock('fs/promises', () => ({
  readFile: jest.fn()
}));

jest.mock('pg', () => {
  const mPool = {
    query: jest.fn(),
    end: jest.fn().mockResolvedValue()
  };
  return {
    Pool: jest.fn(() => mPool)
  };
});

jest.mock('../src/execution/script/vm.runner', () => jest.fn());

describe('executePostgresScript', () => {
  let mockPool;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = new Pool();
  });

  test('executes script and hits internal db.query branch', async () => {
    // 1. Setup mocks
    fs.readFile.mockResolvedValue('await db.query("SELECT 1")');
    
    // We simulate the VM runner actually calling the 'db' object provided in context
    runUserScript.mockImplementation(async ({ context }) => {
      return await context.db.query('SELECT 1', []);
    });

    mockPool.query.mockResolvedValueOnce({ rowCount: 1, rows: [{ col: 1 }] });

    // 2. Execute
    const result = await executePostgresScript(
      { file_path: './test.sql', db_name: 'my_db' },
      { baseUrl: 'postgres://localhost:5432' }
    );

    // 3. Assertions
    expect(mockPool.query).toHaveBeenCalledWith('SELECT 1', []);
    expect(result).toEqual({ rowCount: 1, rows: [{ col: 1 }] });
    expect(mockPool.end).toHaveBeenCalled(); // Ensures finally block is covered
  });

  test('ensures pool.end() is called even if script fails', async () => {
    fs.readFile.mockResolvedValue('syntax error');
    runUserScript.mockRejectedValue(new Error('VM Crash'));

    await expect(executePostgresScript(
      { file_path: './test.sql', db_name: 'my_db' },
      { baseUrl: 'postgres://localhost:5432' }
    )).rejects.toThrow('VM Crash');

    // This specifically covers the 'finally' branch during an error state
    expect(mockPool.end).toHaveBeenCalled();
  });
});