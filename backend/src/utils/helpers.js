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

const parseJwt = (token) => {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
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

const extractPublicIdFromUrl = (url) => {
  if (!url) return null;
  const parts = url.split('/');
  const publicId = parts.slice(-3).join('/').split('.')[0];

  return publicId;
};

const removeUndefinedObject = (object) => {
  Object.keys(object).forEach((key) => {
    if (object[key] === undefined || object[key] === null) delete object[key];
  });

  return object;
};

const updateNestedObjectParser = (obj) => {
  const final = {};
  Object.keys(obj).forEach((i) => {
    if (typeof obj[i] === 'object' && !Array.isArray(obj[i])) {
      const response = updateNestedObjectParser(obj[i]);
      Object.keys(obj[i]).forEach((j) => {
        final[`${i}.${j}`] = response[j];
      });
    } else {
      final[i] = obj[i];
    }
  });

  return final;
};

const getVariantImagesFromTierIndex = (variants, tierIndex) => {
  if (!variants || !tierIndex) return [];
  return tierIndex
    .map((idx, level) => variants[level]?.var_images?.[idx] || null)
    .filter(Boolean);
};

const getVariantImageOrDefault = (variants, tierIndex, mainImage) => {
  if (!Array.isArray(variants) || !tierIndex || tierIndex.length === 0)
    return mainImage;

  let selectedImage = mainImage;

  variants.forEach((variant, index) => {
    const selectedIndex = tierIndex[index];

    if (
      selectedIndex !== undefined &&
      variant.var_images &&
      variant.var_images[selectedIndex]
    ) {
      selectedImage = variant.var_images[selectedIndex];
    }
  });

  return selectedImage;
};

const sortObject = (obj) => {
  let sorted = {};
  let str = [];
  let key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, '+');
  }
  return sorted;
};

const listResponse = ({ items, total, page, size }) => {
  const totalPages = Math.ceil(total / size);
  const hasMore = page < totalPages;

  return {
    total,
    totalPages,
    page,
    size,
    hasMore,
    items,
  };
};

module.exports = {
  convertToObjectIdMongodb,
  getRandomNumber,
  pickFields,
  omitFields,
  generateVariantSlug,
  removeLocalFile,
  removeUndefinedObject,
  updateNestedObjectParser,
  extractPublicIdFromUrl,
  getVariantImagesFromTierIndex,
  getVariantImageOrDefault,
  parseJwt,
  sortObject,
  listResponse,
};
