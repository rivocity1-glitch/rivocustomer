// src/utils/billing.ts

export interface DeliveryConfig {
  base_customer_fee: number;
  customer_increment: number;
  base_rider_earning: number;
  rider_increment: number;
  base_distance: number;
  max_auto_distance: number;
}

export interface BillingInput {
  cartItems: { price: number; quantity: number }[];
  distanceKm: number | null;
  platformFee: number;
  commissionPercent: number;
  deliveryConfig: DeliveryConfig | null;
}

export interface BillingBreakdown {
  itemsTotal: number;
  deliveryFee: number;
  platformFee: number;
  vendorCommission: number;
  vendorEarning: number;
  riderEarning: number;
  rivoDeliveryMargin: number;
  actualDistanceKm: number;
  chargeableDistanceKm: number;
  grandTotal: number;
}

/**
 * Single source of truth finance engine for the Rivo project ecosystem.
 * Calculates all billing, splits, margins, and totals based on cart data, distance, and vendor status.
 */
export function calculateBilling(input: BillingInput): BillingBreakdown {
  const {
    cartItems,
    distanceKm,
    platformFee,
    commissionPercent,
    deliveryConfig
  } = input;

  const safeCartItems = cartItems || [];
  const itemsTotal = safeCartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  
  const actualDistanceKm = distanceKm ?? 0;
  
  // Extract configurations safely, fallback to 0 if not yet loaded to prevent errors
  const baseCustomerFee = deliveryConfig?.base_customer_fee ?? 0;
  const customerIncrement = deliveryConfig?.customer_increment ?? 0;
  const baseRiderEarning = deliveryConfig?.base_rider_earning ?? 0;
  const riderIncrement = deliveryConfig?.rider_increment ?? 0;
  const baseDistance = deliveryConfig?.base_distance ?? 0;
  const maxAutoDistance = deliveryConfig?.max_auto_distance ?? 0;

  // Calculate chargeable distance bound between base_distance and max_auto_distance
  const chargeableDistanceKm = Math.max(
    baseDistance,
    Math.min(Math.ceil(actualDistanceKm), maxAutoDistance)
  );

  // Dynamic pricing formulas using injected configuration
  const deliveryFee = distanceKm === null ? 0 : baseCustomerFee + (chargeableDistanceKm - baseDistance) * customerIncrement;
  const riderEarning = distanceKm === null ? 0 : baseRiderEarning + (chargeableDistanceKm - baseDistance) * riderIncrement;
  const rivoDeliveryMargin = deliveryFee - riderEarning;
  
  // Vendor fee splits using strict percentage configuration inputs
  const vendorCommission = (itemsTotal * commissionPercent) / 100;
  const vendorEarning = itemsTotal - vendorCommission;

  // Customer grand total
  const grandTotal = itemsTotal + deliveryFee + platformFee;

  return {
    itemsTotal,
    deliveryFee,
    platformFee,
    vendorCommission,
    vendorEarning,
    riderEarning,
    rivoDeliveryMargin,
    actualDistanceKm,
    chargeableDistanceKm,
    grandTotal,
  };
}