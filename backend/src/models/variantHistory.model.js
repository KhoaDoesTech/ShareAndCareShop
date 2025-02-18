'use strict';

const { model, Schema } = require('mongoose');
const { ProductStatus, AvailableActions } = require('../constants/status');

const DOCUMENT_NAME = 'VariantHistory';
const COLLECTION_NAME = 'VariantHistorys';

const variantSchema = new Schema(
  {
    prd_history_id: {
      type: Schema.Types.ObjectId,
      ref: 'ProductHistory',
      required: true,
    },
    var_version: { type: Number, required: true, default: () => Date.now() },
    var_action: { type: String, enum: AvailableActions, required: true },
    var_changed_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    prd_name: { type: String, required: true },
    var_slug: { type: String, default: '' },
    var_tier_idx: { type: Array, default: [0] },
    var_default: { type: Boolean, default: false },
    var_price: { type: Number, required: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

module.exports = model(DOCUMENT_NAME, variantSchema);
