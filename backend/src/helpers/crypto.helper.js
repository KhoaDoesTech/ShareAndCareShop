const bcrypt = require('bcrypt');
const crypto = require('crypto');
const SERVER_CONFIG = require('../configs/server.config');

const generateHashedPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

const generateKeyPair = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: 'pkcs1',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs1',
      format: 'pem',
    },
  });

  return { publicKey, privateKey };
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const generateTemporaryToken = () => {
  const unHashedToken = crypto.randomBytes(20).toString('hex');
  const hashedToken = hashToken(unHashedToken);

  // This is the expiry time for the token (20 minutes)
  const tokenExpiry = Date.now() + SERVER_CONFIG.user.temporaryTokenExpiry;

  return { unHashedToken, hashedToken, tokenExpiry };
};

const generateHmacHash = (data, secretKey) => {
  const hmac = crypto.createHmac('sha512', secretKey);
  return hmac.update(new Buffer.from(data, 'utf-8')).digest('hex');
};

const generateSessionToken = () => {
  return crypto.randomUUID();
};

module.exports = {
  generateKeyPair,
  generateHashedPassword,
  comparePassword,
  generateTemporaryToken,
  hashToken,
  generateHmacHash,
  generateSessionToken,
};
