const UploadRepository = require('../repositories/upload.repository');
const { v4: uuidv4 } = require('uuid');
const cloudinary = require('../helpers/cloudinary.helper');
const { removeLocalFile, extractPublicIdFromUrl } = require('../utils/helpers');
const {
  InternalServerError,
  BadRequestError,
} = require('../utils/errorResponse');

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
      await removeLocalFile(file.path);
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
      console.error('Error deleting image:', error);
      throw new InternalServerError('Failed to delete image');
    }
  }

  async deleteExpiredImages() {
    const expiredImages = await this.uploadRepository.getAll({
      filter: { upl_expires_at: { $lt: new Date() } },
    });

    console.log(expiredImages);

    if (expiredImages.length) {
      expiredImages.forEach(async (image) => {
        await this.deleteImageByPublicId(image.publicId);
      });
    }
  }

  async deleteUsedImage(mainImage, subImages) {
    try {
      const imagesToDelete = [];

      if (mainImage) {
        const mainImagePublicId = extractPublicIdFromUrl(mainImage);
        if (mainImagePublicId) imagesToDelete.push(mainImagePublicId);
      }

      if (subImages && Array.isArray(subImages)) {
        subImages.forEach((subImage) => {
          const subImagePublicId = extractPublicIdFromUrl(subImage);
          if (subImagePublicId) imagesToDelete.push(subImagePublicId);
        });
      }

      for (const publicId of imagesToDelete) {
        await this.uploadRepository.deleteOne({ upl_public_id: publicId });
      }

      console.log('All images deleted successfully');
    } catch (error) {
      console.error('Error deleting images:', error);
      throw new InternalServerError('Failed to delete images');
    }
  }
}

module.exports = UploadService;
