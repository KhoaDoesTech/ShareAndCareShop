const mongoose = require('mongoose');
const SERVER_CONFIG = require('../configs/server.config');
const logger = require('../helpers/logger.helper');

class Database {
  constructor() {
    this.connectString = `${SERVER_CONFIG.db.url}`;
  }

  connect() {
    mongoose.set('debug', true);
    mongoose.set('debug', { color: true });
    mongoose.set('debug', { shell: true });

    mongoose
      .connect(this.connectString, {
        maxPoolSize: 50,
        useNewUrlParser: true,
        useUnifiedTopology: true,
      })
      .then(() => logger.info('Connected Mongodb Success'.green))
      .catch((err) => logger.error(`Error Connect::: ${err}`.red));
  }
}

module.exports = Database;
