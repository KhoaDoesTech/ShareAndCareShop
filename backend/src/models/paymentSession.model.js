'use strict';

const { model, Schema } = require('mongoose');
const {
  AvailablePaymentGateway,
  PaymentSessionStatus,
  AvailablePaymentSessionStatus,
} = require('../constants/status');

const DOCUMENT_NAME = 'PaymentSession';
const COLLECTION_NAME = 'PaymentSessions';

const paymentSessionSchema = new Schema(
  {
    pms_order_id: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    pms_payment_method: {
      type: String,
      required: true,
      enum: AvailablePaymentGateway,
    },
    pms_payment_url: { type: String, required: true },
    pms_request_id: { type: String }, // MoMo-specific
    pms_transaction_id: { type: String }, // VNPay/MoMo transaction ID
    pms_status: {
      type: String,
      enum: AvailablePaymentSessionStatus,
      default: PaymentSessionStatus.PENDING,
    },
    pms_expires_at: { type: Date, required: true },
    pms_retry_count: { type: Number, default: 0 },
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

paymentSessionSchema.index({ pms_order_id: 1, pms_status: 1 });
paymentSessionSchema.index({ pms_transaction_id: 1 });

module.exports = model(DOCUMENT_NAME, paymentSessionSchema);
