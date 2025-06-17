'use strict';

const InventoryService = require('../services/inventory.service');
const {
  CreateSuccess,
  NoContentSuccess,
  ActionSuccess,
} = require('../utils/successResponse');

class InventoryController {
  constructor() {
    this.inventoryService = new InventoryService();
  }

  importStock = async (req, res, next) => {
    new CreateSuccess({
      message: 'Thêm kho hàng thành công',
      metadata: await this.inventoryService.importStock({
        userId: req.user.id,
        ...req.body,
      }),
    }).send(res);
  };

  getAllInventory = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy danh sách kho hàng thành công',
      metadata: await this.inventoryService.getAllInventory(req.query),
    }).send(res);
  };

  getInventoryById = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy thông tin kho hàng thành công',
      metadata: await this.inventoryService.getInventoryById(
        req.params.inventoryKey
      ),
    }).send(res);
  };

  applyBulkDiscount = async (req, res, next) => {
    new ActionSuccess({
      message: 'Áp dụng giảm giá hàng loạt thành công',
      metadata: await this.inventoryService.applyBulkDiscount({
        userId: req.user.id,
        ...req.body,
      }),
    }).send(res);
  };

  getAllDiscounts = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy danh sách giảm giá thành công',
      metadata: await this.inventoryService.getAllDiscounts(req.query),
    }).send(res);
  };

  getDiscountById = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy thông tin giảm giá thành công',
      metadata: await this.inventoryService.getDiscountById(
        req.params.discountId
      ),
    }).send(res);
  };
}

module.exports = new InventoryController();
