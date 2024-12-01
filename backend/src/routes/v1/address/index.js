'use strict';

const express = require('express');
const AddressController = require('../../../controllers/address.controller');
const asyncHandler = require('../../../middlewares/async.middleware');
const {
  authentication,
  verifyPermission,
} = require('../../../middlewares/auth.middleware');
const CONFIG_PERMISSIONS = require('../../../constants/permissions');

const router = express.Router();

router.get('/autocomplete', asyncHandler(AddressController.suggestAddresses));
router.get(
  '/coordinates',
  asyncHandler(AddressController.getAddressByCoordinates)
);
router.post('/', authentication, asyncHandler(AddressController.createAddress));
router.patch(
  '/',
  authentication,
  asyncHandler(AddressController.updateAddress)
);

router.delete(
  '/:addressId',
  authentication,
  asyncHandler(AddressController.deleteAddress)
);
router.patch(
  '/default/:addressId',
  authentication,
  asyncHandler(AddressController.setDefaultAddress)
);

router.get(
  '/default',
  authentication,
  asyncHandler(AddressController.getAddressDefault)
);

router.get('/', authentication, asyncHandler(AddressController.getAllAddress));

module.exports = router;
