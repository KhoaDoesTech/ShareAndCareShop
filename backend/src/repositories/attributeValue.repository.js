'use strict';

const attributeValueModels = require('../models/attributeValue.model');
const BaseRepository = require('./base.repository');

class AttributeValueRepository extends BaseRepository {
  constructor() {
    super(attributeValueModels);
    this.model = attributeValueModels;
  }

  formatDocument(attributeValue) {
    if (!attributeValue) return null;

    return {
      id: attributeValue._id,
      attributeId: attributeValue.attr_id,
      value: attributeValue.value,
      descriptionUrl: attributeValue.description_url,
      createdAt: attributeValue.createdAt,
      updatedAt: attributeValue.updatedAt,
    };
  }
}

module.exports = AttributeValueRepository;
