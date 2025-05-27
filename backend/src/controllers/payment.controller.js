'use strict';

const PaymentService = require('../services/payment.service');
const { CreateSuccess, NoContentSuccess } = require('../utils/successResponse');

class PaymentController {
  constructor() {
    this.paymentService = new PaymentService();
  }

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

  handleVNPayCallback = async (req, res) => {
    try {
      await this.paymentService.verifyVNPayCallback(req.query);
      res.redirect(process.env.FRONTEND_URL);
    } catch (error) {
      res.redirect(
        `${process.env.FRONTEND_URL}/error?message=${encodeURIComponent(
          error.message
        )}`
      );
    }
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

  handleMoMoCallback = async (req, res) => {
    try {
      await this.paymentService.verifyMoMoCallback(req.body);
      res.redirect(process.env.FRONTEND_URL);
    } catch (error) {
      res.redirect(
        `${process.env.FRONTEND_URL}/error?message=${encodeURIComponent(
          error.message
        )}`
      );
    }
  };
}

module.exports = new PaymentController();
