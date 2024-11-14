'use strict';

const { model, Schema } = require('mongoose');
const { ProductStatus } = require('../constants/status');

const DOCUMENT_NAME = 'Variant';
const COLLECTION_NAME = 'Variants';

const variantSchema = new Schema(
  {
    product_id: { type: Schema.Types.ObjectId, ref: 'Product' },
    product_name: { type: String, required: true },
    variant_slug: { type: String, default: '' },
    variant_tier_idx: { type: Array, default: [0] },
    variant_default: { type: Boolean, default: false },
    variant_price: { type: Number, required: true },
    variant_quantity: { type: Number, required: true, default: 0 },
    variant_sold: { type: Number, default: 0 },
    variant_status: {
      type: String,
      enum: ProductStatus,
      default: ProductStatus.DRAFT,
    },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

module.exports = model(DOCUMENT_NAME, variantSchema);
