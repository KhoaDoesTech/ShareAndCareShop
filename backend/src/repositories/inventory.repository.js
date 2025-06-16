'use strict';

const BaseRepository = require('./base.repository');
const InventoryModel = require('../models/inventory.model');

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
