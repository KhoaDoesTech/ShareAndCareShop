const tokensModels = require('../models/token.model');
const BaseRepository = require('./base.repository');

class TokenRepository extends BaseRepository {
  constructor() {
    super(tokensModels);
    this.model = tokensModels;
  }

  async createTokens({ filter, update }) {
    const token = await this.model.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
    });

    return this.formatDocument(token);
  }

  async deleteToken({ userId, deviceToken }) {
    const token = await this.model.findOneAndDelete({
      tkn_user: userId,
      tkn_device_token: deviceToken,
    });

    return this.formatDocument(token);
  }

  async deleteAllTokens({ userId }) {
    const tokens = await this.model.deleteMany({ tkn_user: userId });

    return tokens;
  }

  async getToken({ userId, deviceToken }) {
    const token = await this.model
      .findOne({
        tkn_user: userId,
        tkn_device_token: deviceToken,
      })
      .lean();

    return this.formatDocument(token);
  }

  formatDocument(token) {
    if (!token) return null;

    return {
      id: token._id,
      user: token.tkn_user,
      deviceName: token.tkn_device_name,
      deviceToken: token.tkn_device_token,
      publicKey: token.tkn_public_key,
      refreshToken: token.tkn_refresh_token,
      refreshTokensUsed: token.tkn_refresh_tokens_used,
      createdAt: token.createdAt,
      updatedAt: token.updatedAt,
    };
  }
}

module.exports = TokenRepository;
