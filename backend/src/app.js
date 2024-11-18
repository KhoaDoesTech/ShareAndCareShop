require('dotenv').config();
const colors = require('colors');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const xssClean = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');

const passport = require('./helpers/passport.helper');
const corsOptions = require('./configs/cors.config');
const limiter = require('./configs/limiter.config');
const morganMiddleware = require('./configs/morgan.config');
const errorHandler = require('./middlewares/error.middleware');
const asyncHandler = require('./middlewares/async.middleware');
const { NotFoundError } = require('./utils/errorResponse');
const Database = require('./initializers/mongodb.init');
const JobManager = require('./jobs/jobManager');
const logger = require('./helpers/logger.helper');
const cleanTemporaryImages = require('./jobs/cleanTemporaryImages');

class App {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3000;

    this.initConfig();
    this.initMiddlewares();
    this.initRoutes();
    this.initErrorHandling();
    this.initCronJobs();
  }

  initConfig() {
    const database = new Database();
    database.connect();
  }

  initMiddlewares() {
    this.app.use(morganMiddleware);
    this.app.use(helmet());
    this.app.use(limiter);
    this.app.use(xssClean());
    this.app.use(hpp());
    this.app.use(cors(corsOptions));
    this.app.use(cookieParser());
    this.app.use(express.json({ limit: '10kb' }));
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(compression());

    this.app.use(passport.initialize());
  }

  initRoutes() {
    this.app.use('/', require('./routes/v1'));

    this.app.all(
      '*',
      asyncHandler(async () => {
        throw new NotFoundError('The requested resource was not found');
      })
    );
  }

  initErrorHandling() {
    this.app.use(errorHandler);
  }

  initCronJobs() {
    if (process.env.CLEAN_TEMP_IMAGES_JOB === 'true') {
      JobManager.addJob(cleanTemporaryImages);
      logger.info('cleanTemporaryImages job added');
    }

    JobManager.startAll();
  }

  stopCronJobs() {
    JobManager.stopAll();
  }

  startServer() {
    const server = this.app.listen(this.port, () => {
      console.log(`Server is running on port ${this.port}`.yellow.bold);
    });

    process.on('SIGINT', () => {
      this.stopCronJobs();
      server.close(() => {
        console.log('Process terminated'.red.bold);
      });
    });
  }
}

module.exports = App;
