'use strict';

const addressModels = require('../models/address.model');
const BaseRepository = require('./base.repository');

class AddressRepository extends BaseRepository {
  constructor() {
    super(addressModels);
    this.model = addressModels;
  }

  formatDocument(address) {
    if (!address) return null;

    return {
      id: address._id,
      userId: address.usr_id,
      name: address.usr_name,
      phone: address.usr_phone,
      placeId: address.adr_place_id,
      street: address.adr_street,
      ward: address.adr_ward,
      district: address.adr_district,
      city: address.adr_city,
      location: {
        lat: address.adr_location.lat,
        lng: address.adr_location.lng,
      },
      type: address.adr_type,
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    };
  }
}

module.exports = AddressRepository;
