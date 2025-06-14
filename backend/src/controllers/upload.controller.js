const UploadService = require('../services/upload.service');
const { CreateSuccess, NoContentSuccess } = require('../utils/successResponse');

class UploadController {
  constructor() {
    this.uploadService = new UploadService();
  }

  uploadProductImage = async (req, res, next) => {
    new CreateSuccess({
      message: 'Tải ảnh sản phẩm thành công',
      metadata: await this.uploadService.uploadProductImage({
        file: req.file,
        temporary: true,
      }),
    }).send(res);
  };

  uploadChatImage = async (req, res, next) => {
    new CreateSuccess({
      message: 'Tải ảnh chat thành công',
      metadata: await this.uploadService.uploadChatImage({ file: req.file }),
    }).send(res);
  };

  uploadReviewImage = async (req, res, next) => {
    new CreateSuccess({
      message: 'Tải ảnh đánh giá thành công',
      metadata: await this.uploadService.uploadReviewImage({ file: req.file }),
    }).send(res);
  };

  uploadTransferImage = async (req, res, next) => {
    new CreateSuccess({
      message: 'Tải ảnh chuyển khoản thành công',
      metadata: await this.uploadService.uploadTransferImage({
        file: req.file,
      }),
    }).send(res);
  };

  deleteImageByUrl = async (req, res, next) => {
    await this.uploadService.deleteImageByUrl(req.body.url);
    new NoContentSuccess({
      message: 'Xóa ảnh thành công',
    }).send(res);
  };
}

module.exports = new UploadController();
