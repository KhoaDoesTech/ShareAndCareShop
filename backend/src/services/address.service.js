'use strict';
const { AddressType } = require('../constants/status');
const { generateSessionToken } = require('../helpers/crypto.helper');
const AddressRepository = require('../repositories/address.repository');
const { BadRequestError } = require('../utils/errorResponse');
const axios = require('axios');
const {
  pickFields,
  omitFields,
  removeUndefinedObject,
  updateNestedObjectParser,
} = require('../utils/helpers');
const UserRepository = require('../repositories/user.repository');
const { filter } = require('lodash');

class AddressService {
  constructor() {
    this.addressRepository = new AddressRepository();
    this.userRepository = new UserRepository();
  }

  async getAddressSuggestions({ query, sessionToken }) {
    if (!query)
      throw new BadRequestError('Vui lòng nhập từ khóa để tìm kiếm địa chỉ');

    const session = sessionToken || generateSessionToken();

    const response = await axios.get(
      'https://rsapi.goong.io/Place/AutoComplete',
      {
        params: {
          api_key: process.env.GOONG_API_KEY,
          input: query,
          sessiontoken: session,
        },
      }
    );

    if (response.data.status !== 'OK') {
      throw new BadRequestError('Hệ thống Goong API trả về lỗi');
    }
    console.log(response.data.predictions[0]);
    return response.data.predictions.map((prediction) => ({
      placeId: prediction.place_id,
      description: prediction.description,
      street: prediction.structured_formatting.main_text,
      compound: {
        ward: prediction.compound.commune,
        district: prediction.compound.district,
        city: prediction.compound.province,
      },
    }));
  }

  async getAddressByCoordinates({ lat, lng }) {
    const response = await axios.get('https://rsapi.goong.io/geocode', {
      params: {
        api_key: process.env.GOONG_API_KEY,
        latlng: `${lat},${lng}`,
      },
    });

    if (response.data.status !== 'OK') {
      throw new BadRequestError('Hệ thống Goong API trả về lỗi');
    }

    return response.data.results.map((result) => ({
      placeId: result.place_id,
      description: result.formatted_address,
      compound: {
        ward: result.compound.commune,
        district: result.compound.district,
        city: result.compound.province,
      },
    }));
  }

  async calculateDistance(destinationId) {
    const foundAdmin = await this.userRepository.getAdmin();
    if (!foundAdmin) throw new BadRequestError('Không tìm thấy quản trị viên');

    const foundOrigin = await this.addressRepository.getByQuery({
      usr_id: foundAdmin.id,
      adr_type: AddressType.DEFAULT,
    });
    if (!foundOrigin) throw new BadRequestError('Không tìm thấy địa chỉ gốc');

    const foundDestination = await this.getPlaceDetailsById({
      placeId: destinationId,
    });
    if (!foundDestination)
      throw new BadRequestError('Không tìm thấy địa chỉ đích');

    const distanceMatrix = await this.getDistanceMatrix({
      origins: foundOrigin.location,
      destinations: foundDestination.geometry.location,
    });

    return distanceMatrix;
  }

  async getDistanceMatrix({ origins, destinations }) {
    const response = await axios.get('https://rsapi.goong.io/distancematrix', {
      params: {
        api_key: process.env.GOONG_API_KEY,
        origins: `${origins.lat},${origins.lng}`,
        destinations: `${destinations.lat},${destinations.lng}`,
        vehicle: 'car',
      },
    });

    return response.data.rows[0].elements[0].distance.value / 1000;
  }

  async getPlaceDetailsById({ placeId }) {
    const response = await axios.get('https://rsapi.goong.io/place/detail', {
      params: {
        api_key: process.env.GOONG_API_KEY,
        place_id: placeId,
      },
    });

    if (response.data.status !== 'OK') {
      throw new BadRequestError('Hệ thống Goong API trả về lỗi');
    }

    return response.data.result;
  }

  async getPlaceDetails({ street, ward, district, city }) {
    const response = await axios.get('https://rsapi.goong.io/geocode', {
      params: {
        api_key: process.env.GOONG_API_KEY,
        address: `${street}, ${ward}, ${district}, ${city}`,
      },
    });

    if (response.data.status !== 'OK') {
      throw new BadRequestError('Hệ thống Goong API trả về lỗi');
    }

    return response.data.results.map((result) => ({
      placeId: result.place_id,
      coordinates: result.geometry.location,
    }));
  }

