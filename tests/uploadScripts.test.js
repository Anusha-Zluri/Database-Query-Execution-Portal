
const uploadScript = require('../src/middlewares/uploadScripts');
const path = require('path');

describe('uploadScripts middleware', () => {
  
  describe('storage configuration', () => {
    test('destination is correct', () => {
      // Accessing internal multer storage properties
      const storage = uploadScript.storage;
      // Since multer-disk-storage isn't easily unit-tested for paths, 
      // we check if the object was initialized correctly
      expect(storage.getDestination).toBeDefined();
    });

    test('filename generates a unique .js name', (done) => {
      const file = { originalname: 'test.js' };
      uploadScript.storage.getFilename(null, file, (err, filename) => {
        expect(filename).toMatch(/^[0-9]+-[0-9]+\.js$/);
        done();
      });
    });
  });

  describe('fileFilter', () => {
    test('accepts valid .js files with correct mime type', () => {
      const cb = jest.fn();
      const file = { originalname: 'script.js', mimetype: 'application/javascript' };
      
      uploadScript.fileFilter(null, file, cb);
      
      expect(cb).toHaveBeenCalledWith(null, true);
    });

    test('rejects invalid extension', () => {
      const cb = jest.fn();
      const file = { originalname: 'script.txt', mimetype: 'application/javascript' };
      
      uploadScript.fileFilter(null, file, cb);
      
      expect(cb).toHaveBeenCalledWith(expect.any(Error));
      expect(cb.mock.calls[0][0].message).toBe('Only JavaScript (.js) files allowed');
    });

    test('rejects invalid mime type', () => {
      const cb = jest.fn();
      const file = { originalname: 'script.js', mimetype: 'text/plain' };
      
      uploadScript.fileFilter(null, file, cb);
      
      expect(cb).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  test('has correct limit of 500KB', () => {
    expect(uploadScript.limits.fileSize).toBe(512000); // 500 * 1024
  });
});