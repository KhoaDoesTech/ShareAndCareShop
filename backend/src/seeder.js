require('dotenv').config();
const Database = require('./initializers/mongodb.init');
const DataInitializer = require('./initializers/data.init');
const logger = require('./helpers/logger.helper');

const database = new Database();
database.connect();

const importData = async () => {
  try {
    const dataInitializer = new DataInitializer();
    await dataInitializer.initializeData();

    logger.info('Data import completed successfully.');
    process.exit();
  } catch (error) {
    logger.error('Error importing data:', error);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    const dataInitializer = new DataInitializer();
    await dataInitializer.destroyData();

    logger.info('Data destroy completed successfully.');
    process.exit();
  } catch (error) {
    logger.error('Error destroying data:', error);
    process.exit(1);
  }
};

if (process.argv[2] === '--destroy') {
  destroyData();
} else {
  importData();
}
