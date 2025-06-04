'use strict';

const { PaymentMethod } = require('../constants/status');
const PaymentTransactionModel = require('../models/paymentTransaction.model');
const BaseRepository = require('./base.repository');

class PaymentTransactionRepository extends BaseRepository {
  constructor() {
    super(PaymentTransactionModel);
    this.model = PaymentTransactionModel;
  }

  formatDocument(doc) {
    if (!doc) return null;

    return {
      id: doc._id,
      orderId: doc.pmt_order_id?._id || doc.pmt_order_id,
      transactionId: doc.pmt_transaction_id,
      type: doc.pmt_type,
      method: doc.pmt_method,
      amount: doc.pmt_amount,
      status: doc.pmt_status,
      bankDetails:
        doc.pmt_method === PaymentMethod.MANUAL
          ? {
              bankName: doc.pmt_bank_name || '',
              accountNumber: doc.pmt_account_number || '',
              accountHolder: doc.pmt_account_holder || '',
              transferImage: doc.pmt_bank_transfer_image || '',
            }
          : null,
      adminId: doc.pmt_admin_id?._id || doc.pmt_admin_id,
      admin: doc.pmt_admin_id
        ? {
            name: doc.pmt_admin_id.usr_name,
            email: doc.pmt_admin_id.usr_email,
          }
        : null,
      completedAt: doc.pmt_completed_at,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}

module.exports = PaymentTransactionRepository;
