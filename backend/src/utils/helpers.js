'use strict';

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

module.exports = {
  convertToObjectIdMongodb,
  getRandomNumber,
  pickFields,
  omitFields,
  generateVariantSlug,
};
