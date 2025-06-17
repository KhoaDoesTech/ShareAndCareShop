const UploadRepository = require('../repositories/upload.repository');
const { v4: uuidv4 } = require('uuid');
const cloudinary = require('../helpers/cloudinary.helper');
const { removeLocalFile, extractPublicIdFromUrl } = require('../utils/helpers');
const {
  InternalServerError,
  BadRequestError,
} = require('../utils/errorResponse');
const QRCode = require('qrcode');

class UploadService {
  constructor() {
    this.uploadRepository = new UploadRepository();
  }

  async uploadProductImage({ file, temporary = true }) {
    if (!file) {
      throw new BadRequestError('Vui lòng tải lên tệp hợp lệ');
    }

    try {
      const uniqueFileName = `${uuidv4()}`;

      const result = await cloudinary.uploader.upload(file.path, {
        public_id: uniqueFileName,
        folder: `shareandcare/products`,
        transformation: [
          { width: 750, height: 1000, crop: 'fill' },
          { quality: 'auto:good', fetch_format: 'auto' },
        ],
      });

      if (temporary) {
        await this.uploadRepository.create({
          upl_public_id: result.public_id,
          upl_url: result.secure_url,
        });
      }

      return result.secure_url;
    } catch (error) {
      throw new InternalServerError('Tải ảnh thất bại');
    } finally {
      removeLocalFile(file.path);
    }
  }

  async uploadBannerImage({ file, temporary = true }) {
    if (!file) {
      throw new BadRequestError('Vui lòng tải lên tệp hợp lệ');
    }

    try {
      const uniqueFileName = `${uuidv4()}`;
      const result = await cloudinary.uploader.upload(file.path, {
        public_id: uniqueFileName,
        folder: `shareandcare/banners`,
        transformation: [
          { width: 1920, height: 600, crop: 'fill' },
          { quality: 'auto:good', fetch_format: 'auto' },
        ],
      });

      if (temporary) {
        await this.uploadRepository.create({
          upl_public_id: result.public_id,
          upl_url: result.secure_url,
        });
      }

      return result.secure_url;
    } catch (error) {
      throw new InternalServerError('Tải ảnh banner thất bại');
    } finally {
      removeLocalFile(file.path);
    }
  }

  async uploadChatImage({ file }) {
    if (!file) {
      throw new BadRequestError('Vui lòng tải lên tệp hợp lệ');
    }

    try {
      const uniqueFileName = `${uuidv4()}`;
      const result = await cloudinary.uploader.upload(file.path, {
        public_id: uniqueFileName,
        folder: `shareandcare/chat`,
        transformation: [
          { width: 750, height: 1000, crop: 'fill' },
          { quality: 'auto:good', fetch_format: 'auto' },
        ],
        resource_type: 'image',
      });

      return result.secure_url;
    } catch (error) {
      throw new InternalServerError('Tải ảnh chat thất bại');
    } finally {
      removeLocalFile(file.path);
    }
  }

  async uploadReviewImage({ file }) {
    if (!file) {
      throw new BadRequestError('Vui lòng tải lên tệp hợp lệ');
    }

    try {
      const uniqueFileName = `${uuidv4()}`;
      const result = await cloudinary.uploader.upload(file.path, {
        public_id: uniqueFileName,
        folder: `shareandcare/reviews`,
        transformation: [
          { width: 750, height: 750, crop: 'fill' },
          { quality: 'auto:good', fetch_format: 'auto' },
        ],
        resource_type: 'image',
      });

      return result.secure_url;
    } catch (error) {
      throw new InternalServerError('Tải ảnh đánh giá thất bại');
    } finally {
      removeLocalFile(file.path);
    }
  }

  async uploadTransferImage({ file }) {
    if (!file) {
      throw new BadRequestError('Vui lòng tải lên tệp hợp lệ');
    }

    try {
      const uniqueFileName = `${uuidv4()}`;
      const result = await cloudinary.uploader.upload(file.path, {
        public_id: uniqueFileName,
        folder: `shareandcare/transfers`,
        transformation: [
          { width: 1000, height: 1000, crop: 'fill' },
          { quality: 'auto:good', fetch_format: 'auto' },
        ],
        resource_type: 'image',
      });

      return result.secure_url;
    } catch (error) {
      throw new InternalServerError('Tải ảnh chuyển khoản thất bại');
    } finally {
      removeLocalFile(file.path);
    }
  }

  async uploadQRCode({ text, temporary = false }) {
    if (!text) {
      throw new Error('Vui lòng cung cấp nội dung hợp lệ cho mã QR');
    }

    const uniqueFileName = `${uuidv4()}`;
    const tempPath = `./temp_qr_${uniqueFileName}.png`;

    try {
      await QRCode.toFile(tempPath, text, { width: 1000, height: 1000 });

      const result = await cloudinary.uploader.upload(tempPath, {
        public_id: uniqueFileName,
        folder: `shareandcare/qrcodes`,
        transformation: [
          { width: 1000, height: 1000, crop: 'fill' },
          { quality: 'auto:good', fetch_format: 'auto' },
        ],
      });

      if (temporary) {
        await this.uploadRepository.create({
          upl_public_id: result.public_id,
          upl_url: result.secure_url,
        });
      }

      return result.secure_url;
    } catch (error) {
      throw new Error('Tải mã QR thất bại');
    } finally {
      removeLocalFile(tempPath);
    }
  }

  async deleteImageByUrl(url) {
    try {
      const publicId = extractPublicIdFromUrl(url);

      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      throw new InternalServerError('Xóa ảnh thất bại');
    }
  }

  async deleteImageByPublicId(publicId) {
    try {
      await cloudinary.uploader.destroy(publicId);

      await this.uploadRepository.deleteOne({ upl_public_id: publicId });
    } catch (error) {
      throw new InternalServerError('Xóa ảnh thất bại');
    }
  }

  async deleteExpiredImages() {
    const expiredImages = await this.uploadRepository.getAll({
      filter: { upl_expires_at: { $lt: new Date() } },
    });

    if (expiredImages.length) {
      expiredImages.forEach(async (image) => {
        await this.deleteImageByPublicId(image.publicId);
      });
    }
  }

  async deleteUsedImages(imageUrls = []) {
    try {
      if (!Array.isArray(imageUrls) || imageUrls.length === 0) return;

      const imagesToDelete = imageUrls
        .map(extractPublicIdFromUrl)
        .filter(Boolean);

      if (imagesToDelete.length === 0) return;

      await this.uploadRepository.deleteMany({
        upl_public_id: { $in: imagesToDelete },
      });
    } catch (error) {
      throw new InternalServerError('Xóa nhiều ảnh thất bại');
    }
  }
}

module.exports = UploadService;
