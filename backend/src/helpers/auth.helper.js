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

const validateToken = async (token, user, userId) => {
  try {
    const decodedToken = await verifyJWT(token, user.publicKey);
    if (userId !== decodedToken.id) {
      throw new UnauthorizedError(`Invalid token`);
    }
  } catch (error) {
    handleTokenError(error, type);
  }
};

const handleTokenError = (error, type) => {
  if (error.name === 'TokenExpiredError') {
    throw new TokenExpiredError(
      `${type.charAt(0).toUpperCase() + type.slice(1)} token has expired`
    );
  } else {
    throw new UnauthorizedError(`Invalid ${type} token`);
  }
};

module.exports = {
  getFromHeaders,
  validateToken,
};
