const SERVER_CONFIG = {
  env: process.env.NODE_ENV,
  app: {
    port: process.env.PORT || 3000,
    url: process.env.BACKEND_LINK || 'http://localhost:3000/',
  },
  db: {
    url: process.env.DB_URL,
  },
  jwt: {
    accessExpire: '1d',
    refreshExpire: '10d',
  },
  user: {
    temporaryTokenExpiry: 20 * 60 * 1000, // 20 minutes
  },
  img: {
    product: 'https://via.placeholder.com/200x200.png',
    avatar: 'https://via.placeholder.com/200x200.png',
  },
};

module.exports = SERVER_CONFIG;
