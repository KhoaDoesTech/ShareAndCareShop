'use strict';

const { model, Schema } = require('mongoose');

const DOCUMENT_NAME = 'Delivery';
const COLLECTION_NAME = 'Deliverys';

const deliverySchema = new Schema(
  {
    dlv_name: { type: String, required: true, unique: true },
    dlv_price: { type: Number, required: true },
    dlv_estimated_time: { type: String },
    dlv_is_active: { type: Boolean, required: true, default: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

module.exports = model(DOCUMENT_NAME, deliverySchema);
