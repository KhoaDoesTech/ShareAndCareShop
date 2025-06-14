'use strict';

const {
  CreateSuccess,
  NoContentSuccess,
  ActionSuccess,
} = require('../utils/successResponse');
const AttributeService = require('../services/attribute.service');

class AttributeController {
  constructor() {
    this.attributeService = new AttributeService();
  }

  createAttribute = async (req, res, next) => {
    new CreateSuccess({
      message: 'Tạo thuộc tính thành công',
      metadata: await this.attributeService.createAttribute(req.body),
    }).send(res);
  };

  addValuesToAttribute = async (req, res, next) => {
    new ActionSuccess({
      message: 'Thêm giá trị vào thuộc tính thành công',
      metadata: await this.attributeService.addValuesToAttribute(req.body),
    }).send(res);
  };

  getAllAttributes = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy danh sách thuộc tính thành công',
      metadata: await this.attributeService.getAllAttributes(req.query),
    }).send(res);
  };

  getAttributesByUser = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy thuộc tính theo người dùng thành công',
      metadata: await this.attributeService.getAttributesByUser(),
    }).send(res);
  };
}

module.exports = new AttributeController();
