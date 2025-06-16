'use strict';

const BaseRepository = require('./base.repository');
const couponModels = require('../models/coupon.model');
const mongoose = require('mongoose');

class CouponRepository extends BaseRepository {
  constructor() {
    super(couponModels);
    this.model = couponModels;
  }

  async findByCode(code) {
    const foundCoupon = await this.model.findOne({ cpn_code: code });

    return this.formatDocument(foundCoupon);
  }

  async getCouponByIndentifier(identifier) {
    let query = {};

    if (mongoose.Types.ObjectId.isValid(identifier)) {
      query = { _id: identifier };
    } else {
      query = { cpn_code: identifier };
    }

    const foundCoupon = await this.model.findOne(query);

    return this.formatDocument(foundCoupon);
  }

  async incrementUsesCount(couponId) {
    return await this.model.findByIdAndUpdate(
      couponId,
      { $inc: { cpn_uses_count: 1 } },
      { new: true }
    );
  }

  formatDocument(coupon) {
    if (!coupon) return null;

    return {
      id: coupon._id,
      name: coupon.cpn_name,
      code: coupon.cpn_code,
      description: coupon.cpn_description,
      startDate: coupon.cpn_start_date,
      endDate: coupon.cpn_end_date,
      type: coupon.cpn_type,
      value: coupon.cpn_value,
      minValue: coupon.cpn_min_value,
      maxValue: coupon.cpn_max_value,
      maxUses: coupon.cpn_max_uses,
      maxUsesPerUser: coupon.cpn_max_uses_per_user,
      targetType: coupon.cpn_target_type,
      targetIds: coupon.cpn_target_ids,
      usesCount: coupon.cpn_uses_count,
      usersUsed: coupon.cpn_users_used,
      isActive: coupon.cpn_is_active,
      createdAt: coupon.createdAt,
      updatedAt: coupon.updatedAt,
    };
  }
}

module.exports = CouponRepository;
