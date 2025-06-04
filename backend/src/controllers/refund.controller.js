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

  confirmReturnReceived = async (req, res, next) => {
    const ipAddress =
      req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const metadata = await this.refundService.confirmReturnReceived({
      refundLogId: req.params.refundLogId,
      adminId: req.user.id,
      ipAddress,
    });
    new ActionSuccess({
      message: 'Return confirmed successfully',
      metadata,
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

  processRefund = async (req, res, next) => {
    const ipAddress =
      req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    new ActionSuccess({
      message: 'Refund processed successfully',
      metadata: await this.refundService.processRefund({
        refundLogIds: req.body.refundLogIds,
        adminId: req.user.id,
        refundMethod: req.body.refundMethod,
        bankName: req.body.bankName,
        accountNumber: req.body.accountNumber,
        accountHolder: req.body.accountHolder,
        transferImage: req.body.transferImage,
        ipAddress,
      }),
    }).send(res);
  };

  getRefundStatus = async (req, res, next) => {
    new ActionSuccess({
      message: 'Refund status retrieved successfully',
      metadata: await this.refundService.getRefundStatus(
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

  getManualRequiredRefunds = async (req, res, next) => {
    new ActionSuccess({
      message: 'Manual required refunds retrieved successfully',
      metadata: await this.refundService.getManualRequiredRefunds({
        ...req.query,
        orderId: req.query.orderId,
      }),
    }).send(res);
  };
}

module.exports = new RefundController();
