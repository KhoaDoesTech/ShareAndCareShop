'use strict';

const { model, Schema } = require('mongoose');
const {
  AvailableOrderStatus,
  OrderStatus,
  AvailablePaymentMethod,
  PaymentMethod,
} = require('../constants/status');

const DOCUMENT_NAME = 'Order';
const COLLECTION_NAME = 'Orders';

const orderSchema = new Schema(
  {
    ord_user_id: { type: Schema.Types.ObjectId, ref: 'User' },
    ord_coupon_id: {
      type: Schema.Types.ObjectId,
      ref: 'Coupon',
      default: null,
    },
    ord_items: {
      type: [
        {
          prd_id: { type: Schema.Types.ObjectId, ref: 'Product' },
          prd_name: { type: String, required: true },
          prd_price: { type: Number, required: true },
          prd_img: { type: String, required: true },
          prd_quantity: { type: Number, required: true, default: 1 },
          var_id: { type: Schema.Types.ObjectId, ref: 'Variant' },
        },
      ],
      default: [],
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
    },
    ord_payment_method: {
      type: String,
      enum: AvailablePaymentMethod,
      default: PaymentMethod.COD,
    },
    ord_delivery_method: {
      type: Schema.Types.ObjectId,
      ref: 'Delivery',
      required: true,
    },

    ord_items_price: { type: Number, required: true },
    ord_discount_price: { type: Number, required: true },
    ord_shipping_price: { type: Number, required: true },
    ord_total_price: { type: Number, required: true },

    ord_is_paid: { type: Boolean, default: false },
    ord_is_delivered: { type: Boolean, default: false },
    ord_paid_at: { type: Date },
    ord_delivered_at: { type: Date },

    ord_status: {
      type: String,
      enum: AvailableOrderStatus,
      default: OrderStatus.PENDING,
    },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

module.exports = model(DOCUMENT_NAME, orderSchema);
