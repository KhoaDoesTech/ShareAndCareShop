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
const MongoStore = require('connect-mongo');
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
const ChatSocketHandler = require('./sockets/chatSocket');
const ChatService = require('./services/chat.service');
const WHITELIST_DOMAINS = require('./constants/whiteList');

class App {
  constructor() {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.port = process.env.PORT || 3000;
    this.io = null;
    this.chatService = new ChatService();
    this.chatSocketHandler = null;

    this.initConfig();
    this.initSocket();
    this.initMiddlewares();
    this.initRoutes();
    this.initErrorHandling();
    this.initCronJobs();
  }

  initConfig() {
    const database = new Database();
    database.connect();
  }

  initSocket() {
    this.io = new Server(this.httpServer, {
      pingTimeout: 60000,
      pingInterval: 25000,
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
        skipMiddlewares: true,
      },
    });

    this.chatSocketHandler = new ChatSocketHandler(this.io, this.chatService);
    this.chatSocketHandler.initialize();

    this.app.set('io', this.io);
    this.app.set('chatSocketHandler', this.chatSocketHandler);

    this.io.use((socket, next) => {
      logger.info(`Socket attempting to connect: ${socket.id}`);
      next();
    });

    this.io.engine.on('connection_error', (err) => {
      logger.error('Socket connection error:', err);
    });

    logger.info('Socket.IO chat system initialized'.green.bold);
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
        store: MongoStore.create({
          mongoUrl: process.env.DB_URL,
          collectionName: 'sessions',
          ttl: 14 * 24 * 60 * 60, // 14 days
        }),
      })
    );
    this.app.use(passport.initialize());
    this.app.use(passport.session());
  }

  initRoutes() {
    this.app.use('/chat', express.static('public/chat'));
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
    const server = this.httpServer.listen(this.port, () => {
      logger.info(`⚙️  Server is running on port: ${this.port}`.yellow.bold);
      logger.info(
        `💬 Chat system available at: http://localhost:${this.port}/chat`.cyan
          .bold
      );
      logger.info(
        `📊 Chat status API: http://localhost:${this.port}/api/v1/chats/status`
          .cyan.bold
      );
    });

    process.on('SIGINT', () => {
      logger.info('Shutting down gracefully...'.yellow);
      this.stopCronJobs();
      server.close(() => {
        logger.info('Process terminated'.red.bold);
        process.exit(0);
      });
    });

    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully...'.yellow);
      this.stopCronJobs();
      server.close(() => {
        logger.info('Process terminated'.red.bold);
        process.exit(0);
      });
    });
  }

  getChatHandler() {
    return this.chatSocketHandler;
  }
}

module.exports = App;
