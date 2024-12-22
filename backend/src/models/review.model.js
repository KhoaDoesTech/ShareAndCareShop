'use strict';

const { model, Schema } = require('mongoose');

const DOCUMENT_NAME = 'Review';
const COLLECTION_NAME = 'Reviews';

const reviewSchema = new Schema(
  {
    rvw_content: { type: String, required: true },
    rvw_star: { type: Number, required: true, min: 1, max: 5 },
    rvw_user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    rvw_product_id: { type: Schema.Types.ObjectId, ref: 'Product' },
    rvw_reply: {
      type: {
        rep_content: String,
        rep_user: { type: Schema.Types.ObjectId, ref: 'User' },
        createdAt: Date,
      },
      default: null,
    },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

module.exports = model(DOCUMENT_NAME, reviewSchema);
