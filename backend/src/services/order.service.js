const OrderRepository = require('../repositories/order.repository');
class OrderService {
  constructor() {
    this.orderRepository = new OrderRepository();
  }
}

module.exports = OrderService;
