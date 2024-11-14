'use strict';

const fs = require('fs');
const logger = require('../helpers/logger.helper');
const { Types } = require('mongoose');
const _ = require('lodash');

const convertToObjectIdMongodb = (id) => new Types.ObjectId(id);

const pickFields = ({ fields = [], object = {} }) => {
  return _.pick(object, fields);
};

const omitFields = ({ fields = [], object = {} }) => {
  return _.omit(object, fields);
};

const getRandomNumber = (max) => {
  return Math.floor(Math.random() * max);
};

const generateVariantSlug = (variants, tierIndex) => {
  return tierIndex
    .map((index, i) => (variants[i] ? variants[i].options[index] : ''))
    .join('/');
};

const removeLocalFile = (localPath) => {
  fs.unlink(localPath, (err) => {
    if (err) logger.error('Error while removing local files: ', err);
    else {
      logger.info('Removed local: ', localPath);
    }
  });
};

module.exports = {
  convertToObjectIdMongodb,
  getRandomNumber,
  pickFields,
  omitFields,
  generateVariantSlug,
  removeLocalFile,
};
