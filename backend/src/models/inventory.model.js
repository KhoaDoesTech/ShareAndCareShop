'use strict';

const { model, Schema } = require('mongoose');

const DOCUMENT_NAME = 'Inventory';
const COLLECTION_NAME = 'Inventories';

const inventorySchema = new Schema(
  {
    inv_import_code: {
      type: String,
      required: true,
      unique: true,
      default: () => `IMP_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    },
    inv_items: [
      {
        _id: false,
        prd_id: {
          type: Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        prd_name: { type: String, required: true },
        var_id: {
          type: Schema.Types.ObjectId,
          ref: 'Variant',
          default: null,
        },
        var_slug: { type: String, default: null },
        prd_quantity: { type: Number, required: true, min: 1 },
        prd_import_price: { type: Number, default: 0 },
      },
    ],
    inv_batch_code: { type: String, default: null },
    inv_supplier: { type: String, default: null },
    inv_total_import_price: { type: Number, default: 0 },
    inv_total_quantity: { type: Number, default: 0, min: 0 },
    inv_note: { type: String, default: '' },
    inv_created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    inv_updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

inventorySchema.index({ inv_import_code: 1 });
inventorySchema.index({ inv_created_by: 1, createdAt: -1 });
inventorySchema.index({ 'inv_items.inv_prd_id': 1, 'inv_items.inv_var_id': 1 });

module.exports = model(DOCUMENT_NAME, inventorySchema);
