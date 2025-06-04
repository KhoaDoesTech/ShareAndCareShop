'use strict';

const PaymentSessionModel = require('../models/paymentSession.model');
const BaseRepository = require('./base.repository');

class PaymentSessionRepository extends BaseRepository {
  constructor() {
    super(PaymentSessionModel);
    this.model = PaymentSessionModel;
  }

  async updateByQuery(query, update) {
    const filter = query.filter || {};
    const options = query.options || { new: true };
    const document = await this.model
      .findOneAndUpdate(filter, update, options)
      .lean();
    return this.formatDocument(document);
  }

  formatDocument(session) {
    if (!session) return null;

    return {
      id: session._id,
      orderId: session.pms_order_id?._id || session.pms_order_id,
      order: session.pms_order_id
        ? {
            totalPrice: session.pms_order_id.ord_total_price,
            paymentMethod: session.pms_order_id.ord_payment_method,
            status: session.pms_order_id.ord_status,
          }
        : null,
      paymentMethod: session.pms_payment_method,
      paymentUrl: session.pms_payment_url,
      requestId: session.pms_request_id,
      transactionId: session.pms_transaction_id,
      status: session.pms_status,
      expiresAt: session.pms_expires_at,
      retryCount: session.pms_retry_count,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }
}

module.exports = PaymentSessionRepository;
