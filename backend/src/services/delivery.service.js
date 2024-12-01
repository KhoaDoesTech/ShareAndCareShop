const { generateSessionToken } = require('../helpers/crypto.helper');
const { BadRequestError } = require('../utils/errorResponse');
const axios = require('axios');
class AddressService {
  constructor() {}

  async getAddressSuggestions({ query, sessionToken }) {
    if (!query)
      throw new BadRequestError(
        'Please provide a query to search for addresses'
      );

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
      throw new BadRequestError('Goong API returned an error');
    }

    return response.data.predictions.map((prediction) => ({
      id: prediction.place_id,

      description: prediction.description,
      compound: {
        ward: prediction.compound.commune,
        district: prediction.compound.district,
        city: prediction.compound.province,
      },
    }));
  }
}

module.exports = AddressService;
