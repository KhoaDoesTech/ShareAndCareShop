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
      message: 'Attribute created successfully',
      metadata: await this.attributeService.createAttribute(req.body),
    }).send(res);
  };

  addValuesToAttribute = async (req, res, next) => {
    new ActionSuccess({
      message: 'Value added to attribute successfully',
      metadata: await this.attributeService.addValuesToAttribute(req.body),
    }).send(res);
  };

  getAllAttributes = async (req, res, next) => {
    new ActionSuccess({
      message: 'Attributes retrieved successfully',
      metadata: await this.attributeService.getAllAttributes(req.query),
    }).send(res);
  };

  getAttributesByUser = async (req, res, next) => {
    new ActionSuccess({
      message: 'Attributes retrieved successfully',
      metadata: await this.attributeService.getAttributesByUser(),
    }).send(res);
  };
}

module.exports = new AttributeController();
