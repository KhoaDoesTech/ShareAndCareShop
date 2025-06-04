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
      throw new BadRequestError('Please upload a valid file');
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
      throw new InternalServerError('Failed to upload image');
    } finally {
      removeLocalFile(file.path);
    }
  }

  async uploadChatImage({ file }) {
    if (!file) {
      throw new BadRequestError('Please upload a valid file');
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
      throw new InternalServerError('Failed to upload chat image');
    } finally {
      removeLocalFile(file.path);
    }
  }

  async uploadReviewImage({ file }) {
    if (!file) {
      throw new BadRequestError('Please upload a valid file');
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
      throw new InternalServerError('Failed to upload review image');
    } finally {
      removeLocalFile(file.path);
    }
  }

  async uploadTransferImage({ file }) {
    if (!file) {
      throw new BadRequestError('Please upload a valid file');
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
      throw new InternalServerError('Failed to upload transfer image');
    } finally {
      removeLocalFile(file.path);
    }
  }

  async uploadQRCode({ text, temporary = false }) {
    if (!text) {
      throw new Error('Please provide valid text for QR code');
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
      throw new Error('Failed to upload QR code');
    } finally {
      removeLocalFile(tempPath);
    }
  }

  async deleteImageByUrl(url) {
    try {
      const publicId = extractPublicIdFromUrl(url);

      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      throw new InternalServerError('Failed to delete image');
    }
  }

  async deleteImageByPublicId(publicId) {
    try {
      await cloudinary.uploader.destroy(publicId);

      await this.uploadRepository.deleteOne({ upl_public_id: publicId });
    } catch (error) {
      throw new InternalServerError('Failed to delete image');
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
      throw new InternalServerError('Failed to delete images');
    }
  }
}

module.exports = UploadService;
