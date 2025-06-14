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
      message: 'Tạo yêu cầu hoàn trả thành công',
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
      message: 'Duyệt yêu cầu hoàn trả thành công',
      metadata: await this.refundService.approveRefundRequest({
        refundLogId: req.params.refundLogId,
        adminId: req.user.id,
      }),
    }).send(res);
  };

  rejectRefundRequest = async (req, res, next) => {
    new ActionSuccess({
      message: 'Từ chối yêu cầu hoàn trả thành công',
      metadata: await this.refundService.rejectRefundRequest({
        refundLogId: req.params.refundLogId,
        adminId: req.user.id,
        rejectReason: req.body.rejectReason,
      }),
    }).send(res);
  };

  confirmReturnReceived = async (req, res, next) => {
    const ipAddress =
      req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    new ActionSuccess({
      message: 'Xác nhận hoàn trả thành công',
      metadata: await this.refundService.confirmReturnReceived({
        adminId: req.user.id,
        ipAddress,
        ...req.body,
      }),
    }).send(res);
  };

  getRefundDetails = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy trạng thái hoàn trả thành công',
      metadata: await this.refundService.getRefundDetails(
        req.params.refundLogId
      ),
    }).send(res);
  };

  getRefundRequestsForAdmin = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy danh sách yêu cầu hoàn trả thành công',
      metadata: await this.refundService.getRefundRequestsForAdmin({
        ...req.query,
      }),
    }).send(res);
  };
}

module.exports = new RefundController();
