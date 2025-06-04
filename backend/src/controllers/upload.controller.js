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

  uploadChatImage = async (req, res, next) => {
    new CreateSuccess({
      message: 'Chat image uploaded successfully',
      metadata: await this.uploadService.uploadChatImage({ file: req.file }),
    }).send(res);
  };

  uploadReviewImage = async (req, res, next) => {
    new CreateSuccess({
      message: 'Review image uploaded successfully',
      metadata: await this.uploadService.uploadReviewImage({ file: req.file }),
    }).send(res);
  };

  uploadTransferImage = async (req, res, next) => {
    new CreateSuccess({
      message: 'Transfer image uploaded successfully',
      metadata: await this.uploadService.uploadTransferImage({
        file: req.file,
      }),
    }).send(res);
  };

  deleteImageByUrl = async (req, res, next) => {
    await this.uploadService.deleteImageByUrl(req.body.url);
    new NoContentSuccess({
      message: 'Image deleted successfully',
    }).send(res);
  };
}

module.exports = new UploadController();
