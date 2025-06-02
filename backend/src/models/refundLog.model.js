'use strict';

const mongoose = require('mongoose');
const {
  RefundStatus,
  AvailablePaymentMethod,
  AvailableRefundStatus,
  AvailableRefundReasons,
} = require('../constants/status');

const RefundLogSchema = new mongoose.Schema(
  {
    rfl_order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    rfl_payment_transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentTransaction',
      default: null,
    },
    rfl_amount: { type: Number, required: true, min: 0 },
    rfl_payment_method: {
      type: String,
      enum: AvailablePaymentMethod,
      required: true,
    },
    rfl_status: {
      type: String,
      enum: AvailableRefundStatus,
      default: RefundStatus.PENDING,
    },
    rfl_reason: { type: String, enum: AvailableRefundReasons, required: true },
    rfl_description: { type: String, trim: true },
    rfl_item: {
      prd_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
      var_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Variant',
        default: null,
      },
      prd_quantity: {
        type: Number,
        required: true,
        min: 1,
      },
    },
    rfl_admin_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rfl_requested_at: {
      type: Date,
      default: Date.now,
    },
    rfl_completed_at: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'RefundLogs',
  }
);

// Index ngoài schema để tối ưu truy vấn
RefundLogSchema.index({ rfl_order_id: 1 });
RefundLogSchema.index({ rfl_payment_transaction_id: 1 }, { sparse: true });
RefundLogSchema.index({ rfl_status: 1 });

module.exports = mongoose.model('RefundLog', RefundLogSchema);
