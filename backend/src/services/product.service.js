const { ProductStatus, SortFieldProduct } = require('../constants/status');
const CategoryRepository = require('../repositories/category.repository');
const ProductRepository = require('../repositories/product.repository');
const { BadRequestError } = require('../utils/errorResponse');
const {
  omitFields,
  removeUndefinedObject,
  updateNestedObjectParser,
  pickFields,
  convertToObjectIdMongodb,
} = require('../utils/helpers');
const UploadService = require('./upload.service');

const VariantService = require('./variant.service');

class ProductService {
  constructor() {
    this.productRepository = new ProductRepository();
    this.variantService = new VariantService();
    this.categoryRepository = new CategoryRepository();
    this.uploadService = new UploadService();
  }

  async createProduct({
    name,
    mainImage,
    subImages = [],
    price,
    originalPrice,
    quantity,
    description,
    category = [],
    attributes = [],
    variants = [],
    skuList = [],
  }) {
    // Validate category and retrieve data
    const updatedCategories = await this._validateCategories(category);

    // Calculate total quantity
    const totalQuantity = skuList.length
      ? skuList.reduce((total, { quantity }) => total + quantity, 0)
      : quantity;

    // Merge subImages with variant images
    const variantImages = variants.flatMap(({ images = [] }) => images);
    const updatedSubImages = Array.from(
      new Set([...subImages, ...variantImages])
    );

    const newProduct = await this.productRepository.create({
      prd_name: name,
      prd_main_image: mainImage,
      prd_sub_images: updatedSubImages,
      prd_price: price,
      prd_original_price: originalPrice,
      prd_quantity: totalQuantity,
      prd_description: description,
      prd_category: updatedCategories,
      prd_attributes: attributes,
      prd_variants: variants
        ? variants.map((variant) => ({
            var_name: variant.name,
            var_images: variant.images,
            var_options: variant.options,
          }))
        : [],
    });

    if (!newProduct) throw new BadRequestError('Failed to create product');

    this.uploadService.deleteUsedImage(mainImage, updatedSubImages);

    this.variantService.createVariants({
      product: newProduct,
      variants,
      skuList,
    });

    return {
      product: omitFields({
        fields: ['createdAt', 'updatedAt'],
        object: newProduct,
      }),
    };
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
    if (skuList) {
      await this.variantService.updateVariants({
        product: foundProduct,
        variants: updatedVariants,
        skuList,
      });
    }

    // Step 4: Calculate total quantity
    const totalQuantity = skuList
      ? skuList.reduce((total, sku) => total + (sku.quantity || 0), 0)
      : quantity || foundProduct.quantity;

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
      categories.map(async ({ id }) => {
        const categoryData = await this.categoryRepository.getById(id);
        if (!categoryData) {
          throw new BadRequestError(`Category with ID ${id} not found`);
        }
        validCategories.push(categoryData);
      })
    );
    return validCategories?.map((category) => ({
      id: category.id,
      name: category.name,
    }));
  }

  _updateProductViews(productId) {
    const updatedProduct = this.productRepository.updateById(productId, {
      $inc: { prd_views: 1 },
    });

    if (!updatedProduct) {
      throw new BadRequestError('Product not found');
    }
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
          SortFieldProduct[sort.replace('-', '')] || 'prd_rating'
        }`
      : '-prd_rating';

    const query = {
      sort: mappedSort,
      page: parseInt(page),
      size: parseInt(size),
    };

    const products = await this.productRepository.getAll({
      filter: filter,
      queryOptions: query,
    });

    const totalProducts = await this.productRepository.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / size);

    return {
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
      totalPages,
      totalProducts,
      currentPage: page,
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
          SortFieldProduct[sort.replace('-', '')] || 'prd_rating'
        }`
      : '-prd_rating';

    const query = {
      sort: mappedSort,
      page: parseInt(page),
      size: parseInt(size),
    };

    const products = await this.productRepository.getAll({
      filter: filter,
      queryOptions: query,
    });

    const totalProducts = await this.productRepository.countDocuments(filter);
    const totalPages = Math.ceil(totalProducts / size);

    return {
      products: products.map((product) =>
        omitFields({
          fields: ['createdAt', 'updatedAt', 'prd_views', 'prd_unique_views'],
          object: product,
        })
      ),
      totalPages,
      totalProducts,
      currentPage: page,
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