  async createAddress({ userId, name, phone, street, ward, district, city }) {
    // Validate input parameters to ensure required fields are provided
    if (!userId || !name || !phone || !street || !ward || !district || !city) {
      throw new BadRequestError('Thiếu thông tin địa chỉ bắt buộc');
    }

    const placeDetails = await this.getPlaceDetails({
      street,
      ward,
      district,
      city,
    });

    // Check if the place details API returned valid results
    if (!placeDetails || placeDetails.length === 0) {
      throw new BadRequestError(
        'Không tìm thấy thông tin vị trí cho địa chỉ đã nhập'
      );
    }

    const existingAddress = await this.addressRepository.getByQuery({
      usr_id: userId,
      adr_type: AddressType.DEFAULT,
    });

    let addressType = AddressType.SHIPPING;
    if (!existingAddress) {
      // If no existing address, make this the default
      addressType = AddressType.DEFAULT;

      // Update user's phone number if different
      const foundUser = await this.userRepository.getById(userId);

      if (!foundUser.phone) {
        await this.userRepository.updateById(foundUser.id, {
          usr_phone: phone,
        });
      }
    }

    const place = placeDetails[0];

    const newAddress = await this.addressRepository.create({
      usr_id: userId,
      usr_name: name,
      usr_phone: phone,
      adr_place_id: place.placeId,
      adr_street: street,
      adr_ward: ward,
      adr_district: district,
      adr_city: city,
      adr_location: {
        lat: place.coordinates.lat,
        lng: place.coordinates.lng,
      },
      adr_type: addressType,
    });

    return omitFields({
      fields: ['userId', 'createdAt', 'updatedAt'],
      object: newAddress,
    });
  }

  async getDefaultAddress({ userId }) {
    const address = await this.addressRepository.getByQuery({
      usr_id: userId,
      adr_type: AddressType.DEFAULT,
    });

    return omitFields({
      fields: ['userId', 'createdAt', 'updatedAt'],
      object: address,
    });
  }

  async getAddresses({ userId }) {
    const addresses = await this.addressRepository.getAll({
      filter: {
        usr_id: userId,
      },
    });

    addresses.sort((a, b) => {
      if (a.type === AddressType.DEFAULT) return -1;
      if (b.type === AddressType.DEFAULT) return 1;
      return 0;
    });

    return addresses.map((address) =>
      omitFields({
        fields: ['userId', 'createdAt', 'updatedAt'],
        object: address,
      })
    );
  }

  async updateAddress({
    addressId,
    name,
    phone,
    street,
    ward,
    district,
    city,
  }) {
    // Step 1: Get existing address for reference
    const foundAddress = await this.addressRepository.getById(addressId);
    if (!foundAddress) throw new BadRequestError('Không tìm thấy địa chỉ');

    // Step 2: Prepare updated address fields
    const updatedFields = {
      street: street || foundAddress.street,
      ward: ward || foundAddress.ward,
      district: district || foundAddress.district,
      city: city || foundAddress.city,
    };

    // Step 3: Get place details for the updated address
    let updatedLocation = null;
    if (street || ward || district || city) {
      const placeDetails = await this.getPlaceDetails(updatedFields);
      if (!placeDetails || placeDetails.length === 0) {
        throw new BadRequestError(
          'Không thể lấy thông tin vị trí cho địa chỉ đã cập nhật'
        );
      }

      const place = placeDetails[0];
      updatedLocation = {
        lat: place.coordinates.lat,
        lng: place.coordinates.lng,
      };
    }

    // Step 4: Prepare data for database update
    const updateData = removeUndefinedObject({
      usr_name: name,
      usr_phone: phone,
      adr_street: street,
      adr_ward: ward,
      adr_district: district,
      adr_city: city,
      adr_location: updatedLocation,
    });

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestError('Không có trường hợp lệ để cập nhật');
    }

    // Step 5: Flatten the update data for MongoDB
    const parsedUpdateData = updateNestedObjectParser(updateData);

    // Step 6: Perform the database update
    const updatedAddress = await this.addressRepository.updateById(
      addressId,
      parsedUpdateData
    );

    return omitFields({
      fields: ['placeId', 'createdAt', 'updatedAt'],
      object: updatedAddress,
    });
  }

  async setDefaultAddress({ addressId, userId }) {
    const currentDefault = await this.addressRepository.getByQuery({
      usr_id: userId,
      adr_type: AddressType.DEFAULT,
    });

    if (currentDefault) {
      await this.addressRepository.updateById(currentDefault.id, {
        adr_type: AddressType.SHIPPING,
      });
    }

    await this.addressRepository.updateById(addressId, {
      adr_type: AddressType.DEFAULT,
    });
  }

  async deleteAddress({ userId, addressId }) {
    const foundAddress = await this.addressRepository.getByQuery({
      _id: addressId,
      usr_id: userId,
    });
    if (!foundAddress) throw new BadRequestError('Không tìm thấy địa chỉ');

    if (foundAddress.type === AddressType.DEFAULT) {
      throw new BadRequestError('Không thể xóa địa chỉ mặc định');
    }

    await this.addressRepository.deleteById(foundAddress.id);
  }
}

module.exports = AddressService;
