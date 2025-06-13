'use strict';

const mongoose = require('mongoose');
const {
  PaymentStatus,
  AvailableTransactionType,
  AvailablePaymentMethod,
  AvailablePaymentStatuses,
} = require('../constants/status');

const PaymentTransactionSchema = new mongoose.Schema(
  {
    pmt_order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
    },
    pmt_transaction_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    pmt_transaction_no: { type: String, default: '' },
    pmt_type: { type: String, enum: AvailableTransactionType, required: true },
    pmt_method: { type: String, enum: AvailablePaymentMethod, required: true },
    pmt_amount: { type: Number, required: true, min: 0 },
    pmt_status: {
      type: String,
      enum: AvailablePaymentStatuses,
      default: PaymentStatus.PENDING,
    },
    pmt_bank_name: { type: String, trim: true },
    pmt_account_number: { type: String, trim: true },
    pmt_account_holder: { type: String, trim: true },
    pmt_bank_transfer_image: { type: String, trim: true },
    pmt_admin_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    pmt_completed_at: { type: Date, default: null },
  },
  {
    timestamps: true,
    collection: 'PaymentTransactions',
  }
);

// Index ngoài schema để tối ưu truy vấn
PaymentTransactionSchema.index({ pmt_order_id: 1 });
PaymentTransactionSchema.index({ pmt_status: 1 });

module.exports = mongoose.model('PaymentTransaction', PaymentTransactionSchema);
