'use strict';

const { model, Schema } = require('mongoose');
const { AvailableCouponType, CouponType } = require('../constants/status');

const DOCUMENT_NAME = 'Coupon';
const COLLECTION_NAME = 'Coupons';

const couponSchema = new Schema(
  {
    cpn_name: { type: String, required: true },
    cpn_code: { type: String, required: true, unique: true },
    cpn_description: { type: String, required: true },
    cpn_start_date: { type: Date, required: true },
    cpn_end_date: { type: Date, required: true },
    cpn_type: {
      type: String,
      enum: AvailableCouponType,
      default: CouponType.AMOUNT,
    },
    cpn_value: { type: Number, required: true },
    cpn_min_order_values: { type: Number, require: true },
    cpn_max_value: { type: Number, require: true },
    cpn_max_uses: { type: Number, require: true },
    cpn_max_uses_per_user: { type: Number, require: true },
    cpn_applies_to: {
      type: String,
      require: true,
      enum: ['All', 'Specific'],
    },
    cpn_product_ids: {
      type: [Schema.Types.ObjectId],
      ref: 'Product',
      default: [],
    },
    cpn_category_ids: {
      type: [Schema.Types.ObjectId],
      ref: 'Category',
      default: [],
    },
    cpn_uses_count: { type: Number, default: 0 },
    cpn_users_used: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    cpn_is_active: { type: Boolean, default: true },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

module.exports = model(DOCUMENT_NAME, couponSchema);
