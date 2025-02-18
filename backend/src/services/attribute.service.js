'use strict';

const {
  AvailableAttributeTypes,
  SortFieldAttribute,
} = require('../constants/status');
const AttributeRepository = require('../repositories/attribute.repository');
const AttributeValueRepository = require('../repositories/attributeValue.repository');
const { BadRequestError, NotFoundError } = require('../utils/errorResponse');
const { pickFields, omitFields, listResponse } = require('../utils/helpers');

class AttributeService {
  constructor() {
    this.attributeRepository = new AttributeRepository();
    this.attributeValueRepository = new AttributeValueRepository();
  }

  async createAttribute({
    name,
    type,
    isVariantAttribute,
    isActive,
    values = [],
  }) {
    // Validate required fields
    if (!name || !type) {
      throw new BadRequestError('Attribute name and type are required');
    }

    // Check if attribute type is valid
    if (!AvailableAttributeTypes.includes(type)) {
      throw new BadRequestError('Invalid attribute type');
    }

    const newAttribute = await this.attributeRepository.create({
      attr_name: name,
      attr_type: type,
      attr_is_variant: isVariantAttribute || false,
      attr_is_active: isActive || true,
    });

    if (values && values.length > 0) {
      const createdValues = await Promise.all(
        values.map((value) =>
          this.attributeValueRepository.create({
            attr_id: newAttribute.id,
            value: value.value,
            description_url: value.description_url || null,
          })
        )
      );

      const attrValues = createdValues.map((value) => value.id);
      await this.attributeRepository.updateById(newAttribute.id, {
        attr_values: attrValues,
      });
    }

    return pickFields({
      fields: ['id'],
      object: newAttribute,
    });
  }

  async addValuesToAttribute({ attributeId, values }) {
    // Validate required fields
    if (!attributeId || !Array.isArray(values) || values.length === 0) {
      throw new BadRequestError('Attribute ID and values are required');
    }

    // Check if attribute exists and populate values
    const attribute = await this.attributeRepository.getById(
      attributeId,
      'attr_values'
    );
    if (!attribute) {
      throw new NotFoundError('Attribute not found');
    }
    console.log(attribute);
    // Get existing attribute values
    const existingValueSet = new Set(attribute.values.map((v) => v.value));

    // Filter out duplicate values
    const newValues = values.filter(
      (value) => !existingValueSet.has(value.value)
    );

    if (newValues.length === 0) {
      throw new BadRequestError('All provided values already exist');
    }

    // Create new attribute values
    const createdValues = await Promise.all(
      newValues.map((value) =>
        this.attributeValueRepository.create({
          attr_id: attributeId,
          value: value.value,
          description_url: value.description_url || null,
        })
      )
    );

    // Update attribute with new values
    const newAttrValues = [
      ...attribute.values.map((v) => v.valueId),
      ...createdValues.map((v) => v.id),
    ];

    await this.attributeRepository.updateById(attributeId, {
      attr_values: newAttrValues,
    });

    return {
      attributeId,
      addedValues: createdValues.map((v) => ({
        id: v.id,
        value: v.value,
        descriptionUrl: v.description_url,
      })),
    };
  }

  async getAllAttributes({
    name,
    slug,
    isVariantAttribute,
    type,
    isActive,
    sort,
    page = 1,
    size = 10,
  }) {
    const filters = {};

    if (name) {
      filters.attr_name = { $regex: name, $options: 'i' };
    }

    if (slug) {
      filters.attr_slug = { $regex: slug, $options: 'i' };
    }

    if (isVariantAttribute !== undefined) {
      filters.attr_is_variant = isVariantAttribute === 'true';
    }

    if (type) {
      filters.attr_type = type;
    }

    if (isActive !== undefined) {
      filters.attr_is_active = isActive === 'true';
    }

    const formatPage = parseInt(page);
    const formatSize = parseInt(size);

    const mappedSort = sort
      ? `${sort.startsWith('-') ? '-' : ''}${
          SortFieldAttribute[sort.replace('-', '')] || 'createdAt'
        }`
      : '-createdAt';

    const queryOptions = {
      sort: mappedSort,
      page: formatPage,
      size: formatSize,
    };

    const attributes = await this.attributeRepository.getAll({
      filter: filters,
      queryOptions,
      populateOptions: 'attr_values',
    });

    const totalAttributes = await this.attributeRepository.countDocuments(
      filters
    );

    return listResponse({
      items: attributes.map((attribute) =>
        omitFields({
          fields: ['createdAt', 'updatedAt'],
          object: attribute,
        })
      ),
      total: totalAttributes,
      page: formatPage,
      size: formatSize,
    });
  }
}

module.exports = AttributeService;
