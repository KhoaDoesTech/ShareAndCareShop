'use strict';

const RefundLogModel = require('../models/refundLog.model');
const BaseRepository = require('./base.repository');

class RefundLogRepository extends BaseRepository {
  constructor() {
    super(RefundLogModel);
    this.model = RefundLogModel;
  }

  formatDocument(doc) {
    if (!doc) return null;

    return {
      id: doc._id,
      orderId: doc.rfl_order_id?._id || doc.rfl_order_id,
      paymentTransactionId:
        doc.rfl_payment_transaction_id?._id || doc.rfl_payment_transaction_id,
      amount: doc.rfl_amount,
      paymentMethod: doc.rfl_payment_method,
      status: doc.rfl_status,
      reason: doc.rfl_reason,
      description: doc.rfl_description || '',
      item: {
        productId: doc.rfl_item.prd_id?._id || doc.rfl_item.prd_id,
        productName: doc.rfl_item.prd_id?.prd_name || '',
        variantId: doc.rfl_item.var_id?._id || doc.rfl_item.var_id,
        variantName: doc.rfl_item.var_id?.var_name || '',
        quantity: doc.rfl_item.prd_quantity,
      },
      adminId: doc.rfl_admin_id?._id || doc.rfl_admin_id,
      admin: doc.rfl_admin_id
        ? {
            name: doc.rfl_admin_id.usr_name,
            email: doc.rfl_admin_id.usr_email,
          }
        : null,
      manualRequired: doc.rfl_manual_required,
      requestedAt: doc.rfl_requested_at,
      approvedAt: doc.rfl_approved_at,
      rejectedAt: doc.rfl_rejected_at,
      completedAt: doc.rfl_completed_at,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}

module.exports = RefundLogRepository;
