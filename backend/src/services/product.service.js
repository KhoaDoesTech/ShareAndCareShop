'use strict';
const { ProductStatus, SortFieldProduct } = require('../constants/status');
const AttributeRepository = require('../repositories/attribute.repository');
const AttributeValueRepository = require('../repositories/attributeValue.repository');
const CategoryRepository = require('../repositories/category.repository');
const ProductRepository = require('../repositories/product.repository');
const VariantRepository = require('../repositories/variant.repository');
const { BadRequestError } = require('../utils/errorResponse');
const {
  omitFields,
  removeUndefinedObject,
  updateNestedObjectParser,
  pickFields,
  convertToObjectIdMongodb,
  generateVariantSlug,
} = require('../utils/helpers');
const UploadService = require('./upload.service');

class ProductService {
  constructor() {
    this.productRepository = new ProductRepository();
    this.variantRepository = new VariantRepository();
    this.categoryRepository = new CategoryRepository();
    this.attributeRepository = new AttributeRepository();
    this.attributeValueRepository = new AttributeValueRepository();
    this.uploadService = new UploadService();
  }

  async createProduct({
    userId,
    name,
    video,
    returnDays,
    description,
    mainImage,
    subImages = [],
    originalPrice,
    discountType,
    discountValue,
    discountStart,
    discountEnd,
    category = [],
    attributes = [],
    variants = [],
    skuList = [],
  }) {
    // Generate productId
    const productId = `PRD_${Math.floor(Date.now() / 1000)}`;

    // Validate category and retrieve data
    const updatedCategories = await this._validateCategories(category);
    console.log(attributes);
    const updatedAttributes = await this._validateAttributes(attributes);

    // Calculate minPrice and maxPrice from skuList
    let minPrice, maxPrice;
    if (skuList.length) {
      const prices = skuList.map((sku) => sku.price);
      minPrice = Math.min(...prices);
      maxPrice = Math.max(...prices);
    } else {
      minPrice = originalPrice;
      maxPrice = originalPrice;
    }

    // Merge subImages with variant images
    const variantImages = variants.flatMap(({ images = [] }) => images);
    const updatedSubImages = Array.from(
      new Set([...subImages, ...variantImages])
    );

    const qrCodeUrl = await this.uploadService.uploadQRCode({
      text: `${process.env.FRONTEND_URL}/product/${productId}`,
    });

    const newProduct = await this.productRepository.create({
      prd_code: productId,
      prd_name: name,
      prd_main_image: mainImage,
      prd_sub_images: updatedSubImages,
      prd_qr_code: qrCodeUrl,
      prd_original_price: variants.length ? undefined : originalPrice,
      prd_min_price: minPrice,
      prd_max_price: maxPrice,
      prd_discount_type: discountType,
      prd_discount_value: discountValue,
      prd_discount_start: discountStart,
      prd_discount_end: discountEnd,
      prd_description: description,
      prd_category: updatedCategories,
      prd_attributes: updatedAttributes,
      prd_variants: variants
        ? variants.map((variant) => ({
            var_name: variant.name,
            var_images: variant.images,
            var_options: variant.options,
          }))
        : [],
      prd_video: video,
      return_days: returnDays,
      createdBy: userId,
      updatedBy: userId,
    });

    if (!newProduct) throw new BadRequestError('Failed to create product');

    const convertSkuList = skuList.map((sku, index) => ({
      prd_id: newProduct.id,
      prd_name: newProduct.name,
      var_tier_idx: sku.tierIndex,
      var_default: sku.isDefault,
      var_slug: generateVariantSlug(variants, sku.tierIndex),
      var_price: sku.price,
      createdBy: userId,
      updatedBy: userId,
    }));

    const variant = await this.variantRepository.create(convertSkuList);
    if (!variant) throw new BadRequestError('Failed to create variant');

    this.uploadService.deleteUsedImages([mainImage, ...subImages, qrCodeUrl]);

    return pickFields({
      fields: ['code'],
      object: newProduct,
    });
  }

