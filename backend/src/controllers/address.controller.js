const {
  CreateSuccess,
  NoContentSuccess,
  ActionSuccess,
} = require('../utils/successResponse');
const AddressService = require('../services/address.service');
class AddressController {
  constructor() {
    this.addressService = new AddressService();
  }

  suggestAddresses = async (req, res, next) => {
    new ActionSuccess({
      message: 'Address suggestions fetched successfully',
      metadata: await this.addressService.getAddressSuggestions(req.query),
    }).send(res);
  };

  getAddressByCoordinates = async (req, res, next) => {
    new ActionSuccess({
      message: 'Address fetched successfully',
      metadata: await this.addressService.getAddressByCoordinates(req.query),
    }).send(res);
  };

  createAddress = async (req, res, next) => {
    new CreateSuccess({
      message: 'Address created successfully',
      metadata: await this.addressService.createAddress({
        ...req.body,
        userId: req.user.id,
      }),
    }).send(res);
  };

  updateAddress = async (req, res, next) => {
    new ActionSuccess({
      message: 'Address updated successfully',
      metadata: await this.addressService.updateAddress({
        ...req.body,
        userId: req.user.id,
      }),
    }).send(res);
  };

  deleteAddress = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Address deleted successfully',
      metadata: await this.addressService.deleteAddress({
        addressId: req.params.addressId,
        userId: req.user.id,
      }),
    }).send(res);
  };

  getAddressDefault = async (req, res, next) => {
    new ActionSuccess({
      message: 'Address fetched successfully',
      metadata: await this.addressService.getDefaultAddress({
        userId: req.user.id,
      }),
    }).send(res);
  };

  getAllAddress = async (req, res, next) => {
    new ActionSuccess({
      message: 'Addresses fetched successfully',
      metadata: await this.addressService.getAddresses({
        userId: req.user.id,
      }),
    }).send(res);
  };

  setDefaultAddress = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Default address set successfully',
      metadata: await this.addressService.setDefaultAddress({
        addressId: req.params.addressId,
        userId: req.user.id,
      }),
    }).send(res);
  };
}

module.exports = new AddressController();
