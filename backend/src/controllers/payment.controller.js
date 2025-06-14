'use strict';

const PaymentService = require('../services/payment.service');
const {
  CreateSuccess,
  NoContentSuccess,
  ActionSuccess,
} = require('../utils/successResponse');

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
      message: 'Tạo liên kết thanh toán VNPay thành công',
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
      message: 'Tạo liên kết thanh toán MoMo thành công',
      metadata: paymentUrl,
    }).send(res);
  };

  confirmCODPayment = async (req, res, next) => {
    new ActionSuccess({
      message: 'Xác nhận thanh toán COD thành công',
      metadata: await this.paymentService.confirmCODPayment({
        orderId: req.params.orderId,
        adminId: req.user.id,
      }),
    }).send(res);
  };

  processManualRefund = async (req, res, next) => {
    new ActionSuccess({
      message: 'Hoàn tiền thủ công thành công',
      metadata: await this.paymentService.processManualRefund({
        paymentTransactionId: req.params.paymentTransactionId,
        adminId: req.user.id,
        bankName: req.body.bankName,
        accountNumber: req.body.accountNumber,
        accountHolder: req.body.accountHolder,
        transferImage: req.body.transferImage,
      }),
    }).send(res);
  };

  processManualPayment = async (req, res, next) => {
    new ActionSuccess({
      message: 'Thanh toán thủ công thành công',
      metadata: await this.paymentService.processManualPayment({
        orderId: req.params.orderId,
        adminId: req.user.id,
        bankName: req.body.bankName,
        accountNumber: req.body.accountNumber,
        accountHolder: req.body.accountHolder,
        transferImage: req.body.transferImage,
      }),
    }).send(res);
  };

  getTransactionDetail = async (req, res) => {
    new ActionSuccess({
      message: 'Lấy chi tiết giao dịch thành công',
      metadata: await this.paymentService.getTransactionDetails(
        req.params.transactionId
      ),
    }).send(res);
  };

  getTransactionsByAdmin = async (req, res) => {
    new ActionSuccess({
      message: 'Lấy danh sách giao dịch thành công',
      metadata: await this.paymentService.getTransactionByAdmin(req.query),
    }).send(res);
  };
}

module.exports = new PaymentController();
