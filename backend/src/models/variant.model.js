'use strict';

const { model, Schema } = require('mongoose');
const { ProductStatus } = require('../constants/status');
const VariantHistory = require('./variantHistory.model');

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
    var_status: {
      type: String,
      enum: ProductStatus,
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

variantSchema.post('save', async function (doc) {
  await _saveVariantHistory(doc, 'CREATE');
});

variantSchema.post('findOneAndUpdate', async function (doc) {
  if (doc) await _saveVariantHistory(doc, 'UPDATE');
});

variantSchema.post('findOneAndDelete', async function (doc) {
  if (doc) await _saveVariantHistory(doc, 'DELETE');
});

async function _saveVariantHistory(doc, operation) {
  if (!doc) return;

  await VariantHistory.create({
    _id: doc._id,
    prd_history_id: doc.prd_id,
    var_version: Date.now(),
    var_action: operation,
    var_changed_by: doc.updatedBy,

    prd_name: doc.prd_name,
    var_slug: doc.var_slug,
    var_tier_idx: doc.var_tier_idx,
    var_default: doc.var_default,
    var_price: doc.var_price,
    var_quantity: doc.var_quantity,
    var_sold: doc.var_sold,
    var_status: doc.var_status,
  });
}

module.exports = model(DOCUMENT_NAME, variantSchema);
