const App = require('./app');

async function bootstrap() {
  const app = new App();
  app.startServer();
}

bootstrap();
