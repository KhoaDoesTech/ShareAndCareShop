'use strict';

const { model, Schema } = require('mongoose');
const {
  ProductStatus,
  AvailableProductStatus,
} = require('../constants/status');

const DOCUMENT_NAME = 'Variant';
const COLLECTION_NAME = 'Variants';

const variantSchema = new Schema(
  {
    prd_id: { type: Schema.Types.ObjectId, ref: 'Product' },
    prd_name: { type: String, required: true },
    var_slug: { type: String, default: '' },
    var_tier_idx: { type: Array, default: [0] },
    var_default: { type: Boolean, default: false },
    var_price: { type: Number, required: true },
    var_quantity: { type: Number, required: true, default: 0 },
    var_sold: { type: Number, default: 0 },
    var_returned: { type: Number, default: 0 },
    var_status: {
      type: String,
      enum: AvailableProductStatus,
      default: ProductStatus.DRAFT,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

module.exports = model(DOCUMENT_NAME, variantSchema);
