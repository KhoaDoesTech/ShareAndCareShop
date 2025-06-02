'use strict';

const PaymentService = require('../services/payment.service');
const { CreateSuccess, NoContentSuccess } = require('../utils/successResponse');

class PaymentController {
  constructor() {
    this.paymentService = new PaymentService();
  }

  handleVNPayCallback = async (req, res) => {
    try {
      const result = await this.paymentService.verifyVNPayCallback(req.query);
      if (result.isSuccess) {
        res.redirect(
          `${process.env.FRONTEND_URL}/payment/success?orderId=${result.orderId}`
        );
      } else {
        res.redirect(
          `${process.env.FRONTEND_URL}/payment/failure?orderId=${result.orderId}`
        );
      }
    } catch (error) {
      res.redirect(
        `${process.env.FRONTEND_URL}/error?message=${encodeURIComponent(
          error.message
        )}`
      );
    }
  };

  handleMoMoCallback = async (req, res) => {
    try {
      const result = await this.paymentService.verifyMoMoCallback(req.query);
      const paramsString = encodeURIComponent(JSON.stringify(result.params));
      if (result.isSuccess) {
        res.redirect(
          `${process.env.FRONTEND_URL}/payment/success?orderId=${result.orderId}&params=${paramsString}`
        );
      } else {
        res.redirect(
          `${process.env.FRONTEND_URL}/payment/failure?orderId=${result.orderId}&params=${paramsString}`
        );
      }
    } catch (error) {
      res.redirect(
        `${process.env.FRONTEND_URL}/error?message=${encodeURIComponent(
          error.message
        )}`
      );
    }
  };

  createVNPayPaymentUrl = async (req, res) => {
    const ipAddress =
      req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const paymentUrl = await this.paymentService.createVNPayPaymentUrl({
      ...req.body,
      ipAddress,
    });

    new CreateSuccess({
      message: 'VNPay payment URL created successfully',
      metadata: paymentUrl,
    }).send(res);
  };

  createMoMoPaymentUrl = async (req, res) => {
    const ipAddress =
      req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const paymentUrl = await this.paymentService.createMoMoPaymentUrl({
      ...req.body,
      ipAddress,
    });

    new CreateSuccess({
      message: 'MoMo payment URL created successfully',
      metadata: paymentUrl,
    }).send(res);
  };
}

module.exports = new PaymentController();
