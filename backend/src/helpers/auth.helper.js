const {
  BadRequestError,
  UnauthorizedError,
  TokenExpiredError,
} = require('../utils/errorResponse');
const { verifyJWT } = require('./jwt.helper');

const getFromHeaders = (req, header) => {
  const value = req.headers[header];
  if (!value) throw new BadRequestError('Yêu cầu không hợp lệ');
  return value;
};

const validateToken = async (
  token,
  publicKey,
  userId,
  isRefreshToken = false
) => {
  try {
    const decodedToken = await verifyJWT(token, publicKey);
    if (userId !== decodedToken.userId) {
      throw new UnauthorizedError(`Token không hợp lệ`);
    }
  } catch (error) {
    handleTokenError(error, isRefreshToken);
  }
};

const handleTokenError = (error, isRefreshToken) => {
  if (error.name === 'TokenExpiredError') {
    if (isRefreshToken) {
      throw new UnauthorizedError(`Refresh token đã hết hạn`);
    }
    throw new TokenExpiredError(`Access token đã hết hạn`);
  } else {
    throw new UnauthorizedError(`Token không hợp lệ`);
  }
};

module.exports = {
  getFromHeaders,
  validateToken,
};
