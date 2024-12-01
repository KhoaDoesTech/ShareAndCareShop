'use strict';

const { model, Schema } = require('mongoose');

const DOCUMENT_NAME = 'Delivery';
const COLLECTION_NAME = 'Deliverys';

const deliverySchema = new Schema(
  {
    dlv_name: { type: String, required: true, unique: true },
    dlv_description: { type: String, required: true },
    dlv_max_distance: { type: Number, required: true },
    dlv_base_fee: { type: Number, required: true },
    dlv_pricing: {
      type: [
        {
          threshold: { type: Number, required: true },
          fee_per_km: { type: Number, required: true },
        },
      ],
      default: [],
    },
    dlv_is_active: { type: Boolean, required: true, default: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

module.exports = model(DOCUMENT_NAME, deliverySchema);
