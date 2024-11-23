const {
  BadRequestError,
  UnauthorizedError,
  TokenExpiredError,
} = require('../utils/errorResponse');
const { verifyJWT } = require('./jwt.helper');

const getFromHeaders = (req, header) => {
  const value = req.headers[header];
  if (!value) throw new BadRequestError('Invalid Request');
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
      throw new UnauthorizedError(`Invalid token`);
    }
  } catch (error) {
    handleTokenError(error, isRefreshToken);
  }
};

const handleTokenError = (error, isRefreshToken) => {
  if (error.name === 'TokenExpiredError') {
    if (isRefreshToken) {
      throw new UnauthorizedError(`Refresh token has expired`);
    }
    throw new TokenExpiredError(`Access token has expired`);
  } else {
    throw new UnauthorizedError(`Invalid token`);
  }
};

module.exports = {
  getFromHeaders,
  validateToken,
};
