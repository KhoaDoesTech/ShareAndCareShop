const UploadService = require('../services/upload.service');
const { CreateSuccess, NoContentSuccess } = require('../utils/successResponse');

class UploadController {
  constructor() {
    this.uploadService = new UploadService();
  }

  uploadProductImage = async (req, res, next) => {
    new CreateSuccess({
      message: 'Image uploaded successfully',
      metadata: await this.uploadService.uploadProductImage({
        file: req.file,
        temporary: true,
      }),
    }).send(res);
  };

  uploadChatImages = async (req, res, next) => {
    new CreateSuccess({
      message: 'Images uploaded successfully',
      metadata: await this.uploadService.uploadChatImages({
        files: req.files,
      }),
    }).send(res);
  };

  deleteImageByUrl = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Image deleted successfully',
      metadata: await this.uploadService.deleteImageByUrl(req.body.url),
    }).send(res);
  };
}

module.exports = new UploadController();
