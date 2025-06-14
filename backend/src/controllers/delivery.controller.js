const DeliveryService = require('../services/delivery.service');
const {
  CreateSuccess,
  NoContentSuccess,
  ActionSuccess,
} = require('../utils/successResponse');

class DeliveryController {
  constructor() {
    this.deliveryService = new DeliveryService();
  }

  createDelivery = async (req, res, next) => {
    new CreateSuccess({
      message: 'Tạo phương thức giao hàng thành công',
      metadata: await this.deliveryService.createDelivery(req.body),
    }).send(res);
  };

  calculateDeliveryFee = async (req, res, next) => {
    new ActionSuccess({
      message: 'Tính phí giao hàng thành công',
      metadata: await this.deliveryService.calculateDeliveryFee(req.query),
    }).send(res);
  };

  getDeliveries = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy danh sách phương thức giao hàng thành công',
      metadata: await this.deliveryService.getAllDeliveries(),
    }).send(res);
  };

  getDeliveryFees = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy danh sách phí giao hàng thành công',
      metadata: await this.deliveryService.getAllDeliveryWithFee(req.query),
    }).send(res);
  };

  getDelivery = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy thông tin phương thức giao hàng thành công',
      metadata: await this.deliveryService.getDeliveryById(
        req.params.deliveryId
      ),
    }).send(res);
  };

  activateDelivery = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Kích hoạt phương thức giao hàng thành công',
      metadata: await this.deliveryService.activateDelivery(
        req.params.deliveryId
      ),
    }).send(res);
  };

  deactivateDelivery = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Ngừng kích hoạt phương thức giao hàng thành công',
      metadata: await this.deliveryService.deactivateDelivery(
        req.params.deliveryId
      ),
    }).send(res);
  };

  updateDelivery = async (req, res, next) => {
    new ActionSuccess({
      message: 'Cập nhật phương thức giao hàng thành công',
      metadata: await this.deliveryService.updateDelivery({
        deliveryId: req.params.deliveryId,
        ...req.body,
      }),
    }).send(res);
  };
}

module.exports = new DeliveryController();
