'use strict';

const path = require('path');
const { SortFieldInventory } = require('../constants/status');
const InventoryRepository = require('../repositories/inventory.repository');
const ProductRepository = require('../repositories/product.repository');
const VariantRepository = require('../repositories/variant.repository');
const { BadRequestError } = require('../utils/errorResponse');
const {
  convertToObjectIdMongodb,
  omitFields,
  listResponse,
} = require('../utils/helpers');

class InventoryService {
  constructor() {
    this.inventoryRepository = new InventoryRepository();
    this.productRepository = new ProductRepository();
    this.variantRepository = new VariantRepository();
  }

  async importStock({ items, userId, batchCode, supplier, note }) {
    // Validate input
    if (!items?.length || !Array.isArray(items)) {
      throw new BadRequestError('Danh sách sản phẩm phải là mảng không rỗng');
    }

    // Process items in parallel
    const results = await Promise.all(
      items.map((item) => this._validateProductAndVariant(item))
    );

    // Aggregate results
    const inventoryItems = [];
    let totalImportPrice = 0;
    let totalQuantity = 0;
    const productUpdates = [];
    const variantUpdates = [];

    for (const {
      product,
      totalProductQuantity,
      inventoryItems: items,
    } of results) {
      inventoryItems.push(...items);
      productUpdates.push({
        id: product.id,
        update: {
          prd_quantity: product.quantity + totalProductQuantity,
          updatedBy: userId,
        },
      });

      for (const item of items) {
        totalQuantity += item.prd_quantity;
        totalImportPrice += (item.prd_import_price || 0) * item.prd_quantity;
        if (item.var_id) {
          const variant = await this.variantRepository.getByQuery({
            filter: { _id: item.var_id },
          });
          variantUpdates.push({
            id: item.var_id,
            update: {
              var_quantity: variant.quantity + item.prd_quantity,
              updatedBy: userId,
            },
          });
        }
      }
    }

    // Batch update products and variants
    await Promise.all([
      ...productUpdates.map(({ id, update }) =>
        this.productRepository.updateById(id, update)
      ),
      ...variantUpdates.map(({ id, update }) =>
        this.variantRepository.updateById(id, update)
      ),
    ]);

    // Create inventory record
    const inventoryData = {
      inv_items: inventoryItems,
      inv_batch_code: batchCode || (await this._generateBatchCode()),
      inv_supplier: supplier || null,
      inv_total_import_price: totalImportPrice,
      inv_total_quantity: totalQuantity,
      inv_note: note || '',
      inv_created_by: convertToObjectIdMongodb(userId),
      inv_updated_by: convertToObjectIdMongodb(userId),
    };

    const newInventory = await this.inventoryRepository.create(inventoryData);
    if (!newInventory) {
      throw new BadRequestError('Không thể tạo bản ghi kho');
    }

    return omitFields({
      fields: ['createdBy', 'updatedBy', 'updatedAt'],
      object: newInventory,
    });
  }

  async getAllInventory({
    search,
    batchCode,
    importCode,
    sort,
    page = 1,
    size = 10,
  }) {
    const formatPage = parseInt(page);
    const formatSize = parseInt(size);

    // Build filter
    const filter = this._buildInventoryFilter({
      search,
      batchCode,
      importCode,
    });

    // Sort
    const mappedSort = sort
      ? `${sort.startsWith('-') ? '-' : ''}${
          SortFieldInventory[sort.replace('-', '')] || 'createdAt'
        }`
      : '-createdAt';

    const query = {
      sort: mappedSort,
      page: formatPage,
      size: formatSize,
    };

    // Fetch inventories
    const inventories = await this.inventoryRepository.getAll({
      filter,
      queryOptions: query,
      populateOptions: [
        { path: 'inv_created_by', select: 'usr_name usr_avatar' },
        { path: 'inv_updated_by', select: 'usr_name usr_avatar' },
      ],
    });

    const totalInventories = await this.inventoryRepository.countDocuments(
      filter
    );

    return listResponse({
      items: inventories.map((inventory) =>
        omitFields({
          fields: ['items'],
          object: inventory,
        })
      ),
      total: totalInventories,
      page: formatPage,
      size: formatSize,
    });
  }

