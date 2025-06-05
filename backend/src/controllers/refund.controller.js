'use strict';

const RefundService = require('../services/refund.service');
const {
  CreateSuccess,
  ActionSuccess,
  NoContentSuccess,
} = require('../utils/successResponse');

class RefundController {
  constructor() {
    this.refundService = new RefundService();
  }

  createRefundRequest = async (req, res, next) => {
    new CreateSuccess({
      message: 'Refund request created successfully',
      metadata: await this.refundService.createRefundRequest({
        orderId: req.params.orderId,
        userId: req.user.id,
        productId: req.body.productId,
        variantId: req.body.variantId,
        reason: req.body.reason,
        description: req.body.description,
      }),
    }).send(res);
  };

  approveRefundRequest = async (req, res, next) => {
    new ActionSuccess({
      message: 'Refund request approved successfully',
      metadata: await this.refundService.approveRefundRequest({
        refundLogId: req.params.refundLogId,
        adminId: req.user.id,
      }),
    }).send(res);
  };

  rejectRefundRequest = async (req, res, next) => {
    new ActionSuccess({
      message: 'Refund request rejected successfully',
      metadata: await this.refundService.rejectRefundRequest({
        refundLogId: req.params.refundLogId,
        adminId: req.user.id,
        rejectReason: req.body.rejectReason,
      }),
    }).send(res);
  };

  getRefundDetails = async (req, res, next) => {
    new ActionSuccess({
      message: 'Refund status retrieved successfully',
      metadata: await this.refundService.getRefundDetails(
        req.params.refundLogId
      ),
    }).send(res);
  };

  getRefundRequestsForAdmin = async (req, res, next) => {
    new ActionSuccess({
      message: 'Refund requests retrieved successfully',
      metadata: await this.refundService.getRefundRequestsForAdmin({
        ...req.query,
        orderId: req.query.orderId,
      }),
    }).send(res);
  };
}

module.exports = new RefundController();
