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
    
    // file size 500KB supports large enterprise scripts
    
    fileSize: 500 * 1024
  },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const mime = file.mimetype;

    // Double validation (extension + MIME)
    if (
      ext !== '.js' ||
      mime !== 'application/javascript'
    ) {
      return cb(
        new Error('Only JavaScript (.js) files allowed')
      );
    }

    cb(null, true);
  }
});

module.exports = uploadScript;
