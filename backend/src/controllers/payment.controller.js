const PaymentService = require('../services/payment.service');
const { CreateSuccess, NoContentSuccess } = require('../utils/successResponse');

class PaymentController {
  constructor() {
    this.paymentService = new PaymentService();
  }

  createVNPayUrl = async (req, res, next) => {
    const ipAddress =
      req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket.remoteAddress;

    new CreateSuccess({
      message: 'VNPay URL created successfully',
      metadata: await this.paymentService.createVNPayUrl({
        ...req.body,
        ipAddress,
      }),
    }).send(res);
  };

  checkPaymentStatus = async (req, res, next) => {
    const vnp_Params = req.query;

    try {
      await this.paymentService.checkPaymentStatus(vnp_Params);
      res.redirect(`${process.env.FRONTEND_URL}`);
    } catch (error) {
      res.redirect(
        `${process.env.FRONTEND_URL}/error?message=${error.message}`
      );
    }
  };
}

module.exports = new PaymentController();
