'use strict';

const RefundLogModel = require('../models/refundLog.model');
const BaseRepository = require('./base.repository');

class RefundLogRepository extends BaseRepository {
  constructor() {
    super(RefundLogModel);
    this.model = RefundLogModel;
  }

  async getByQuery({ filter = {}, fields = '', options = {} }) {
    let documentQuery = this.model.findOne(filter, fields, options);
    documentQuery = documentQuery.populate([
      {
        path: 'rfl_order_id',
        select: 'ord_total_price ord_payment_method ord_status',
      },
      { path: 'rfl_admin_id', select: 'usr_name usr_email' },
    ]);
    const document = await documentQuery.lean();

    return this.formatDocument(document);
  }

  formatDocument(log) {
    if (!log) return null;

    return {
      id: log._id,
      orderId: log.rfl_order_id?._id || log.rfl_order_id,
      order: log.rfl_order_id
        ? {
            totalPrice: log.rfl_order_id.ord_total_price,
            paymentMethod: log.rfl_order_id.ord_payment_method,
            status: log.rfl_order_id.ord_status,
          }
        : null,
      transactionId: log.rfl_transaction_id,
      amount: log.rfl_amount,
      paymentMethod: log.rfl_payment_method,
      status: log.rfl_status,
      requestedAt: log.rfl_requested_at,
      completedAt: log.rfl_completed_at,
      admin: log.rfl_admin_id
        ? {
            id: log.rfl_admin_id._id,
            name: log.rfl_admin_id.usr_name,
            email: log.rfl_admin_id.usr_email,
          }
        : null,
      createdAt: log.createdAt,
      updatedAt: log.updatedAt,
    };
  }
}

module.exports = RefundLogRepository;