  async getInventoryById(inventoryKey) {
    const inventory = await this.inventoryRepository.getInventoryByIndentifier(
      inventoryKey
    );

    if (!inventory) {
      throw new BadRequestError('Không tìm thấy kho hàng với ID đã cho');
    }

    return inventory;
  }

  _buildInventoryFilter({ search, batchCode, importCode }) {
    const filter = {};

    if (search) {
      filter.$or = [
        { inv_note: { $regex: search, $options: 'i' } },
        { inv_supplier: { $regex: search, $options: 'i' } },
        { 'inv_items.prd_name': { $regex: search, $options: 'i' } },
        { 'inv_items.var_slug': { $regex: search, $options: 'i' } },
      ];
    }

    if (batchCode) {
      filter.inv_batch_code = batchCode;
    }

    if (importCode) {
      filter.inv_import_code = importCode;
    }

    return filter;
  }

  async _generateBatchCode() {
    const year = new Date().getFullYear();
    // Tìm batch code lớn nhất trong năm hiện tại
    const lastInventory = await this.inventoryRepository.lastInventory();

    let nextNumber = 1;
    if (lastInventory && lastInventory.batchCode) {
      const match = lastInventory.batchCode.match(/LOT\d{4}-(\d{3})/);
      if (match) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    const batchCode = `LOT${year}-${String(nextNumber).padStart(3, '0')}`;

    return batchCode;
  }

  async _validateProductAndVariant({
    productKey,
    skuList,
    quantity,
    importPrice,
  }) {
    if (!productKey) {
      throw new BadRequestError('Mã sản phẩm là bắt buộc');
    }

    const product = await this.productRepository.getProduct(productKey);
    if (!product) {
      throw new BadRequestError(`Sản phẩm ${productKey} không tồn tại`);
    }

    let totalProductQuantity = 0;
    const inventoryItems = [];

    if (skuList?.length > 0) {
      if (!product.variants?.length) {
        throw new BadRequestError(`Sản phẩm ${product.name} không có biến thể`);
      }

      const variantIds = skuList.map((sku) => sku.variantId);
      const variants = await this.variantRepository.getVariantByFilter({
        _id: { $in: variantIds },
        prd_id: product.id,
      });

      const variantMap = new Map(variants.map((v) => [v.id.toString(), v]));

      for (const sku of skuList) {
        const { variantId, quantity, importPrice } = sku;
        if (!variantId || !quantity || quantity < 1) {
          throw new BadRequestError(
            'Variant ID và số lượng hợp lệ là bắt buộc'
          );
        }

        const variant = variantMap.get(variantId);
        if (!variant) {
          throw new BadRequestError(
            `Biến thể ${variantId} không hợp lệ cho sản phẩm ${productKey}`
          );
        }

        inventoryItems.push({
          prd_id: product.id,
          prd_name: product.name,
          var_id: convertToObjectIdMongodb(variantId),
          var_slug: variant.slug,
          prd_quantity: quantity,
          prd_import_price: importPrice || 0,
        });

        totalProductQuantity += quantity;
      }
    } else {
      if (!quantity || quantity < 1) {
        throw new BadRequestError(
          'Số lượng hợp lệ là bắt buộc cho sản phẩm không có biến thể'
        );
      }
      if (product.variants?.length > 0) {
        throw new BadRequestError(
          `Sản phẩm ${product.name} yêu cầu skuList vì có biến thể`
        );
      }

      inventoryItems.push({
        prd_id: product.id,
        prd_name: product.name,
        prd_quantity: quantity,
        prd_import_price: importPrice || 0,
      });

      totalProductQuantity = quantity;
    }

    return { product, totalProductQuantity, inventoryItems };
  }
}

module.exports = InventoryService;
