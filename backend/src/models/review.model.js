// review.model.js
'use strict';

const { model, Schema } = require('mongoose');

const DOCUMENT_NAME = 'Review';
const COLLECTION_NAME = 'Reviews';

const reviewSchema = new Schema(
  {
    rvw_content: { type: String, required: true },
    rvw_star: { type: Number, required: true, min: 1, max: 5 },
    rvw_user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    rvw_order_id: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    rvw_product_id: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    rvw_variant_id: { type: Schema.Types.ObjectId, ref: 'Variant' },
    rvw_images: { type: [String], default: [] },
    rvw_reports: {
      type: [
        {
          _id: false,
          user_id: { type: Schema.Types.ObjectId, ref: 'User' },
          reason: { type: String, required: true },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    rvw_is_hidden: { type: Boolean, default: false },
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

reviewSchema.index({ rvw_user_id: 1, rvw_product_id: 1 });
reviewSchema.index({ rvw_order_id: 1 });
reviewSchema.index({ rvw_product_id: 1, rvw_variant_id: 1, rvw_is_hidden: 1 });

module.exports = model(DOCUMENT_NAME, reviewSchema);
