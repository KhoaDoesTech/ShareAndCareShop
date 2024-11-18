const cron = require('node-cron');
const UploadService = require('../services/upload.service');
const logger = require('../helpers/logger.helper');

const cleanTemporaryImages = cron.schedule('0 0 * * *', () => {
  logger.info(`Starting cleanup of temporary images.`);
  try {
    const uploadService = new UploadService();
    uploadService.deleteExpiredImages();

    logger.info(`Temporary images cleaned successfully.`);
  } catch (error) {
    logger.error(`Error cleaning temporary images:`, error);
  }
});

module.exports = cleanTemporaryImages;
