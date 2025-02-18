'use strict';

const { model, Schema } = require('mongoose');
const SERVER_CONFIG = require('../configs/server.config');
const { AvailableActions } = require('../constants/status');

const DOCUMENT_NAME = 'ProductHistory';
const COLLECTION_NAME = 'ProductHistories';

const productHistorySchema = new Schema(
  {
    // Reference to the product
    prd_id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    prd_code: { type: String, required: true, unique: true, trim: true },
    prd_version: { type: Number, required: true, default: () => Date.now() },
    prd_action: { type: String, enum: AvailableActions, required: true },
    prd_changed_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Product details at the time of change
    prd_name: { type: String, required: true },
    prd_slug: { type: String, required: true },
    prd_description: { type: String },
    prd_video: { type: String },

    // Product images
    prd_main_image: {
      type: String,
      required: true,
      default: SERVER_CONFIG.img.product,
    },
    prd_sub_images: { type: Array, default: [] },
    prd_qr_code: { type: String },

    // Product category & attributes
    prd_category: {
      type: [
        {
          id: {
            type: Schema.Types.ObjectId,
            ref: 'Category',
          },
          name: { type: String, required: true },
        },
      ],
      default: [],
    },
    prd_attributes: {
      type: [
        {
          _id: false,
          id: { type: Schema.Types.ObjectId, ref: 'Attribute', required: true },
          values: [
            {
              _id: false,
              id: {
                type: Schema.Types.ObjectId,
                ref: 'AttributeValue',
                required: true,
              },
            },
          ],
        },
      ],
      default: [],
    },

    // Variants snapshot
    prd_variants: {
      type: [
        {
          var_name: { type: String, required: true },
          var_options: { type: Array, required: true },
          var_images: { type: Array, default: [] },
        },
      ],
      default: [],
    },

    // Return policy
    return_days: { type: Number, default: 7 },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

productHistorySchema.index({ prd_id: 1, prd_version: -1 });

//Export the model
module.exports = model(DOCUMENT_NAME, productHistorySchema);
