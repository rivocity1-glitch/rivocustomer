// src/utils/billing.ts

export interface DeliveryConfig {
  base_customer_fee: number;
  customer_increment: number;
  base_rider_earning: number;
  rider_increment: number;
  base_distance: number;
  max_auto_distance: number;
}

export interface HandlingFeeRule {
  min_units: number;
  max_units: number | null;
  fee: number;
}

export interface HandlingFeeConfig {
  enabled: boolean;
  rules: HandlingFeeRule[];
}

export const DEFAULT_HANDLING_FEE_CONFIG: HandlingFeeConfig = {
  enabled: true,
  rules: [
    { min_units: 1, max_units: 1, fee: 2 },
    { min_units: 2, max_units: 3, fee: 4 },
    { min_units: 4, max_units: 6, fee: 6 },
    { min_units: 7, max_units: 10, fee: 8 },
    { min_units: 11, max_units: null, fee: 10 },
  ],
};

export function calculateHandlingFee(
  itemCount: number,
  config: HandlingFeeConfig = DEFAULT_HANDLING_FEE_CONFIG
): number {
  if (!config.enabled || itemCount <= 0) return 0;
  const rule = config.rules.find(
    candidate =>
      itemCount >= candidate.min_units &&
      (candidate.max_units === null || itemCount <= candidate.max_units)
  );
  return rule && Number.isFinite(Number(rule.fee)) && Number(rule.fee) >= 0
    ? Number(rule.fee)
    : 0;
}

export interface BillingInput {
  cartItems: { price: number; quantity: number }[];
  distanceKm: number | null;
  platformFee: number;
  commissionPercent: number;
  deliveryConfig: DeliveryConfig | null;
  handlingFeeConfig?: HandlingFeeConfig | null;
}

export interface BillingBreakdown {
  itemsTotal: number;
  handlingFee: number;
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
  const itemCount = safeCartItems.reduce((sum, item) => sum + Math.max(0, Math.floor(Number(item.quantity) || 0)), 0);
  // Handling fee is charged per vendor order, based on total units (not distinct SKUs).
  const handlingFee = calculateHandlingFee(
    itemCount,
    input.handlingFeeConfig ?? DEFAULT_HANDLING_FEE_CONFIG
  );
  
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
  const grandTotal = itemsTotal + deliveryFee + platformFee + handlingFee;

  return {
    itemsTotal,
    handlingFee,
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