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
}

module.exports = new OrderController();
