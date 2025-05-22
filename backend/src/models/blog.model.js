const { model, Schema } = require('mongoose');
const { AvailableBlogStatus, BlogStatus } = require('../constants/status');

const DOCUMENT_NAME = 'Blog';
const COLLECTION_NAME = 'Blogs';

const blogSchema = new Schema(
  {
    title: { type: String },
    status: {
      type: String,
      require: true,
      enum: AvailableBlogStatus,
      default: BlogStatus.INACTIVE,
    },
    content: {
      type: String,
    },
    type: {
      type: String,
    },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: {
      createdAt: 'createdOn',
      updatedAt: 'modifiedOn',
    },
  }
);

module.exports = model(DOCUMENT_NAME, blogSchema);
