'use strict';

const { model, Schema } = require('mongoose');
const {
  AvailableTransactionType,
  AvailablePaymentMethod,
  AvailablePaymentStatuses,
  PaymentStatus,
} = require('../constants/status');

const DOCUMENT_NAME = 'PaymentTransaction';
const COLLECTION_NAME = 'PaymentTransactions';

const paymentTransactionSchema = new Schema(
  {
    pmt_order_id: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    pmt_transaction_id: { type: String, required: true },
    pmt_type: {
      type: String,
      enum: AvailableTransactionType,
      required: true,
    },
    pmt_method: {
      type: String,
      enum: AvailablePaymentMethod,
      required: true,
    },
    pmt_amount: { type: Number, required: true, min: 0 },
    pmt_status: {
      type: String,
      enum: AvailablePaymentStatuses,
      default: PaymentStatus.PENDING,
    },
    pmt_details: {
      bankName: String, // Tên ngân hàng (manual refund)
      accountNumber: String, // Số tài khoản
      accountHolder: String, // Chủ tài khoản
      transferTime: Date, // Thời gian chuyển khoản
      transferNote: String, // Ghi chú
      proofImage: String, // URL hình ảnh chứng từ
      errorMessage: String, // Thông báo lỗi
    },
    pmt_admin_id: { type: Schema.Types.ObjectId, ref: 'User' }, // Admin xử lý
    pmt_completed_at: Date, // Thời gian hoàn tất
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
  }
);

paymentTransactionSchema.index({ pmt_order_id: 1, pmt_status: 1 });
paymentTransactionSchema.index({ pmt_transaction_id: 1 });
paymentTransactionSchema.index({ pmt_type: 1, pmt_status: 1 });

module.exports = model(DOCUMENT_NAME, paymentTransactionSchema);