  // Update product
  async updateProduct({
    productId,
    name,
    mainImage,
    subImages,
    price,
    originalPrice,
    quantity,
    description,
    category,
    attributes,
    variants,
    skuList,
    status,
  }) {
    // Step 1: Check if product exists
    const foundProduct = await this.productRepository.getById(productId);
    if (!foundProduct) throw new BadRequestError('Product not found');

    // Step 2: Validate and fetch categories
    const updatedCategories = await this._validateCategories(
      category || foundProduct.prd_category
    );

    // Step 3: Handle variants update
    let updatedVariants = foundProduct.variants || [];
    if (variants) {
      updatedVariants = this.variantService._formatVariants(variants);
    }
    if (skuList.length) {
      await this.variantService.updateVariants({
        product: foundProduct,
        variants: updatedVariants,
        skuList,
      });
    }

    // Step 4: Calculate total quantity
    const totalQuantity = skuList.length
      ? skuList.reduce((total, sku) => total + (sku.quantity || 0), 0)
      : quantity || foundProduct.quantity;

    console.log(totalQuantity);

    // Step 5: Merge subImages with variant images
    const variantImages = updatedVariants.flatMap(({ images }) => images || []);
    const updatedSubImages = Array.from(
      new Set([...(subImages || foundProduct.subImages), ...variantImages])
    );

    // Step 6: Prepare update data
    const updateData = removeUndefinedObject({
      prd_name: name,
      prd_main_image: mainImage,
      prd_sub_images: updatedSubImages,
      prd_price: price,
      prd_original_price: originalPrice,
      prd_quantity: totalQuantity,
      prd_description: description,
      prd_category: updatedCategories,
      prd_attributes: attributes,
      prd_variants: updatedVariants.map((variant) => ({
        var_name: variant.name,
        var_images: variant.images,
        var_options: variant.options,
      })),
      prd_status: status,
    });

    // Step 7: Update product
    const parsedUpdateData = updateNestedObjectParser(updateData);

    // Step 8: Update product
    const updatedProduct = await this.productRepository.updateById(
      productId,
      parsedUpdateData
    );

    // Step 9: Delete used images
    this.uploadService.deleteUsedImage(mainImage, updatedSubImages);

    return {
      product: omitFields({
        fields: ['createdAt', 'updatedAt'],
        object: updatedProduct,
      }),
    };
  }

  async _validateCategories(categories) {
    if (!categories || !categories.length) return [];

    const validCategories = [];
    await Promise.all(
      categories.map(async (id) => {
        const categoryData = await this.categoryRepository.getById(id);
        if (!categoryData) {
          throw new BadRequestError(`Category with ID ${id} not found`);
        }
        validCategories.push(categoryData);
      })
    );

    return validCategories.map((category) => ({
      id: category.id,
      name: category.name,
    }));
  }

  async _validateAttributes(attributes) {
    if (!Array.isArray(attributes) || attributes.length === 0) {
      throw new BadRequestError('Attributes must be a non-empty array.');
    }

    const attributeIds = attributes.map((attr) => attr.id);

    const attributeList = await this.attributeRepository.getAll({
      filter: { _id: { $in: attributeIds } },
    });

    const attributeMap = new Map(
      attributeList.map((attr) => [attr.id.toString(), attr])
    );

    const missingAttributes = attributeIds.filter(
      (id) => !attributeMap.has(id)
    );
    if (missingAttributes.length) {
      throw new BadRequestError(
        `Attributes not found: ${missingAttributes.join(', ')}`
      );
    }

    return attributes.map((attr) => {
      const attribute = attributeMap.get(attr.id);

      if (!Array.isArray(attr.values) || attr.values.length === 0) {
        throw new BadRequestError(
          `Values for attribute ${attr.id} must be a non-empty array.`
        );
      }

      const validValuesSet = new Set(
        attribute.values.map((v) => v.valueId.toString())
      );

      const validatedValues = attr.values.filter((val) =>
        validValuesSet.has(val)
      );
      const invalidValues = attr.values.filter(
        (val) => !validValuesSet.has(val)
      );

      if (invalidValues.length) {
        throw new BadRequestError(
          `Invalid values for attribute ${attr.id}: ${invalidValues.join(', ')}`
        );
      }

      return {
        id: attribute.id,
        values: validatedValues.map((val) => ({ id: val })),
      };
    });
  }

