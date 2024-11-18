const multer = require('multer');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/images');
  },

  // Store file in a .png/.jpeg/.jpg format instead of binary
  filename: function (req, file, cb) {
    let fileExtension = '';
    if (file.originalname.split('.').length > 1) {
      fileExtension = file.originalname.substring(
        file.originalname.lastIndexOf('.')
      );
    }
    const filenameWithoutExtension = file.originalname
      .toLowerCase()
      .split(' ')
      .join('-')
      ?.split('.')[0];
    cb(
      null,
      filenameWithoutExtension +
        Date.now() +
        Math.ceil(Math.random() * 1e5) + // avoid rare name conflict
        fileExtension
    );
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024,
  },
});

module.exports = upload;
