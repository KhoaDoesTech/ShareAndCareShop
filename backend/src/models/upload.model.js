'use strict';

const { model, Schema } = require('mongoose');

const DOCUMENT_NAME = 'Upload';
const COLLECTION_NAME = 'Uploads';

const uploadSchema = new Schema(
  {
    upl_public_id: { type: String, required: true },
    upl_url: { type: String, required: true },
    upl_expires_at: {
      type: Date,
      default: () => {
        const now = new Date();
        now.setHours(now.getHours() + 1);
        return now;
      },
    },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

module.exports = model(DOCUMENT_NAME, uploadSchema);
