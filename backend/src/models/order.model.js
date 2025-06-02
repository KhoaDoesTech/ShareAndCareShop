'use strict';

const { model, Schema } = require('mongoose');
const {
  AvailablePaymentMethod,
  PaymentMethod,
  AvailablePaymentStatuses,
  PaymentStatus,
  AvailableOrderStatus,
  OrderStatus,
  AvailableReturnReasons,
} = require('../constants/status');

const DOCUMENT_NAME = 'Order';
const COLLECTION_NAME = 'Orders';

const orderSchema = new Schema(
  {
    ord_user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    ord_coupon_code: { type: String, default: null },
    ord_items: {
      type: [
        {
          prd_id: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true,
          },
          var_id: { type: Schema.Types.ObjectId, ref: 'Variant' },
          prd_name: { type: String, required: true },
          var_slug: { type: String, default: '' },
          prd_img: { type: String, required: true },
          prd_price: { type: Number, required: true },
          prd_quantity: { type: Number, required: true, min: 1 },
          itm_product_discount: { type: Number, required: true, default: 0 },
          itm_coupon_discount: { type: Number, required: true, default: 0 },
          prd_return_days: { type: Number, required: true, default: 7 },
          itm_is_reviewed: { type: Boolean, default: false },
        },
      ],
      required: true,
      validate: {
        validator: (items) => items.length > 0,
        message: 'Order must contain at least one item',
      },
    },
    ord_shipping_address: {
      type: {
        shp_fullname: { type: String, required: true },
        shp_phone: { type: String, required: true },
        shp_city: { type: String, required: true },
        shp_district: { type: String, required: true },
        shp_ward: { type: String, required: true },
        shp_street: { type: String, required: true },
      },
      required: true,
    },
    ord_payment_method: {
      type: String,
      enum: AvailablePaymentMethod,
      default: PaymentMethod.COD,
      required: true,
    },
    ord_payment_status: {
      type: String,
      enum: AvailablePaymentStatuses,
      default: PaymentStatus.PENDING,
      required: true,
    },
    ord_delivery_method: {
      type: Schema.Types.ObjectId,
      ref: 'Delivery',
      required: true,
    },
    ord_items_price: { type: Number, required: true, min: 0 },
    ord_items_discount: { type: Number, required: true, default: 0, min: 0 },
    ord_coupon_discount: { type: Number, required: true, default: 0, min: 0 },
    ord_shipping_price: { type: Number, required: true, default: 0, min: 0 },
    ord_shipping_discount: { type: Number, required: true, default: 0, min: 0 },
    ord_total_price: { type: Number, required: true, min: 0 },
    ord_is_paid: { type: Boolean, default: false },
    ord_is_delivered: { type: Boolean, default: false },
    ord_paid_at: { type: Date, default: null },
    ord_delivered_at: { type: Date, default: null },
    ord_transaction_id: { type: String, default: null },
    ord_status: {
      type: String,
      enum: AvailableOrderStatus,
      default: OrderStatus.PENDING,
      required: true,
    },
    ord_return_reason: {
      type: String,
      enum: AvailableReturnReasons,
      default: null,
    },
    ord_return_requested_at: { type: Date, default: null },
    ord_return_approved_at: { type: Date, default: null },
    ord_return_received_at: { type: Date, default: null },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

orderSchema.index({ ord_user_id: 1, ord_status: 1 });
orderSchema.index({ ord_status: 1 });
orderSchema.index({ ord_transaction_id: 1 });
orderSchema.index({ 'ord_shipping_address.shp_phone': 1 });

module.exports = model(DOCUMENT_NAME, orderSchema);
