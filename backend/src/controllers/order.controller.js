const OrderService = require('../services/order.service');
const { CreateSuccess, NoContentSuccess } = require('../utils/successResponse');

class OrderController {
  constructor() {
    this.orderService = new OrderService();
  }

  reviewOrder = async (req, res, next) => {
    new CreateSuccess({
      message: 'Order reviewed successfully',
      metadata: await this.orderService.validateAndCalculateItems(req.body),
    }).send(res);
  };

  createOrder = async (req, res, next) => {
    new CreateSuccess({
      message: 'Order created successfully',
      metadata: await this.orderService.createOrder(req.body),
    }).send(res);
  };
}

module.exports = new OrderController();
