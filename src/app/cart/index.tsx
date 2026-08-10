// src/app/(tabs)/cart.tsx

import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  cart,
  decreaseQuantity,
  increaseQuantity,
  removeFromCart,
  subscribeCart,
} from '../../lib/cart';
import { supabase } from '../../lib/supabase';
import { calculateBilling, DeliveryConfig } from '../../utils/billing';
import { calculateDistance } from '../../utils/distance';

export default function CartScreen() {
  const [cartItems, setCartItems] = useState(
    cart.map(item => ({ ...item }))
  );
  const [loading, setLoading] = useState(true);

  const [vendorLocation, setVendorLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [vendorPlanName, setVendorPlanName] =
    useState<string>('free');

  // Fixed Rivo platform fee in rupees.
  // Database value: platform_fee = 6
  const [platformFeeFromConfig, setPlatformFeeFromConfig] =
    useState<number>(0);

  const [deliveryConfig, setDeliveryConfig] =
    useState<DeliveryConfig | null>(null);

  const [customerAddress, setCustomerAddress] = useState<{
    latitude: number | null;
    longitude: number | null;
  } | null>(null);

  function refresh() {
    setCartItems(
      cart.map(item => ({ ...item }))
    );
  }

  // Calculate vendor → customer distance.
  const distance = useMemo(() => {
    if (
      customerAddress?.latitude == null ||
      customerAddress?.longitude == null ||
      vendorLocation?.latitude == null ||
      vendorLocation?.longitude == null
    ) {
      return null;
    }

    return calculateDistance(
      vendorLocation.latitude,
      vendorLocation.longitude,
      Number(customerAddress.latitude),
      Number(customerAddress.longitude)
    );
  }, [customerAddress, vendorLocation]);

  useEffect(() => {
    async function loadCartBillingContext() {
      try {
        /*
         * CUSTOMER + DEFAULT ADDRESS
         */
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const {
            data: customer,
            error: customerError,
          } = await supabase
            .from('customers')
            .select('id')
            .eq('auth_user_id', user.id)
            .maybeSingle();

          if (customerError) {
            console.error(
              'Error loading customer:',
              customerError
            );
          }

          if (customer) {
            const {
              data: addressData,
              error: addressError,
            } = await supabase
              .from('customer_addresses')
              .select('latitude, longitude')
              .eq('customer_id', customer.id)
              .eq('is_default', true)
              .maybeSingle();

            if (addressError) {
              console.error(
                'Error loading customer address:',
                addressError
              );
            }

            if (addressData) {
              setCustomerAddress({
                latitude:
                  addressData.latitude !== null &&
                  addressData.latitude !== undefined
                    ? Number(addressData.latitude)
                    : null,
                longitude:
                  addressData.longitude !== null &&
                  addressData.longitude !== undefined
                    ? Number(addressData.longitude)
                    : null,
              });
            }
          }
        }

        /*
         * VENDOR LOCATION + SUBSCRIPTION
         */
        if (cart.length > 0) {
          const vendorId = cart[0].vendor_id;

          const {
            data: vendorProfile,
            error: vendorProfileError,
          } = await supabase
            .from('vendor_profiles')
            .select('latitude, longitude')
            .eq('vendor_id', vendorId)
            .maybeSingle();

          if (vendorProfileError) {
            console.error(
              'Error loading vendor location:',
              vendorProfileError
            );
          }

          if (
            vendorProfile?.latitude !== null &&
            vendorProfile?.latitude !== undefined &&
            vendorProfile?.longitude !== null &&
            vendorProfile?.longitude !== undefined
          ) {
            setVendorLocation({
              latitude: Number(vendorProfile.latitude),
              longitude: Number(vendorProfile.longitude),
            });
          }

          /*
           * Vendor subscription / commission plan
           */
          try {
            const {
              data: vendorSub,
              error: vendorSubError,
            } = await supabase
              .from('subscriptions')
              .select('plan_name, status')
              .eq('vendor_id', vendorId)
              .eq('status', 'active')
              .maybeSingle();

            if (vendorSubError) {
              console.error(
                'Error loading vendor subscription:',
                vendorSubError
              );
            }

            if (vendorSub?.plan_name) {
              setVendorPlanName(
                vendorSub.plan_name.toLowerCase()
              );
            } else {
              setVendorPlanName('free');
            }
          } catch (error) {
            console.error(
              'Error loading vendor subscription:',
              error
            );

            setVendorPlanName('free');
          }
        }

        /*
         * FIXED PLATFORM FEE
         *
         * Actual database row:
         *
         * setting_key   = platform_fee
         * setting_value = 6
         *
         * Therefore:
         * platformFeeFromConfig = ₹6
         */
        const {
          data: feeSettings,
          error: feeSettingsError,
        } = await supabase
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', 'platform_fee')
          .maybeSingle();

        if (feeSettingsError) {
          console.error(
            'Error loading platform fee:',
            feeSettingsError
          );

          setPlatformFeeFromConfig(0);
        } else if (
          feeSettings?.setting_value !== null &&
          feeSettings?.setting_value !== undefined
        ) {
          const fixedPlatformFee = Number(
            feeSettings.setting_value
          );

          if (
            Number.isFinite(fixedPlatformFee) &&
            fixedPlatformFee >= 0
          ) {
            setPlatformFeeFromConfig(
              fixedPlatformFee
            );
          } else {
            console.error(
              'Invalid platform fee value:',
              feeSettings.setting_value
            );

            setPlatformFeeFromConfig(0);
          }
        } else {
          console.warn(
            'Platform fee setting not found. Using ₹0.'
          );

          setPlatformFeeFromConfig(0);
        }

        /*
         * DELIVERY CONFIGURATION
         *
         * Database key:
         * delivery_config
         */
        const {
          data: deliverySettings,
          error: deliverySettingsError,
        } = await supabase
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', 'delivery_config')
          .maybeSingle();

        if (deliverySettingsError) {
          console.error(
            'Error loading delivery configuration:',
            deliverySettingsError
          );
        }

        if (
          deliverySettings?.setting_value !== null &&
          deliverySettings?.setting_value !== undefined
        ) {
          try {
            const rawValue =
              deliverySettings.setting_value;

            const parsedDelivery =
              typeof rawValue === 'string'
                ? JSON.parse(rawValue)
                : rawValue;

            setDeliveryConfig({
              base_customer_fee: Number(
                parsedDelivery?.base_customer_fee ?? 0
              ),
              customer_increment: Number(
                parsedDelivery?.customer_increment ?? 0
              ),
              base_rider_earning: Number(
                parsedDelivery?.base_rider_earning ?? 0
              ),
              rider_increment: Number(
                parsedDelivery?.rider_increment ?? 0
              ),
              base_distance: Number(
                parsedDelivery?.base_distance ?? 0
              ),
              max_auto_distance: Number(
                parsedDelivery?.max_auto_distance ?? 0
              ),
            });
          } catch (error) {
            console.error(
              'Error parsing delivery configuration:',
              error
            );

            setDeliveryConfig(null);
          }
        } else {
          setDeliveryConfig(null);
        }
      } catch (err) {
        console.error(
          'Error loading cart billing context:',
          err
        );
      } finally {
        setLoading(false);
      }
    }

    loadCartBillingContext();

    const unsubscribe = subscribeCart(() => {
      refresh();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  /*
   * BILLING CALCULATION
   */
  const billingBreakdown = useMemo(() => {
    let commissionPercent = 5;

    if (
      vendorPlanName === 'basic' ||
      vendorPlanName === 'growth' ||
      vendorPlanName === 'pro'
    ) {
      commissionPercent = 0;
    }

    return calculateBilling({
      cartItems,
      distanceKm: distance,

      // Fixed ₹6 platform fee from platform_settings.
      platformFee:
        cartItems.length > 0
          ? platformFeeFromConfig
          : 0,

      commissionPercent,
      deliveryConfig,
    });
  }, [
    cartItems,
    distance,
    vendorPlanName,
    platformFeeFromConfig,
    deliveryConfig,
  ]);

  const {
    itemsTotal,
    deliveryFee,
    platformFee,
    grandTotal,
  } = billingBreakdown;

  /*
   * LOADING STATE
   */
  if (loading) {
    return (
      <SafeAreaView style={styles.safeContainer}>
        <View style={styles.header}>
          <View
            style={[
              styles.backButton,
              {
                backgroundColor: '#E2E8F0',
                borderColor: '#E2E8F0',
              },
            ]}
          />

          <View style={{ gap: 6 }}>
            <View
              style={{
                width: 120,
                height: 18,
                backgroundColor: '#E2E8F0',
                borderRadius: 4,
              }}
            />

            <View
              style={{
                width: 80,
                height: 12,
                backgroundColor: '#F1F5F9',
                borderRadius: 4,
              }}
            />
          </View>
        </View>

        <View
          style={{
            padding: 16,
            gap: 12,
          }}
        >
          {[1, 2, 3].map(i => (
            <View
              key={i}
              style={[
                styles.cartCard,
                {
                  opacity: 0.6,
                  borderColor: '#F1F5F9',
                },
              ]}
            >
              <View
                style={{
                  flexDirection: 'row',
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 64,
                    height: 64,
                    backgroundColor: '#E2E8F0',
                    borderRadius: 14,
                  }}
                />

                <View
                  style={{
                    flex: 1,
                    gap: 8,
                  }}
                >
                  <View
                    style={{
                      width: '80%',
                      height: 14,
                      backgroundColor: '#E2E8F0',
                      borderRadius: 4,
                    }}
                  />

                  <View
                    style={{
                      width: '40%',
                      height: 12,
                      backgroundColor: '#F1F5F9',
                      borderRadius: 4,
                    }}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  /*
   * EMPTY CART
   */
  if (cartItems.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconWrapper}>
          <Text style={styles.emptyIcon}>🛒</Text>
        </View>

        <Text style={styles.emptyTitle}>
          Your Cart is Empty
        </Text>

        <Text style={styles.emptySubtitle}>
          Looks like it's empty! Fill it up with goods to
          get instant delivery at your doorstep right now.
        </Text>

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.continueButton,
            pressed && styles.microInteraction,
          ]}
        >
          <Text style={styles.continueButtonText}>
            Fill It Up With Goods
          </Text>
        </Pressable>
      </View>
    );
  }

  /*
   * CART SCREEN
   */
  return (
    <SafeAreaView style={styles.safeContainer}>
      <View style={styles.flexContainer}>
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>
              ←
            </Text>
          </Pressable>

          <View>
            <Text style={styles.headerTitle}>
              Review Cart
            </Text>

            <Text style={styles.headerSubtitle}>
              {cartItems.length}{' '}
              {cartItems.length === 1
                ? 'item'
                : 'items'}{' '}
              inside Rivo instant delivery
            </Text>
          </View>
        </View>

        <FlatList
          data={cartItems}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.cartCard}>
              <View
                style={styles.swipeLeftBarIndicator}
              />

              <View
                style={styles.cardMainContentArea}
              >
                {/* PRODUCT IMAGE */}
                {item.image_url ? (
                  <Image
                    source={{
                      uri: item.image_url,
                    }}
                    style={
                      styles.productThumbnailImage
                    }
                  />
                ) : (
                  <View
                    style={
                      styles.fallbackThumbnailImageGraphic
                    }
                  >
                    <Text
                      style={
                        styles.fallbackThumbnailLetter
                      }
                    >
                      {item.name
                        ?.charAt(0)
                        .toUpperCase() || 'P'}
                    </Text>
                  </View>
                )}

                {/* ITEM DETAILS */}
                <View style={styles.itemMeta}>
                  <Text
                    style={styles.itemName}
                    numberOfLines={2}
                  >
                    {item.name}
                  </Text>

                  <Text
                    style={
                      styles.itemPriceCalculation
                    }
                  >
                    ₹{item.price}{' '}
                    <Text
                      style={
                        styles.mutedMultiplier
                      }
                    >
                      ×
                    </Text>{' '}
                    {item.quantity}
                  </Text>

                  <Text
                    style={styles.itemTotalPrice}
                  >
                    ₹{item.price * item.quantity}
                  </Text>
                </View>

                {/* ACTIONS */}
                <View
                  style={
                    styles.rightActionPanelControlsColumn
                  }
                >
                  <Pressable
                    onPress={() => {
                      removeFromCart(item.id);
                      refresh();
                    }}
                    style={({ pressed }) => [
                      styles.removeButton,
                      pressed &&
                        styles.opacityInteraction,
                    ]}
                  >
                    <Text
                      style={
                        styles.removeButtonText
                      }
                    >
                      🗑️
                    </Text>
                  </Pressable>

                  <View
                    style={styles.quantityContainer}
                  >
                    <Pressable
                      onPress={() => {
                        decreaseQuantity(item.id);
                        refresh();
                      }}
                      style={({ pressed }) => [
                        styles.quantityControlBtn,
                        pressed &&
                          styles.opacityInteraction,
                      ]}
                    >
                      <Text
                        style={
                          styles.quantityControlText
                        }
                      >
                        -
                      </Text>
                    </Pressable>

                    <Text
                      style={styles.quantityText}
                    >
                      {item.quantity}
                    </Text>

                    <Pressable
                      onPress={() => {
                        increaseQuantity(item.id);
                        refresh();
                      }}
                      style={({ pressed }) => [
                        styles.quantityControlBtn,
                        pressed &&
                          styles.opacityInteraction,
                      ]}
                    >
                      <Text
                        style={
                          styles.quantityControlText
                        }
                      >
                        +
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          )}
          ListFooterComponent={
            <View
              style={{
                gap: 14,
                marginTop: 8,
              }}
            >
              {/* BILL SUMMARY */}
              <View style={styles.billContainer}>
                <View
                  style={styles.billHeaderRow}
                >
                  <Text style={styles.billTitle}>
                    Bill Summary
                  </Text>

                  <View
                    style={styles.instantBadge}
                  >
                    <Text
                      style={
                        styles.instantBadgeText
                      }
                    >
                      ⚡ SECURE CHECKOUT
                    </Text>
                  </View>
                </View>

                {/* ITEMS TOTAL */}
                <View style={styles.billRow}>
                  <View
                    style={
                      styles.labelRowWithIcon
                    }
                  >
                    <Text
                      style={styles.rowLeadIcon}
                    >
                      🛒
                    </Text>

                    <Text
                      style={styles.billLabel}
                    >
                      Items Total (Subtotal)
                    </Text>
                  </View>

                  <Text style={styles.billValue}>
                    ₹{itemsTotal}
                  </Text>
                </View>

                {/* DELIVERY PARTNER FEE */}
                <View style={styles.billRow}>
                  <View
                    style={
                      styles.labelRowWithIcon
                    }
                  >
                    <Text
                      style={styles.rowLeadIcon}
                    >
                      🛵
                    </Text>

                    <Text
                      style={styles.billLabel}
                    >
                      Delivery Partner Fee
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.billValue,
                      deliveryFee === 0 &&
                        styles.freeText,
                    ]}
                  >
                    {deliveryFee === 0
                      ? 'FREE'
                      : `₹${deliveryFee}`}
                  </Text>
                </View>

                {/* PLATFORM HANDLING FEE */}
                <View style={styles.billRow}>
                  <View
                    style={
                      styles.labelRowWithIcon
                    }
                  >
                    <Text
                      style={styles.rowLeadIcon}
                    >
                      🏢
                    </Text>

                    <Text
                      style={styles.billLabel}
                    >
                      Platform Handling Fee
                    </Text>
                  </View>

                  <Text style={styles.billValue}>
                    ₹{platformFee}
                  </Text>
                </View>

                <View
                  style={styles.thickDivider}
                />

                {/* GRAND TOTAL */}
                <View
                  style={styles.grandTotalRow}
                >
                  <View>
                    <Text
                      style={styles.grandTotalLabel}
                    >
                      To Pay Amount
                    </Text>

                    <Text
                      style={styles.gstNotice}
                    >
                      Includes all legal regional
                      retail GST
                    </Text>
                  </View>

                  <Text
                    style={styles.grandTotalValue}
                  >
                    ₹{grandTotal}
                  </Text>
                </View>
              </View>
            </View>
          }
        />
      </View>

      {/* STICKY CHECKOUT FOOTER */}
      <View style={styles.stickyFooter}>
        <Pressable
          onPress={() => router.push('/checkout')}
          style={({ pressed }) => [
            styles.checkoutButton,
            pressed &&
              styles.microInteraction,
          ]}
        >
          <View
            style={styles.checkoutTextContainer}
          >
            <Text
              style={styles.checkoutPrice}
            >
              ₹{grandTotal}
            </Text>

            <Text
              style={styles.checkoutDivider}
            >
              |
            </Text>

            <Text
              style={styles.checkoutActionText}
            >
              Proceed to Checkout ➔
            </Text>
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  flexContainer: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    gap: 12,
  },

  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EAEFF3',
  },

  backButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D0D0D',
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0D0D0D',
    letterSpacing: -0.5,
  },

  headerSubtitle: {
    fontSize: 12,
    color: '#22CC71',
    fontWeight: '700',
    marginTop: 1,
  },

  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },

  cartCard: {
    backgroundColor: '#F7F8FA',
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EAEFF3',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#0D0D0D',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.01,
    shadowRadius: 8,
    elevation: 1,
  },

  swipeLeftBarIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 5,
    backgroundColor: '#A8E63A',
  },

  cardMainContentArea: {
    flexDirection: 'row',
    padding: 14,
    paddingLeft: 18,
    alignItems: 'center',
  },

  productThumbnailImage: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEFF3',
  },

  fallbackThumbnailImageGraphic: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  fallbackThumbnailLetter: {
    fontSize: 24,
    fontWeight: '900',
    color: '#64748B',
  },

  itemMeta: {
    flex: 1,
    marginHorizontal: 12,
    justifyContent: 'center',
  },

  itemName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D0D0D',
    lineHeight: 18,
  },

  itemPriceCalculation: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },

  mutedMultiplier: {
    color: '#94A3B8',
    fontWeight: '400',
  },

  itemTotalPrice: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0D0D0D',
    marginTop: 4,
  },

  rightActionPanelControlsColumn: {
    alignItems: 'flex-end',
    gap: 8,
    justifyContent: 'space-between',
  },

  removeButton: {
    padding: 4,
    marginRight: 2,
  },

  removeButtonText: {
    fontSize: 14,
  },

  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#22CC71',
    padding: 1,
  },

  quantityControlBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },

  quantityControlText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#22CC71',
  },

  quantityText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D0D0D',
    paddingHorizontal: 6,
    textAlign: 'center',
  },

  billContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EAEFF3',
    shadowColor: '#0D0D0D',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.02,
    shadowRadius: 16,
    elevation: 2,
  },

  billHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  billTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0D0D0D',
    letterSpacing: -0.3,
  },

  instantBadge: {
    backgroundColor: '#A8E63A20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  instantBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#22CC71',
    letterSpacing: 0.5,
  },

  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  labelRowWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  rowLeadIcon: {
    fontSize: 13,
    color: '#64748B',
  },

  billLabel: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },

  billValue: {
    color: '#0D0D0D',
    fontSize: 13,
    fontWeight: '700',
  },

  freeText: {
    color: '#22CC71',
    fontWeight: '800',
  },

  thickDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },

  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  grandTotalLabel: {
    color: '#0D0D0D',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.3,
  },

  gstNotice: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },

  grandTotalValue: {
    color: '#22CC71',
    fontSize: 20,
    fontWeight: '900',
  },

  stickyFooter: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0D0D0D',
    shadowOffset: {
      width: 0,
      height: -10,
    },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 10,
  },

  checkoutButton: {
    backgroundColor: '#22CC71',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22CC71',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },

  checkoutTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  checkoutPrice: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },

  checkoutDivider: {
    color: '#A8E63A',
    fontWeight: '300',
    fontSize: 16,
    opacity: 0.6,
  },

  checkoutActionText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },

  emptyContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },

  emptyIconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#EAEFF3',
  },

  emptyIcon: {
    fontSize: 40,
  },

  emptyTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0D0D0D',
    marginBottom: 8,
    letterSpacing: -0.5,
  },

  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 20,
    paddingHorizontal: 16,
  },

  continueButton: {
    backgroundColor: '#22CC71',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    shadowColor: '#22CC71',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },

  continueButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },

  microInteraction: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },

  opacityInteraction: {
    opacity: 0.7,
  },
});