  _updateProductViews(productId) {
    const updatedProduct = this.productRepository.updateById(productId, {
      $inc: { prd_views: 1 },
    });

    if (!updatedProduct) {
      throw new BadRequestError('Product not found');
    }
  }

  async deleteProduct({ productId }) {
    const deletedProduct = await this.productRepository.deleteById(productId);

    if (!deletedProduct) {
      throw new BadRequestError('Product not found');
    }

    await this.variantService.deleteVariants(productId);

    // this.uploadService.deleteUsedImage(
    //   deletedProduct.mainImage,
    //   deletedProduct.subImages
    // );
  }

  async updateProductUniqueViews({ productId, deviceId }) {
    const updatedProduct = await this.productRepository.updateById(productId, {
      $addToSet: { prd_unique_views: deviceId },
    });

    if (!updatedProduct) {
      throw new BadRequestError('Failed to update product views');
    }
  }

  async getProductDetailsPublic({ productId }) {
    const foundProduct = await this.productRepository.getByQuery({
      _id: productId,
      prd_status: ProductStatus.PUBLISHED,
    });

    if (!foundProduct) {
      throw new BadRequestError('Product not found');
    }

    const skuList = await this.variantService.getPublicVariantByProductId(
      productId
    );

    this._updateProductViews(productId);

    return {
      product: omitFields({
        fields: [
          'views',
          'uniqueViews',
          'createdAt',
          'updatedAt',
          'sold',
          'status',
        ],
        object: foundProduct,
      }),
      skuList,
    };
  }

  async getProductDetails({ productId }) {
    const foundProduct = await this.productRepository.getById(productId);

    if (!foundProduct) {
      throw new BadRequestError('Product not found');
    }

    const skuList = await this.variantService.getVariantByProductId(productId);

    return {
      product: omitFields({
        fields: ['createdAt', 'updatedAt'],
        object: foundProduct,
      }),
      skuList,
    };
  }

  async getAllProductsPublic({
    search,
    category,
    minPrice,
    maxPrice,
    sort,
    page = 1,
    size = 10,
    attributes,
  }) {
    const filter = { prd_status: ProductStatus.PUBLISHED };
    const formatPage = parseInt(page);
    const formatSize = parseInt(size);

    if (search) {
      const keyword = search.trim();
      const regexOptions = { $regex: keyword, $options: 'i' };

      filter.$or =
        keyword.length === 1
          ? [
              { prd_name: { $regex: `^${keyword}`, $options: 'i' } },
              { prd_description: regexOptions },
            ]
          : [{ prd_name: regexOptions }, { prd_description: regexOptions }];
    }

    if (category) {
      filter.prd_category = {
        $elemMatch: { id: convertToObjectIdMongodb(category) },
      };
    }

    if (minPrice || maxPrice) {
      filter.prd_price = {};
      if (minPrice) filter.prd_price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.prd_price.$lte = parseFloat(maxPrice);
    }

    if (attributes && attributes.length) {
      filter.prd_attributes = { $in: attributes };
    }

    const mappedSort = sort
      ? `${sort.startsWith('-') ? '-' : ''}${
          SortFieldProduct[sort.replace('-', '')] || 'createdAt'
        }`
      : '-createdAt';

    const query = {
      sort: mappedSort,
      page: formatPage,
      size: formatSize,
    };

    const products = await this.productRepository.getAll({
      filter: filter,
      queryOptions: query,
    });

    const totalProducts = await this.productRepository.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / size);

