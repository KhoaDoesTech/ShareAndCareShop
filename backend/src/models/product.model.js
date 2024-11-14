'use strict';

const { Schema, model } = require('mongoose');
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
    product_name: { type: String, required: true },
    product_slug: { type: String },
    product_main_image: {
      type: String,
      required: true,
      default: SERVER_CONFIG.img.product,
    },
    product_sub_images: { type: Array, default: [] },
    product_price: { type: Number, required: true },
    product_quantity: { type: Number, required: true },
    product_sold: { type: Number, default: 0 },
    product_description: { type: String },
    product_category: {
      type: Array,
      default: [],
    },
    product_attributes: { type: Array, default: [] },
    product_status: {
      type: String,
      enum: AvailableProductStatus,
      default: ProductStatus.DRAFT,
    },
    product_variants: {
      type: [
        {
          variant_images: { type: Array, default: [] },
          variant_name: { type: String, required: true },
          variant_options: { type: Array, required: true },
        },
      ],
      default: [],
    },
    product_rating: { type: Number, required: true, default: 0 },
    product_views: { type: Number, default: 0 },
    product_unique_views: { type: Array, default: [] },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

// create index for search
productSchema.index({
  product_name: 'text',
  product_description: 'text',
  product_slug: 'text',
  product_category: 'text',
});

// Document middleware: runs before save() and create()
productSchema.pre('save', function (next) {
  this.product_slug = slugify(this.product_name, { lower: true });
  next();
});

//Export the model
module.exports = model(DOCUMENT_NAME, productSchema);
