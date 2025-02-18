'use strict';

const attributeModels = require('../models/attribute.model');
const BaseRepository = require('./base.repository');

class AttributeRepository extends BaseRepository {
  constructor() {
    super(attributeModels);
    this.model = attributeModels;
  }

  formatDocument(attribute) {
    if (!attribute) return null;

    return {
      id: attribute._id,
      name: attribute.attr_name,
      slug: attribute.attr_slug,
      type: attribute.attr_type,
      isVariantAttribute: attribute.attr_is_variant,
      values: attribute.attr_values.map((value) => ({
        valueId: value._id,
        value: value.value,
        descriptionUrl: value.description_url || null,
      })),
      isActive: attribute.attr_is_active,
      createdAt: attribute.createdAt,
      updatedAt: attribute.updatedAt,
    };
  }
}

module.exports = AttributeRepository;
