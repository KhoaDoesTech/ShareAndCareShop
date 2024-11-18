const logger = require('../helpers/logger.helper');

class JobManager {
  constructor() {
    this.jobs = [];
  }

  addJob(job) {
    this.jobs.push(job);
  }

  startAll() {
    this.jobs.forEach((job) => job.start());
    logger.info('All jobs started');
  }

  stopAll() {
    this.jobs.forEach((job) => job.stop());
    logger.info('All jobs stopped');
  }
}

module.exports = new JobManager();
