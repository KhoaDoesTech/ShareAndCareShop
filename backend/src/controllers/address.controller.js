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
      message: 'Gợi ý địa chỉ thành công',
      metadata: await this.addressService.getAddressSuggestions(req.query),
    }).send(res);
  };

  getAddressByCoordinates = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy địa chỉ theo tọa độ thành công',
      metadata: await this.addressService.getAddressByCoordinates(req.query),
    }).send(res);
  };

  createAddress = async (req, res, next) => {
    new CreateSuccess({
      message: 'Tạo địa chỉ thành công',
      metadata: await this.addressService.createAddress({
        ...req.body,
        userId: req.user.id,
      }),
    }).send(res);
  };

  updateAddress = async (req, res, next) => {
    new ActionSuccess({
      message: 'Cập nhật địa chỉ thành công',
      metadata: await this.addressService.updateAddress({
        ...req.body,
        userId: req.user.id,
      }),
    }).send(res);
  };

  deleteAddress = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Xóa địa chỉ thành công',
      metadata: await this.addressService.deleteAddress({
        addressId: req.params.addressId,
        userId: req.user.id,
      }),
    }).send(res);
  };

  getAddressDefault = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy địa chỉ mặc định thành công',
      metadata: await this.addressService.getDefaultAddress({
        userId: req.user.id,
      }),
    }).send(res);
  };

  getAllAddress = async (req, res, next) => {
    new ActionSuccess({
      message: 'Lấy danh sách địa chỉ thành công',
      metadata: await this.addressService.getAddresses({
        userId: req.user.id,
      }),
    }).send(res);
  };

  setDefaultAddress = async (req, res, next) => {
    new NoContentSuccess({
      message: 'Đặt địa chỉ mặc định thành công',
      metadata: await this.addressService.setDefaultAddress({
        addressId: req.params.addressId,
        userId: req.user.id,
      }),
    }).send(res);
  };
}

module.exports = new AddressController();
