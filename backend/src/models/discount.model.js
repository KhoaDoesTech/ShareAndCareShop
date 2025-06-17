'use strict';

const { model, Schema } = require('mongoose');
const { AvailableCouponType, CouponType } = require('../constants/status');

const DOCUMENT_NAME = 'Discount';
const COLLECTION_NAME = 'Discounts';

const discountSchema = new Schema(
  {
    dsc_code: {
      type: String,
      required: true,
      unique: true,
      default: () => `DSC_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    },
    dsc_status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'CANCELLED'],
      default: 'ACTIVE',
    },
    dsc_items: [
      {
        _id: false,
        prd_id: {
          type: Schema.Types.ObjectId,
          ref: 'Product',
          required: true,
        },
        prd_name: { type: String, required: true },
      },
    ],
    dsc_categories: [
      {
        _id: false,
        cat_id: {
          type: Schema.Types.ObjectId,
          ref: 'Category',
          required: true,
        },
        cat_name: { type: String, required: true },
      },
    ],
    dsc_type: {
      type: String,
      enum: AvailableCouponType,
      default: CouponType.AMOUNT, // PERCENT
    },
    dsc_value: { type: Number, default: null },
    dsc_start: { type: Date, default: null },
    dsc_end: { type: Date, default: null },
    dsc_note: { type: String, default: '' },
    dsc_created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    dsc_updated_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

discountSchema.index({ dsc_code: 1 });
discountSchema.index({ dsc_created_by: 1, createdAt: -1 });
discountSchema.index({ 'dsc_items.prd_id': 1 });

module.exports = model(DOCUMENT_NAME, discountSchema);
