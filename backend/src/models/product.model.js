'use strict';

const { model, Schema } = require('mongoose');
const slugify = require('slugify');
const SERVER_CONFIG = require('../configs/server.config');
const {
  AvailableProductStatus,
  ProductStatus,
  CouponType,
  AvailableCouponType,
} = require('../constants/status');

const DOCUMENT_NAME = 'Product';
const COLLECTION_NAME = 'Products';

const productSchema = new Schema(
  {
    // Basic product information
    prd_code: { type: String, required: true, unique: true, trim: true },
    prd_name: { type: String, required: true },
    prd_slug: { type: String, unique: true, trim: true, default: '' },
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
          _id: false,
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

    // Product pricing
    prd_original_price: { type: Number, default: 0 },
    prd_min_price: { type: Number, default: 0 },
    prd_max_price: { type: Number, default: 0 },

    // Discount details
    prd_discount_type: {
      type: String,
      enum: AvailableCouponType,
      default: CouponType.AMOUNT, // PERCENT
    },
    prd_discount_value: { type: Number, required: true, default: 0 },
    prd_discount_start: { type: Date, default: null },
    prd_discount_end: { type: Date, default: null },

    // Stock & sales tracking
    prd_quantity: { type: Number, required: true, default: 0 },
    prd_sold: { type: Number, default: 0 },
    prd_returned: { type: Number, default: 0 },
    // Return policy
    prd_return_days: { type: Number, default: 7 },

    // Product status
    prd_status: {
      type: String,
      enum: AvailableProductStatus,
      default: ProductStatus.DRAFT,
    },

    // Variants
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

    // Analytics
    prd_rating: { type: Number, required: true, default: 0 },
    prd_rating_count: { type: Number, required: true, default: 0 },
    prd_views: { type: Number, default: 0 },
    prd_unique_views: { type: Array, default: [] },

    // User tracking
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

// create index for search
productSchema.index({
  prd_id: 'text',
  prd_name: 'text',
  prd_description: 'text',
  prd_slug: 'text',
});

// Index for attribute filtering
productSchema.index({
  'prd_attributes.id': 1,
  'prd_attributes.values.id': 1,
});

productSchema.pre('save', async function (next) {
  if (!this.isModified('prd_name')) return next();

  const baseSlug = slugify(this.prd_name, { lower: true, strict: true });
  const slugRegex = new RegExp(`^${baseSlug}(-\\d+)?$`, 'i');
  const existingSlugs = await this.model(DOCUMENT_NAME)
    .find({ prd_slug: slugRegex })
    .select('prd_slug')
    .lean();

  if (existingSlugs.length === 0) {
    this.prd_slug = baseSlug;
  } else {
    const slugNumbers = existingSlugs.map((doc) => {
      const match = doc.prd_slug.match(/-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const maxNumber = Math.max(...slugNumbers);
    this.prd_slug = `${baseSlug}-${maxNumber + 1}`;
  }
  next();
});

//Export the model
module.exports = model(DOCUMENT_NAME, productSchema);
