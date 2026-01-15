const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: 'uploads/scripts/',
  filename: (req, file, cb) => {
    const unique =
      Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '.js');
  }
});

const uploadScript = multer({
  storage,
  limits: {
    
    // file size 16MB supports large enterprise scripts
    
    fileSize: 16 * 1024 * 1024
  },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;

    // Accept .js extension with various MIME types
    const validMimeTypes = [
      'application/javascript',
      'text/javascript',
      'application/x-javascript',
      'application/octet-stream'
    ];

    if (ext !== '.js') {
      return cb(
        new Error('Only JavaScript (.js) files allowed')
      );
    }

    if (!validMimeTypes.includes(mime)) {
      return cb(
        new Error('Invalid file type. Only JavaScript files allowed.')
      );
    }

    cb(null, true);
  }
});

module.exports = uploadScript;
