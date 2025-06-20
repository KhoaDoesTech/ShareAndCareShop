'use strict';

const OrderService = require('../services/order.service');
const {
  CreateSuccess,
  NoContentSuccess,
  ActionSuccess,
} = require('../utils/successResponse');

class OrderController {
  constructor() {
    this.orderService = new OrderService();
  }

  reviewOrder = async (req, res, next) => {
    new ActionSuccess({
      message: 'Đánh giá đơn hàng thành công',
      metadata: await this.orderService.reviewOrder({
        ...req.body,
        userId: req.user.id,
      }),
    }).send(res);
  };

  createOrder = async (req, res, next) => {
    const ipAddress =
      req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    new CreateSuccess({
      message: 'Tạo đơn hàng thành công',
      metadata: await this.orderService.createOrder({
        ...req.body,
        userId: req.user.id,
        ipAddress,
      }),
    }).send(res);
  };

  updateOrderStatus = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Cập nhật trạng thái đơn hàng thành công',
      metadata: await this.orderService.updateOrderStatus({
        orderId: req.params.orderId,
        adminId: req.user.id,
      }),
    }).send(res);
  };

  getOrderDetailsForUser = async (req, res, next) => {
    const ipAddress =
      req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    new ActionSuccess({
      message: 'Lấy chi tiết đơn hàng thành công',
      metadata: await this.orderService.getOrderDetailsForUser({
        userId: req.user.id,
        orderId: req.params.orderId,
        ipAddress,
      }),
    }).send(res);
  };

  getOrderDetailsForAdmin = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy chi tiết đơn hàng thành công',
      metadata: await this.orderService.getOrderDetailsForAdmin({
        orderId: req.params.orderId,
      }),
    }).send(res);
  };

  getOrdersListForUser = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy danh sách đơn hàng thành công',
      metadata: await this.orderService.getOrdersListForUser({
        userId: req.user.id,
        ...req.query,
      }),
    }).send(res);
  };

  getOrdersListForAdmin = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy danh sách đơn hàng thành công',
      metadata: await this.orderService.getOrdersListForAdmin(req.query),
    }).send(res);
  };

  reviewNextStatus = async (req, res, next) => {
    new ActionSuccess({
      message: 'Đánh giá trạng thái tiếp theo của đơn hàng thành công',
      metadata: await this.orderService.reviewNextStatus(req.params.orderId),
    }).send(res);
  };

  cancelOrder = async (req, res, next) => {
    const ipAddress =
      req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    new ActionSuccess({
      message: 'Hủy đơn hàng thành công',
      metadata: await this.orderService.cancelOrder({
        orderId: req.params.orderId,
        userId: req.user.id,
        ipAddress,
      }),
    }).send(res);
  };

  requestReturn = async (req, res, next) => {
    new ActionSuccess({
      message: 'Gửi yêu cầu trả hàng thành công',
      metadata: await this.orderService.requestReturn({
        userId: req.user.id,
        orderId: req.params.orderId,
        reason: req.body.reason,
      }),
    }).send(res);
  };

  approveReturn = async (req, res, next) => {
    const ipAddress =
      req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    new ActionSuccess({
      message: 'Duyệt yêu cầu trả hàng thành công',
      metadata: await this.orderService.approveReturn({
        orderId: req.params.orderId,
        adminId: req.user.id,
        ipAddress,
      }),
    }).send(res);
  };
}

module.exports = new OrderController();
