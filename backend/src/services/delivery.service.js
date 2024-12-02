const { generateSessionToken } = require('../helpers/crypto.helper');
const DeliveryRepository = require('../repositories/delivery.repository');
const { BadRequestError } = require('../utils/errorResponse');
const axios = require('axios');
const AddressService = require('./address.service');
const {
  pickFields,
  omitFields,
  removeUndefinedObject,
  updateNestedObjectParser,
} = require('../utils/helpers');
class DeliveryService {
  constructor() {
    this.deliveryRepository = new DeliveryRepository();
    this.addressService = new AddressService();
  }

  async createDelivery({ name, description, maxDistance, baseFee, pricing }) {
    if (
      !name ||
      !description ||
      maxDistance === undefined ||
      baseFee === undefined
    ) {
      throw new BadRequestError('Missing required fields');
    }

    console.log(baseFee);

    const newDelivery = await this.deliveryRepository.create({
      dlv_name: name,
      dlv_description: description,
      dlv_max_distance: maxDistance,
      dlv_base_fee: baseFee,
      dlv_pricing: pricing.map((price) => ({
        threshold: price.threshold,
        fee_per_km: price.feePerKm,
      })),
    });

    return newDelivery;
  }

  async getAllDeliveryWithFee({ destinationId }) {
    const deliveries = await this.deliveryRepository.getAll({
      filter: { dlv_is_active: true },
    });

    let distance = 5;
    if (destinationId) {
      distance = await this.addressService.calculateDistance(destinationId);
    }

    const updatedDeliveries = deliveries.map((delivery) => {
      const isAvailable = distance <= delivery.maxDistance;
      const fee = isAvailable ? this._calculateFee(delivery, distance) : null;

      return {
        ...delivery,
        isAvailable,
        fee,
      };
    });

    return {
      deliveries: updatedDeliveries.map((delivery) =>
        pickFields({
          object: delivery,
          fields: ['id', 'name', 'description', 'fee', 'isAvailable'],
        })
      ),
    };
  }

  async updateDelivery({
    deliveryId,
    name,
    description,
    maxDistance,
    baseFee,
    pricing,
  }) {
    const foundDelivery = await this.deliveryRepository.getById(deliveryId);
    if (!foundDelivery) throw new BadRequestError('Delivery not found');

    const updateData = removeUndefinedObject({
      dlv_name: name,
      dlv_description: description,
      dlv_max_distance: maxDistance,
      dlv_base_fee: baseFee,
      dlv_pricing: pricing?.map((price) => ({
        threshold: price.threshold,
        fee_per_km: price.feePerKm,
      })),
    });

    const parsedUpdateData = updateNestedObjectParser(updateData);

    const updatedDelivery = await this.deliveryRepository.updateById(
      deliveryId,
      parsedUpdateData
    );

    return omitFields({
      object: updatedDelivery,
      fields: ['createdAt', 'updatedAt'],
    });
  }

  async getAllDeliveries() {
    const deliveries = await this.deliveryRepository.getAll({
      filter: {},
    });

    return {
      deliveries: deliveries.map((delivery) =>
        pickFields({
          object: delivery,
          fields: ['id', 'name', 'description', 'isActive'],
        })
      ),
    };
  }

  async getDeliveryById(deliveryId) {
    const delivery = await this.deliveryRepository.getById(deliveryId);
    if (!delivery) throw new BadRequestError('Delivery not found');

    return omitFields({
      object: delivery,
      fields: ['createdAt', 'updatedAt'],
    });
  }

  async activateDelivery(deliveryId) {
    const delivery = await this.deliveryRepository.updateById(deliveryId, {
      dlv_is_active: true,
    });
    if (!delivery) throw new BadRequestError('Delivery not found');
  }

  async deactivateDelivery(deliveryId) {
    const delivery = await this.deliveryRepository.updateById(deliveryId, {
      dlv_is_active: false,
    });
    if (!delivery) throw new BadRequestError('Delivery not found');
  }

  async calculateDeliveryFee({ deliveryId, destinationId }) {
    const foundDelivery = await this.deliveryRepository.getById(deliveryId);
    if (!foundDelivery) throw new BadRequestError('Delivery not found');

    const distance = await this.addressService.calculateDistance(destinationId);
    const deliveryFee = this._calculateFee(foundDelivery, distance);

    return deliveryFee;
  }

  _calculateFee(delivery, distance) {
    const { baseFee, pricing, maxDistance } = delivery;

    if (distance > maxDistance) {
      throw new BadRequestError(
        `Distance exceeds the maximum limit of ${maxDistance} km`
      );
    }

    let totalFee = baseFee;
    let remainingDistance = distance;

    // Sort the pricing tiers by threshold in ascending order
    const sortedPricing = pricing.sort((a, b) => a.threshold - b.threshold);

    // Calculate delivery fee based on pricing tiers
    for (let i = 0; i < sortedPricing.length; i++) {
      const { threshold, feePerKm } = sortedPricing[i];
      const nextThreshold = sortedPricing[i + 1]?.threshold || maxDistance;

      const segmentDistance = Math.min(
        remainingDistance,
        nextThreshold - threshold
      );

      if (segmentDistance > 0) {
        totalFee += segmentDistance * feePerKm;
        remainingDistance -= segmentDistance;
      }

      if (remainingDistance <= 0) break;
    }

    return Math.round(totalFee / 1000) * 1000;
  }
}

module.exports = DeliveryService;
