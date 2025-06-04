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

  confirmCODPayment = async (req, res, next) => {
    new ActionSuccess({
      message: 'COD payment confirmed successfully',
      metadata: await this.paymentService.confirmCODPayment({
        orderId: req.params.orderId,
        adminId: req.user.id,
        cashReceived: req.body.cashReceived || false,
      }),
    }).send(res);
  };

  processManualRefund = async (req, res, next) => {
    new ActionSuccess({
      message: 'Manual refund processed successfully',
      metadata: await this.paymentService.processManualRefund({
        paymentTransactionId: req.params.paymentTransactionId,
        refundIds: req.body.refundIds || [],
        adminId: req.user.id,
        bankName: req.body.bankName,
        accountNumber: req.body.accountNumber,
        accountHolder: req.body.accountHolder,
        transferImage: req.body.transferImage,
        isCashRefund: req.body.isCashRefund || false,
      }),
    }).send(res);
  };
}

module.exports = new PaymentController();
