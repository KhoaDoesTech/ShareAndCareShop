'use strict';

const express = require('express');
const DeliveryController = require('../../../controllers/delivery.controller');
const {
  authentication,
  verifyPermission,
} = require('../../../middlewares/auth.middleware');
const CONFIG_PERMISSIONS = require('../../../constants/permissions');
const asyncHandler = require('../../../middlewares/async.middleware');

const router = express.Router();

router.post(
  '/',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SETTING.DELIVERY_TYPE.CREATE),
  asyncHandler(DeliveryController.createDelivery)
);

router.get('/', asyncHandler(DeliveryController.getDeliveryFees));
router.get('/fee', asyncHandler(DeliveryController.calculateDeliveryFee));

router.get(
  '/all',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SETTING.DELIVERY_TYPE.VIEW),
  asyncHandler(DeliveryController.getDeliveries)
);
router.get(
  '/:deliveryId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SETTING.DELIVERY_TYPE.VIEW),
  asyncHandler(DeliveryController.getDelivery)
);
router.patch(
  '/:deliveryId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SETTING.DELIVERY_TYPE.UPDATE),
  asyncHandler(DeliveryController.updateDelivery)
);
router.patch(
  '/activate/:deliveryId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SETTING.DELIVERY_TYPE.UPDATE),
  asyncHandler(DeliveryController.activateDelivery)
);
router.patch(
  '/deactivate/:deliveryId',
  authentication,
  verifyPermission(CONFIG_PERMISSIONS.SETTING.DELIVERY_TYPE.UPDATE),
  asyncHandler(DeliveryController.deactivateDelivery)
);

module.exports = router;
