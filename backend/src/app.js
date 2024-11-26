require('dotenv').config();
const colors = require('colors');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const xssClean = require('xss-clean');
const hpp = require('hpp');
const cors = require('cors');
const session = require('express-session');
const requestIp = require('request-ip');
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
const { createServer } = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const compressionOptions = require('./configs/compression.config');
const helmetOptions = require('./configs/helmet.config');
class App {
  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.port = process.env.PORT || 3000;

    this.initSocket();
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
    this.app.use(helmet(helmetOptions));
    this.app.use(requestIp.mw());
    this.app.use(rateLimit(limiter));
    this.app.use(xssClean());
    this.app.use(hpp());
    this.app.use(cors(corsOptions));
    this.app.use(express.json({ limit: '16kb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '16kb' }));
    this.app.use(cookieParser());
    this.app.use(compression(compressionOptions));
    this.app.use(
      session({
        secret: process.env.EXPRESS_SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
      })
    );
    this.app.use(passport.initialize());
    this.app.use(passport.session());
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

  initSocket() {
    const io = new Server(this.httpServer, {
      pingTimeout: 60000,
      cors: corsOptions,
    });

    this.app.set('io', io);
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
    const server = this.httpServer.listen(this.port, () => {
      logger.info(`⚙️  Server is running on port: ${this.port}`.yellow.bold);
    });

    process.on('SIGINT', () => {
      this.stopCronJobs();
      server.close(() => {
        logger.info('Process terminated'.red.bold);
      });
    });
  }
}

module.exports = App;
