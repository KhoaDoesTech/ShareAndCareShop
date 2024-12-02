'use strict';

const deliveryModels = require('../models/delivery.model');
const BaseRepository = require('./base.repository');

class DeliveryRepository extends BaseRepository {
  constructor() {
    super(deliveryModels);
    this.model = deliveryModels;
  }

  formatDocument(delivery) {
    if (!delivery) return null;

    return {
      id: delivery._id,
      name: delivery.dlv_name,
      description: delivery.dlv_description,
      maxDistance: delivery.dlv_max_distance,
      baseFee: delivery.dlv_base_fee,
      pricing: delivery.dlv_pricing.map((pricing) => ({
        threshold: pricing.threshold,
        feePerKm: pricing.fee_per_km,
      })),
      isActive: delivery.dlv_is_active,
      createdAt: delivery.createdAt,
      updatedAt: delivery.updatedAt,
    };
  }
}

module.exports = DeliveryRepository;
