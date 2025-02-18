'use strict';

const BaseRepository = require('./base.repository');
const VariantHistoryModel = require('../models/variantHistory.model');

class VariantHistoryRepository extends BaseRepository {
  constructor() {
    super(VariantHistoryModel);
    this.model = VariantHistoryModel;
  }

  formatDocument(variant) {
    if (!variant) return null;

    const formattedVariant = {
      id: variant._id,
      productHistoryId: variant.prd_history_id,
      version: variant.var_version,
      action: variant.var_action,
      changedBy: variant.var_changed_by,
      name: variant.prd_name,
      slug: variant.var_slug,
      tierIndex: variant.var_tier_idx,
      isDefault: variant.var_default,
      price: variant.var_price,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    };

    return formattedVariant;
  }
}

module.exports = VariantHistoryRepository;
