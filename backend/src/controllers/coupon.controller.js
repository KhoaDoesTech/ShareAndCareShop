const CouponService = require('../services/coupon.service');
const { CreateSuccess, NoContentSuccess } = require('../utils/successResponse');

class CouponController {
  constructor() {
    this.couponService = new CouponService();
  }

  createCoupon = async (req, res, next) => {
    new CreateSuccess({
      message: 'Coupon created successfully',
      metadata: await this.couponService.createCoupon(req.body),
    }).send(res);
  };
}

module.exports = new CouponController();
