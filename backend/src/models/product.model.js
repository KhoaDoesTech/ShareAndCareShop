'use strict';

const { model, Schema } = require('mongoose');
const slugify = require('slugify');
const SERVER_CONFIG = require('../configs/server.config');
const {
  AvailableProductStatus,
  ProductStatus,
} = require('../constants/status');

const DOCUMENT_NAME = 'Product';
const COLLECTION_NAME = 'Products';

const productSchema = new Schema(
  {
    prd_name: { type: String, required: true },
    prd_slug: { type: String },
    prd_main_image: {
      type: String,
      required: true,
      default: SERVER_CONFIG.img.product,
    },
    prd_sub_images: { type: Array, default: [] },
    prd_price: { type: Number, required: true },
    prd_quantity: { type: Number, required: true },
    prd_sold: { type: Number, default: 0 },
    prd_description: { type: String },
    prd_category: {
      type: Array,
      default: [],
    },
    prd_attributes: { type: Array, default: [] },
    prd_status: {
      type: String,
      enum: AvailableProductStatus,
      default: ProductStatus.DRAFT,
    },
    prd_variants: {
      type: [
        {
          var_images: { type: Array, default: [] },
          var_name: { type: String, required: true },
          var_options: { type: Array, required: true },
        },
      ],
      default: [],
    },
    prd_rating: { type: Number, required: true, default: 0 },
    prd_views: { type: Number, default: 0 },
    prd_unique_views: { type: Array, default: [] },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

// create index for search
productSchema.index({
  prd_name: 'text',
  prd_description: 'text',
  prd_slug: 'text',
});

// Document middleware: runs before save() and create()
productSchema.pre('save', function (next) {
  this.prd_slug = slugify(this.prd_name, { lower: true });
  next();
});

//Export the model
module.exports = model(DOCUMENT_NAME, productSchema);
