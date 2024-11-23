'use strict';

const JWT = require('jsonwebtoken');
const SERVER_CONFIG = require('../configs/server.config');

const verifyJWT = async (token, keySecret) => {
  return await JWT.verify(token, keySecret);
};

const generateTokenPair = async (payload, privateKey) => {
  const accessToken = await JWT.sign(
    {
      userId: payload.userId,
      deviceToken: payload.deviceToken,
    },
    privateKey,
    {
      algorithm: 'RS256',
      expiresIn: SERVER_CONFIG.jwt.accessExpire,
    }
  );

  const refreshToken = await JWT.sign(
    { userId: payload.userId, deviceToken: payload.deviceToken },
    privateKey,
    {
      algorithm: 'RS256',
      expiresIn: SERVER_CONFIG.jwt.refreshExpire,
    }
  );

  return { accessToken, refreshToken };
};

module.exports = {
  verifyJWT,
  generateTokenPair,
};
