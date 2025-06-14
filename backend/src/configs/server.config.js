const SERVER_CONFIG = {
  env: process.env.NODE_ENV,
  app: {
    port: process.env.PORT || 3000,
    url: process.env.BACKEND_URL || 'http://localhost:3000',
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
    product: 'https://via.placeholder.com/900x1200.png',
    avatar: 'https://via.placeholder.com/400x400.png',
  },
  openAi: {
    API_KEY: process.env.OPENAI_API_KEY,
  },
  qdrant: {
    URL: process.env.QDRANT_URL || 'http://localhost:6333',
    API_KEY: process.env.QDRANT_API_KEY || '',
    COLLECTION_NAME: process.env.QDRANT_COLLECTION || 'product_vectors',
  },
};

module.exports = SERVER_CONFIG;
