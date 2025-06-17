'use strict';

const BaseRepository = require('./base.repository');
const InventoryModel = require('../models/inventory.model');
const orderModel = require('../models/order.model');
const { OrderStatus } = require('../constants/status');

class InventoryRepository extends BaseRepository {
  constructor() {
    super(InventoryModel);
    this.model = InventoryModel;
  }

  async lastInventory() {
    const year = new Date().getFullYear();
    const inventory = await this.model
      .findOne({ inv_batch_code: { $regex: `^LOT${year}-\\d{3}$` } })
      .sort({ inv_batch_code: -1 })
      .lean();

    return this.formatDocument(inventory);
  }

  async getInventoryByIndentifier(inventoryKey) {
    const inventory = await this.model
      .findOne({
        $or: [
          { inv_import_code: inventoryKey },
          { inv_batch_code: inventoryKey },
          { _id: inventoryKey },
        ],
      })
      .populate('inv_created_by', 'usr_name usr_avatar')
      .populate('inv_updated_by', 'usr_name usr_avatar')
      .populate('inv_items.prd_id', 'prd_main_image prd_name')
      .lean();

    return this.formatDocument(inventory);
  }

  // Thống kê phân tích lợi nhuận từ việc nhập hàng
  async importProfitAnalysis({ startDate, endDate } = {}) {
    const match = {};
    if (startDate && endDate) {
      match.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const result = await this.model.aggregate([
      { $match: match },
      { $unwind: '$inv_items' },
      {
        $lookup: {
          from: 'variants',
          localField: 'inv_items.var_id',
          foreignField: '_id',
          as: 'variant',
        },
      },
      { $unwind: { path: '$variant', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          productId: '$inv_items.prd_id',
          variantId: '$inv_items.var_id',
          productName: '$inv_items.prd_name',
          variantSlug: '$inv_items.var_slug',
          importQty: '$inv_items.prd_quantity',
          importPrice: '$inv_items.prd_import_price',
          sellPrice: '$variant.var_price',
          potentialProfit: {
            $cond: {
              if: { $ifNull: ['$variant.var_price', null] },
              then: {
                $multiply: [
                  '$inv_items.prd_quantity',
                  {
                    $subtract: [
                      '$variant.var_price',
                      '$inv_items.prd_import_price',
                    ],
                  },
                ],
              },
              else: 0,
            },
          },
        },
      },
      {
        $group: {
          _id: {
            productId: '$productId',
            variantId: '$variantId',
          },
          productName: { $first: '$productName' },
          variantSlug: { $first: '$variantSlug' },
          totalImportQty: { $sum: '$importQty' },
          totalImportCost: {
            $sum: { $multiply: ['$importQty', '$importPrice'] },
          },
          totalPotentialProfit: { $sum: '$potentialProfit' },
        },
      },
      { $sort: { totalPotentialProfit: -1 } },
    ]);

    return result;
  }

  formatDocument(inventory) {
    if (!inventory) return null;

    return {
      id: inventory._id,
      importCode: inventory.inv_import_code,
      items: (inventory.inv_items || []).map((item) => ({
        productId: item.prd_id.prd_main_image
          ? { id: item.prd_id._id, image: item.prd_id.prd_main_image }
          : item.prd_id,
        productName: item.prd_name,
        variantId: item.var_id,
        variantSlug: item.var_slug,
        quantity: item.prd_quantity,
        importPrice: item.prd_import_price,
      })),
      batchCode: inventory.inv_batch_code,
      supplier: inventory.inv_supplier,
      totalImportPrice: inventory.inv_total_import_price,
      totalQuantity: inventory.inv_total_quantity,
      note: inventory.inv_note,
      createdBy: inventory.inv_created_by
        ? {
            id: inventory.inv_created_by._id,
            name: inventory.inv_created_by.usr_name,
            avatar: inventory.inv_created_by.usr_avatar,
          }
        : inventory.inv_created_by,
      updatedBy: inventory.inv_updated_by
        ? {
            id: inventory.inv_updated_by._id,
            name: inventory.inv_updated_by.usr_name,
            avatar: inventory.inv_updated_by.usr_avatar,
          }
        : inventory.inv_updated_by,
      createdAt: inventory.createdAt,
      updatedAt: inventory.updatedAt,
    };
  }
}

module.exports = InventoryRepository;
