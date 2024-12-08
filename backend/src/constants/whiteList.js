const SERVER_CONFIG = require('../configs/server.config');

const WHITELIST_DOMAINS = [
  'http://localhost:3000',
  'http://localhost:3030',
  'http://localhost:3031',
];

if (SERVER_CONFIG.env === 'production') {
  WHITELIST_DOMAINS.push(process.env.FRONTEND_URL);
  WHITELIST_DOMAINS.push(process.env.ADMIN_PANEL_URL);
  WHITELIST_DOMAINS.push(process.env.BACKEND_URL);
}

module.exports = WHITELIST_DOMAINS;
