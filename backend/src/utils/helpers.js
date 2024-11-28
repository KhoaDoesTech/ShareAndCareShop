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

// Creates a mapping of variant options to their new indexes based on the updated variants.
const createVariantMapping = (newVariants, oldVariants) => {
  const mapping = new Map();

  newVariants.forEach((variant, variantIdx) => {
    variant.options.forEach((option, optionIdx) => {
      mapping.set(`${variant.name}_${option}`, optionIdx);
    });
  });

  return mapping;
};

// Generates all possible SKU combinations from the provided variants.
function generateAllCombinations(variants) {
  if (!variants || variants.length === 0) return [];

  // Use recursion to calculate all combinations
  const combine = (index, current) => {
    if (index === variants.length) {
      return [current];
    }

    return variants[index].options.flatMap((option) =>
      combine(index + 1, [...current, option])
    );
  };

  return combine(0, []);
}

const syncVariantsAndSkuList = (newVariants, newSkuList, oldVariants) => {
  if (!newVariants || !newSkuList)
    return { updatedVariants: oldVariants, syncedSkuData: [] };

  const variantMapping = createVariantMapping(newVariants);
  const allCombinations = generateAllCombinations(newVariants);

  const syncedSkuData = allCombinations.map((combination) => {
    const tierIndex = combination.map((option, idx) => {
      const variantName = newVariants[idx]?.name;
      return variantMapping.get(`${variantName}_${option}`) ?? -1;
    });

    const matchingSku = newSkuList.find(
      (sku) => JSON.stringify(sku.tierIndex) === JSON.stringify(tierIndex)
    );

    return {
      var_tier_idx: tierIndex,
      var_price: matchingSku?.price || 0,
      var_quantity: matchingSku?.quantity || 0,
      var_default: matchingSku?.isDefault || false,
      var_slug: generateVariantSlug(newVariants, tierIndex),
    };
  });

  return { updatedVariants: newVariants, syncedSkuData };
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

// const getVariantImageOrDefault = (
//   prd_variants,
//   tierIndex,
//   productMainImage
// ) => {
//   console.log(prd_variants, tierIndex, productMainImage);
//   if (tierIndex && prd_variants?.length) {
//     for (let i = 0; i < tierIndex.length; i++) {
//       const variant = prd_variants[i];
//       const imageIndex = tierIndex[i];

//       if (variant?.var_images?.[imageIndex]) {
//         return variant.var_images[imageIndex];
//       }
//     }
//   }

//   return productMainImage;
// };

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
};
