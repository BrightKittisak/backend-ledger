const mongoose = require('mongoose');

const { logger } = require('../logger/logger');
const { prepareDatabase } = require('./prepare-database');

async function connectToDatabase(uri) {
  await mongoose.connect(uri);
  await prepareDatabase();
  logger.info('Connected to MongoDB');
}

module.exports = {
  connectToDatabase,
};
