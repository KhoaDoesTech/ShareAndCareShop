const cron = require('node-cron');

const minuteJob = cron.schedule('* * * * *', () => {
  console.log(`Running a job every minute: ${new Date().toLocaleString()}`);
  // Logic cụ thể cho job này
});

module.exports = minuteJob;
