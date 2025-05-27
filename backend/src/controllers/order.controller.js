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
      message: 'Order reviewed successfully',
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
      message: 'Order created successfully',
      metadata: await this.orderService.createOrder({
        ...req.body,
        userId: req.user.id,
        ipAddress,
      }),
    }).send(res);
  };

  updateOrderStatus = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Order updated successfully',
      metadata: await this.orderService.updateOrderStatus(req.params.orderId),
    }).send(res);
  };

  reviewNextStatus = async (req, res, next) => {
    new ActionSuccess({
      message: 'Order status reviewed successfully',
      metadata: await this.orderService.reviewNextStatus(req.params.orderId),
    }).send(res);
  };

  cancelOrder = async (req, res, next) => {
    new ActionSuccess({
      message: 'Order canceled successfully',
      metadata: await this.orderService.cancelOrder({
        orderId: req.params.orderId,
        userId: req.user.id,
      }),
    }).send(res);
  };

  getAllOrders = async (req, res, next) => {
    new ActionSuccess({
      message: 'Orders retrieved successfully',
      metadata: await this.orderService.getAllOrders(req.query),
    }).send(res);
  };

  getOrdersByUserId = async (req, res, next) => {
    new ActionSuccess({
      message: 'Orders retrieved successfully',
      metadata: await this.orderService.getOrdersByUserId({
        userId: req.user.id,
        ...req.query,
      }),
    }).send(res);
  };

  getOrderDetailsByUser = async (req, res, next) => {
    new ActionSuccess({
      message: 'Order details retrieved successfully',
      metadata: await this.orderService.getOrderDetailsByUser({
        userId: req.user.id,
        orderId: req.params.orderId,
      }),
    }).send(res);
  };

  getOrderDetails = async (req, res, next) => {
    new ActionSuccess({
      message: 'Order details retrieved successfully',
      metadata: await this.orderService.getOrderDetails(req.params.orderId),
    }).send(res);
  };
}

module.exports = new OrderController();
