'use strict';

const BaseRepository = require('./base.repository');
const DiscountModel = require('../models/discount.model');

class DiscountRepository extends BaseRepository {
  constructor() {
    super(DiscountModel);
    this.model = DiscountModel;
  }

  formatDocument(discount) {
    if (!discount) return null;

    return {
      id: discount._id,
      code: discount.dsc_code,
      type: discount.dsc_type,
      status: discount.dsc_status,
      items: (discount.dsc_items || []).map((item) => ({
        productId: item.prd_id,
        productName: item.prd_name,
      })),
      discountType: discount.dsc_type,
      discountValue: discount.dsc_value,
      discountStart: discount.dsc_start,
      discountEnd: discount.dsc_end,
      note: discount.dsc_note,
      createdBy: discount.dsc_created_by,
      updatedBy: discount.dsc_updated_by,
      createdAt: discount.createdAt,
      updatedAt: discount.updatedAt,
    };
  }
}

module.exports = new DiscountRepository();
