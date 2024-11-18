const cron = require('node-cron');

const midnightJob = cron.schedule('0 0 * * *', () => {
  console.log(`Running a job at midnight: ${new Date().toLocaleString()}`);
  // Logic cụ thể cho job này
});

module.exports = midnightJob;
