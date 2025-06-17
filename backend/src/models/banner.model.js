'use strict';

const { model, Schema } = require('mongoose');

const DOCUMENT_NAME = 'Banner';
const COLLECTION_NAME = 'Banners';

const bannerSchema = new Schema(
  {
    bnn_title: { type: String, maxlength: 255 },
    bnn_subtitle: { type: String, maxlength: 500 },
    bnn_cta_text: { type: String, maxlength: 100 },
    bnn_cta_url: { type: String },
    bnn_image_url: { type: String, required: true },
    bnn_public_id: { type: String, required: true },
    bnn_display_order: { type: Number, default: 0, min: 0 },
    bnn_is_active: { type: Boolean, default: true },
    bnn_start_date: { type: Date },
    bnn_end_date: { type: Date },
    bnn_created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bnn_updated_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

// Tạo index để tối ưu truy vấn
bannerSchema.index({ bnn_is_active: 1, bnn_display_order: 1 });
bannerSchema.index({ bnn_start_date: 1, bnn_end_date: 1 });
bannerSchema.index({ bnn_created_by: 1, createdAt: -1 });

module.exports = model(DOCUMENT_NAME, bannerSchema);
