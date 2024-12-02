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
      message: 'Delivery created successfully',
      metadata: await this.deliveryService.createDelivery(req.body),
    }).send(res);
  };

  calculateDeliveryFee = async (req, res, next) => {
    new ActionSuccess({
      message: 'Delivery fee calculated successfully',
      metadata: await this.deliveryService.calculateDeliveryFee(req.query),
    }).send(res);
  };

  getDeliveries = async (req, res, next) => {
    new ActionSuccess({
      message: 'Deliveries retrieved successfully',
      metadata: await this.deliveryService.getAllDeliveries(),
    }).send(res);
  };

  getDeliveryFees = async (req, res, next) => {
    new ActionSuccess({
      message: 'Delivery fees retrieved successfully',
      metadata: await this.deliveryService.getAllDeliveryWithFee(req.query),
    }).send(res);
  };

  getDelivery = async (req, res, next) => {
    new ActionSuccess({
      message: 'Delivery retrieved successfully',
      metadata: await this.deliveryService.getDeliveryById(
        req.params.deliveryId
      ),
    }).send(res);
  };

  activateDelivery = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Delivery activated successfully',
      metadata: await this.deliveryService.activateDelivery(
        req.params.deliveryId
      ),
    }).send(res);
  };

  deactivateDelivery = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Delivery deactivated successfully',
      metadata: await this.deliveryService.deactivateDelivery(
        req.params.deliveryId
      ),
    }).send(res);
  };

  updateDelivery = async (req, res, next) => {
    new ActionSuccess({
      message: 'Delivery updated successfully',
      metadata: await this.deliveryService.updateDelivery({
        deliveryId: req.params.deliveryId,
        ...req.body,
      }),
    }).send(res);
  };
}

module.exports = new DeliveryController();
