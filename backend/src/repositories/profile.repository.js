'use strict';

const BaseRepository = require('./base.repository');
const profileModels = require('../models/profile.model');

class ProfileRepository extends BaseRepository {
  constructor() {
    super(profileModels);
    this.model = profileModels;
  }

  formatDocument(profile) {
    if (!profile) return null;

    const formattedProfile = {
      id: profile._id,
      userId: profile.usr_id,
      name: profile.prof_name,
      phone: profile.prof_phone,
      address: profile.prof_address.map((addr) => ({
        street: addr.adr_street,
        ward: addr.adr_ward,
        district: addr.adr_district,
        city: addr.adr_city,
        country: addr.adr_country,
        type: addr.adr_type,
      })),
    };

    return formattedProfile;
  }
}

module.exports = ProfileRepository;
