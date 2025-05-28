'use strict';

const { model, Schema } = require('mongoose');
const {
  AvailablePaymentMethods,
  RefundStatus,
  AvailableRefundStatus,
} = require('../constants/status');

const DOCUMENT_NAME = 'RefundLog';
const COLLECTION_NAME = 'RefundLogs';

const refundLogSchema = new Schema(
  {
    rfl_order_id: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    rfl_transaction_id: { type: String, required: true },
    rfl_amount: { type: Number, required: true },
    rfl_payment_method: {
      type: String,
      enum: AvailablePaymentMethods,
      required: true,
    },
    rfl_status: {
      type: String,
      enum: AvailableRefundStatus,
      default: RefundStatus.PENDING,
    },
    rfl_requested_at: { type: Date, default: Date.now },
    rfl_confirmed_at: { type: Date },
    rfl_admin_id: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

refundLogSchema.index({ rfl_order_id: 1, rfl_status: 1 });
refundLogSchema.index({ rfl_transaction_id: 1 });

module.exports = model(DOCUMENT_NAME, refundLogSchema);
