'use strict';

const { model, Schema } = require('mongoose');
const ProductHistory = require('./productHistory.model');
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
    prd_slug: { type: String, unique: true, trim: true },
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
    prd_original_price: { type: Number },
    prd_min_price: { type: Number },
    prd_max_price: { type: Number },

    // Discount details
    prd_discount_type: {
      type: String,
      enum: AvailableCouponType,
      default: CouponType.AMOUNT, // PERCENT
    },
    prd_discount_value: { type: Number, required: true, default: 0 },
    prd_discount_start: { type: Date },
    prd_discount_end: { type: Date },

    // Stock & sales tracking
    prd_quantity: { type: Number, required: true, default: 0 },
    prd_sold: { type: Number, default: 0 },

    // Return policy
    return_days: { type: Number, default: 7 },

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

productSchema.pre('save', async function (next) {
  if (!this.isModified('prd_name')) return next();

  const baseSlug = slugify(this.prd_name, { lower: true, strict: true });

  const slugRegex = new RegExp(`^${baseSlug}(-\\d+)?$`, 'i');
  const existingSlugs = await model(DOCUMENT_NAME)
    .find({ prd_slug: slugRegex })
    .select('prd_slug');

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

productSchema.post('save', async function (doc) {
  await _saveProductHistory(doc, 'CREATE');
});

productSchema.post('findOneAndUpdate', async function (doc) {
  if (doc) await _saveProductHistory(doc, 'UPDATE');
});

productSchema.post('findOneAndDelete', async function (doc) {
  if (doc) await _saveProductHistory(doc, 'DELETE');
});

async function _saveProductHistory(doc, operation) {
  if (!doc) return;

  await ProductHistory.create({
    prd_id: doc._id,
    prd_code: doc.prd_code,
    prd_version: Date.now(),
    prd_action: operation,
    prd_changed_by: doc.updatedBy,

    prd_name: doc.prd_name,
    prd_slug: doc.prd_slug,
    prd_main_image: doc.prd_main_image,
    prd_sub_images: doc.prd_sub_images,
    prd_qr_code: doc.prd_qr_code,
    prd_video: doc.prd_video,
    prd_description: doc.prd_description,
    prd_category: doc.prd_category,
    prd_attributes: doc.prd_attributes,
    prd_variants: doc.prd_variants,
    return_days: doc.return_days,
  });
}

//Export the model
module.exports = model(DOCUMENT_NAME, productSchema);
