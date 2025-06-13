const { generateKeyPair } = require('../helpers/crypto.helper');
const { generateTokenPair } = require('../helpers/jwt.helper');
const TokenRepository = require('../repositories/token.repository');
const UserRepository = require('../repositories/user.repository');
const { UnauthorizedError } = require('../utils/errorResponse');
const { pickFields } = require('../utils/helpers');

class TokenService {
  constructor() {
    this.userRespository = new UserRepository();
    this.tokenRespository = new TokenRepository();
  }

  async createTokensForDevice({ user, deviceToken, deviceName }) {
    // Generate key pair and token pair
    const { publicKey, privateKey } = await generateKeyPair();

    const tokens = await generateTokenPair(
      { userId: user.id, deviceToken },
      privateKey
    );

    // Check if token already exists
    const foundToken = await this.tokenRespository.getToken({
      userId: user.id,
      deviceToken,
    });

    // Define update payload
    let update = {};
    if (foundToken) {
      update = {
        $set: {
          tkn_public_key: publicKey,
          tkn_refresh_token: tokens.refreshToken,
        },
        $addToSet: {
          tkn_refresh_tokens_used: foundToken.refreshToken,
        },
      };
    } else {
      update = {
        tkn_user: user.id,
        tkn_device_name: deviceName,
        tkn_device_token: deviceToken,
        tkn_public_key: publicKey,
        tkn_refresh_token: tokens.refreshToken,
      };
    }

    // Upsert token into the repository
    const filter = {
      tkn_user: user.id,
      tkn_device_token: deviceToken,
    };
    await this.tokenRespository.createTokens({ filter, update });

    return tokens;
  }

  async refreshAccessToken({ user, keyStore }) {
    const { publicKey, privateKey } = await generateKeyPair();

    const tokens = await generateTokenPair(
      { userId: user.id, deviceToken: keyStore.deviceToken },
      privateKey
    );

    const filter = {
        tkn_user: user.id,
        tkn_device_token: keyStore.deviceToken,
      },
      update = {
        $set: {
          tkn_refresh_token: tokens.refreshToken,
          tkn_public_key: publicKey,
        },
        $addToSet: {
          tkn_refresh_tokens_used: keyStore.refreshToken,
        },
      };

    await this.tokenRespository.createTokens({ filter, update });

    return {
      user: pickFields({
        fields: ['id', 'avatar', 'email', 'name', 'phone'],
        object: user,
      }),
      tokens,
    };
  }

  async updateDeviceName({ user, deviceToken, deviceName }) {
    const filter = {
        tkn_user: user.id,
        tkn_device_token: deviceToken,
      },
      update = {
        $set: {
          tkn_device_name: deviceName,
        },
      };

    await this.tokenRespository.createTokens({ filter, update });

    return deviceName;
  }

  async deleteToken({ user, deviceToken }) {
    await this.tokenRespository.deleteToken({ userId: user.id, deviceToken });
  }

  async deleteAllTokens({ user, currentToken }) {
    const tokens = await this.tokenRespository.getAll({
      filter: {
        tkn_user: user.id,
      },
    });

    const tokensToDelete = tokens.filter(
      (token) => token.deviceToken !== currentToken
    );

    for (const token of tokensToDelete) {
      await this.tokenRespository.deleteToken({
        userId: user.id,
        deviceToken: token.deviceToken,
      });
    }
  }

  async getDeviceTokens({ user, currentToken }) {
    const tokens = await this.tokenRespository.getAll({
      filter: {
        tkn_user: user.id,
      },
    });

    return {
      tokens: tokens.map((token) => {
        const tokenData = pickFields({
          fields: ['deviceName', 'deviceToken'],
          object: token,
        });
        if (token.deviceToken === currentToken) {
          tokenData.isCurrent = true;
        }
        return tokenData;
      }),
    };
  }
}

module.exports = TokenService;