    return {
      totalPages,
      totalProducts,
      currentPage: formatPage,
      products: products.map((product) =>
        omitFields({
          fields: [
            'subImages',
            'quantity',
            'category',
            'attributes',
            'views',
            'uniqueViews',
            'createdAt',
            'updatedAt',
            'sold',
            'status',
          ],
          object: product,
        })
      ),
    };
  }

  async getAllProducts({
    search,
    category,
    minPrice,
    maxPrice,
    sort,
    page = 1,
    size = 10,
    attributes,
  }) {
    const filter = {};
    const formatPage = parseInt(page);
    const formatSize = parseInt(size);

    if (search) {
      const keyword = search.trim();
      const regexOptions = { $regex: keyword, $options: 'i' };

      filter.$or =
        keyword.length === 1
          ? [
              { prd_name: { $regex: `^${keyword}`, $options: 'i' } },
              { prd_description: regexOptions },
            ]
          : [{ prd_name: regexOptions }, { prd_description: regexOptions }];
    }

    if (category) {
      filter.prd_category = {
        $elemMatch: { id: convertToObjectIdMongodb(category) },
      };
    }

    if (minPrice || maxPrice) {
      filter.prd_price = {};
      if (minPrice) filter.prd_price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.prd_price.$lte = parseFloat(maxPrice);
    }

    if (attributes && attributes.length) {
      filter.prd_attributes = { $in: attributes };
    }

    const mappedSort = sort
      ? `${sort.startsWith('-') ? '-' : ''}${
          SortFieldProduct[sort.replace('-', '')] || 'createdAt'
        }`
      : '-createdAt';

    const query = {
      sort: mappedSort,
      page: formatPage,
      size: formatSize,
    };

    const products = await this.productRepository.getAll({
      filter: filter,
      queryOptions: query,
    });

    const totalProducts = await this.productRepository.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / size);

    return {
      totalPages,
      totalProducts,
      currentPage: formatPage,
      products: products.map((product) =>
        omitFields({
          fields: [
            'subImages',
            'category',
            'attributes',
            'description',
            'createdAt',
            'updatedAt',
          ],
          object: product,
        })
      ),
    };
  }

  async publishProduct({ productId }) {
    const foundProduct = await this.productRepository.getById(productId);

    if (!foundProduct) {
      throw new BadRequestError('Product not found');
    }

    const updatedProduct = await this.productRepository.updateById(productId, {
      prd_status: ProductStatus.PUBLISHED,
    });

    await this.variantService.publicAllVariants(productId);

    return pickFields({
      fields: ['status', 'updatedAt'],
      object: updatedProduct,
    });
  }

  async unpublishProduct({ productId }) {
    const foundProduct = await this.productRepository.getById(productId);

    if (!foundProduct) {
      throw new BadRequestError('Product not found');
    }

    const updatedProduct = await this.productRepository.updateById(productId, {
      prd_status: ProductStatus.DISCONTINUED,
    });

    return pickFields({
      fields: ['status', 'updatedAt'],
      object: updatedProduct,
    });
  }

  async updateProductQuantity({ id, quantity = null, skuList }) {
    const foundProduct = await this.productRepository.getById(id);
    if (!foundProduct) throw new NotFoundError('Product not found');

    // Handle product without variants
    if (foundProduct.variants && foundProduct.variants.length > 0) {
      if (!skuList || skuList.length === 0) {
        throw new BadRequestError(
          'This product has variants. Please update quantities via skuList.'
        );
      }
      return this._handleProductWithVariants({
        product: foundProduct,
        skuList,
      });
    }

    if (quantity) {
      return this._handleProductWithoutVariants({
        product: foundProduct,
        quantity,
      });
    }

    throw new BadRequestError(
      'Invalid request: quantity or skuList must be provided'
    );
  }

  async _handleProductWithoutVariants({ product, quantity }) {
    const totalQuantity = quantity + product.quantity;
    const status =
      totalQuantity === 0
        ? ProductStatus.OUT_OF_STOCK
        : ProductStatus.PUBLISHED;

    const updatedProduct = await this.productRepository.updateById(product.id, {
      prd_quantity: totalQuantity,
      prd_status: status,
    });

    return {
      id: updatedProduct.id,
      name: updatedProduct.name,
      quantity: updatedProduct.quantity,
      status: updatedProduct.status,
    };
  }

  async _handleProductWithVariants({ product, skuList }) {
    await this.variantService.updateVariantQuantities(skuList);

    const totalQuantity =
      await this.variantService._calculateTotalVariantQuantity(product.id);

    const status =
      totalQuantity === 0
        ? ProductStatus.OUT_OF_STOCK
        : ProductStatus.PUBLISHED;

    const updatedProduct = await this.productRepository.updateById(product.id, {
      prd_quantity: totalQuantity,
      prd_status: status,
    });

    return {
      id: updatedProduct.id,
      name: updatedProduct.name,
      quantity: updatedProduct.quantity,
      status: updatedProduct.status,
    };
  }
}

module.exports = ProductService;
