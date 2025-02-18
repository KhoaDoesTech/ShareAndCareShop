const uploadModels = require('../models/upload.model');
const BaseRepository = require('./base.repository');

class UploadRepository extends BaseRepository {
  constructor() {
    super(uploadModels);
    this.model = uploadModels;
  }

  async deleteOne(query) {
    return this.model.deleteOne(query);
  }

  async deleteMany(query) {
    return this.model.deleteMany(query);
  }

  formatDocument(upload) {
    if (!upload) return null;
    return {
      id: upload._id,
      publicId: upload.upl_public_id,
      url: upload.upl_url,
      expiresAt: upload.upl_expires_at,
      createdAt: upload.createdAt,
      updatedAt: upload.updatedAt,
    };
  }
}

module.exports = UploadRepository;
