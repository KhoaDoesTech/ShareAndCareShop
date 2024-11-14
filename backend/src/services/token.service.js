const { generateKeyPair } = require('../helpers/crypto.helper');
const { generateTokenPair } = require('../helpers/jwt.helper');
const userRepository = require('../repositories/user.repository');
const { UnauthorizedError } = require('../utils/errorResponse');

class TokenService {
  constructor() {
    this.userRespository = new userRepository();
  }

  async createTokens(user) {
    const { publicKey, privateKey } = await generateKeyPair();

    const tokens = await generateTokenPair(
      { id: user.id, email: user.email, permissions: user.permissions },
      privateKey
    );

    await this.userRespository.updateById(user.id, {
      public_key: publicKey,
      refresh_token: tokens.refreshToken,
    });

    return tokens;
  }

  async refreshAccessToken({ refreshToken, user }) {
    if (!refreshToken) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const tokens = await this.createTokens(user);

    await this.userRespository.updateById(user.id, {
      $addToSet: {
        refresh_tokens_used: refreshToken,
      },
    });

    return { tokens };
  }
}

module.exports = TokenService;
