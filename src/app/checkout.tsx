import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { cart, CartItem, clearCart } from '../lib/cart';
import { supabase } from '../lib/supabase';
import { calculateBilling, DeliveryConfig } from '../utils/billing';
import { calculateDistance } from '../utils/distance';

interface SavedAddress {
  id?: string;
  address_line1: string;
  address_line2: string;
  landmark: string;
  city: string;
  state: string;
  pin_code: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface VendorData {
  vendorId: string;
  storeName: string;
  latitude: number | null;
  longitude: number | null;
  planName: string;
  commissionPercent: number;
}

interface VendorOrderGroup {
  vendorId: string;
  storeName: string;
  items: CartItem[];
  subtotal: number;
  distanceKm: number | null;
  billing: ReturnType<typeof calculateBilling>;
}

interface CreatedVendorOrderSummary {
  orderId: string;
  orderNumber: string;
  storeName: string;
  totalAmount: number;
  otp: string;
}

export default function CheckoutScreen() {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);

  const [address, setAddress] = useState<SavedAddress | null>(null);
  const [loading, setLoading] = useState(true);

  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const [showAddressForm, setShowAddressForm] = useState(false);

  const [formAddress, setFormAddress] = useState<SavedAddress>({
    address_line1: '',
    address_line2: '',
    landmark: '',
    city: '',
    state: '',
    pin_code: '',
    latitude: null,
    longitude: null,
  });

  const [createdOrders, setCreatedOrders] = useState<
    CreatedVendorOrderSummary[] | null
  >(null);

  const [platformFee, setPlatformFee] = useState(0);
  const [deliveryConfig, setDeliveryConfig] =
    useState<DeliveryConfig | null>(null);

  const [vendorDataMap, setVendorDataMap] = useState<
    Record<string, VendorData>
  >({});

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const checkmarkBounce = useRef(new Animated.Value(0)).current;

  /*
   * SUCCESS ANIMATION
   */
  useEffect(() => {
    if (createdOrders !== null) {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.95);
      checkmarkBounce.setValue(0);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(checkmarkBounce, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [createdOrders, fadeAnim, scaleAnim, checkmarkBounce]);

  /*
   * GROUP CART ITEMS BY VENDOR
   *
   * Every unique vendor gets one order.
   */
  const vendorOrderGroups: VendorOrderGroup[] = useMemo(() => {
    const groups = new Map<string, CartItem[]>();

    cart.forEach(item => {
      if (!item.vendor_id) {
        return;
      }

      const vendorId = String(item.vendor_id);

      const existingItems = groups.get(vendorId) ?? [];

      existingItems.push(item);

      groups.set(vendorId, existingItems);
    });

    const result: VendorOrderGroup[] = [];

    groups.forEach((items, vendorId) => {
      const vendorInfo = vendorDataMap[vendorId];

      const storeName =
        vendorInfo?.storeName?.trim() || 'Partner Store';

      let distanceKm: number | null = null;

      if (
        address?.latitude != null &&
        address?.longitude != null &&
        vendorInfo?.latitude != null &&
        vendorInfo?.longitude != null
      ) {
        distanceKm = calculateDistance(
          Number(vendorInfo.latitude),
          Number(vendorInfo.longitude),
          Number(address.latitude),
          Number(address.longitude)
        );
      }

      const commissionPercent = Number.isFinite(
        Number(vendorInfo?.commissionPercent)
      )
        ? Number(vendorInfo?.commissionPercent)
        : 5;

      const billing = calculateBilling({
        cartItems: items,
        distanceKm: distanceKm ?? 0,
        platformFee,
        commissionPercent,
        deliveryConfig,
      });

      const subtotal = items.reduce(
        (sum, item) =>
          sum +
          Number(item.price || 0) * Number(item.quantity || 0),
        0
      );

      result.push({
        vendorId,
        storeName,
        items,
        subtotal,
        distanceKm,
        billing,
      });
    });

    return result;
  }, [
    vendorDataMap,
    address,
    platformFee,
    deliveryConfig,
  ]);

  /*
   * AGGREGATED CUSTOMER BILL
   */
  const aggregateBilling = useMemo(() => {
    let itemsTotal = 0;
    let deliveryFee = 0;
    let totalPlatformFee = 0;
    let grandTotal = 0;

    vendorOrderGroups.forEach(group => {
      itemsTotal += Number(group.billing.itemsTotal || 0);
      deliveryFee += Number(group.billing.deliveryFee || 0);
      totalPlatformFee += Number(group.billing.platformFee || 0);
      grandTotal += Number(group.billing.grandTotal || 0);
    });

    return {
      itemsTotal,
      deliveryFee,
      platformFee: totalPlatformFee,
      grandTotal,
    };
  }, [vendorOrderGroups]);

  /*
   * LOAD CHECKOUT DATA
   */
  useEffect(() => {
    loadCheckoutDetails();
  }, []);

  async function loadCheckoutDetails() {
    try {
      setLoading(true);

      /*
       * PLATFORM FEE
       */
      const { data: feeSettings, error: feeSettingsError } =
        await supabase
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', 'platform_fee')
          .maybeSingle();

      if (feeSettingsError) {
        console.error(
          'Error loading platform fee:',
          feeSettingsError
        );

        setPlatformFee(0);
      } else if (
        feeSettings?.setting_value !== null &&
        feeSettings?.setting_value !== undefined
      ) {
        const fixedPlatformFee = Number(
          feeSettings.setting_value
        );

        setPlatformFee(
          Number.isFinite(fixedPlatformFee) &&
            fixedPlatformFee >= 0
            ? fixedPlatformFee
            : 0
        );
      } else {
        setPlatformFee(0);
      }

      /*
       * DELIVERY CONFIG
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
          const parsedDelivery =
            typeof deliverySettings.setting_value === 'string'
              ? JSON.parse(deliverySettings.setting_value)
              : deliverySettings.setting_value;

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
      }

      /*
       * AUTHENTICATION
       */
      const { data: authData, error: userError } =
        await supabase.auth.getUser();

      const user = authData?.user ?? null;

      if (userError || !user) {
        Alert.alert(
          'Login Required',
          'Please login before placing an order.'
        );

        router.replace('/login');

        return;
      }

      setAuthUserId(user.id);

      /*
       * CUSTOMER
       */
      const { data: customer, error: customerError } =
        await supabase
          .from('customers')
          .select('id, customer_name, phone')
          .eq('auth_user_id', user.id)
          .maybeSingle();

      if (customerError) {
        console.error(
          'Error loading customer:',
          customerError
        );
      }

      if (customer) {
        setCustomerId(String(customer.id));
        setCustomerName(customer.customer_name || '');
        setPhone(customer.phone || '');

        /*
         * DEFAULT ADDRESS
         */
        const {
          data: addressData,
          error: addressError,
        } = await supabase
          .from('customer_addresses')
          .select(
            'id, address_line1, address_line2, landmark, city, state, pin_code, latitude, longitude'
          )
          .eq('customer_id', customer.id)
          .eq('is_default', true)
          .maybeSingle();

        if (addressError) {
          console.error(
            'Error loading address:',
            addressError
          );
        }

        if (addressData) {
          setAddress({
            id: addressData.id,
            address_line1:
              addressData.address_line1 || '',
            address_line2:
              addressData.address_line2 || '',
            landmark: addressData.landmark || '',
            city: addressData.city || '',
            state: addressData.state || '',
            pin_code: addressData.pin_code || '',
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

      /*
       * LOAD UNIQUE VENDORS
       */
      const uniqueVendorIds = Array.from(
        new Set(
          cart
            .map(item =>
              item.vendor_id
                ? String(item.vendor_id)
                : null
            )
            .filter(
              (value): value is string => Boolean(value)
            )
        )
      );

      const newMap: Record<string, VendorData> = {};

      for (const vendorId of uniqueVendorIds) {
        /*
         * VENDOR PROFILE
         */
        const {
          data: vendorProfile,
          error: vendorProfileError,
        } = await supabase
          .from('vendor_profiles')
          .select(
            'store_name, latitude, longitude'
          )
          .eq('vendor_id', vendorId)
          .maybeSingle();

        if (vendorProfileError) {
          console.error(
            `Error loading vendor profile ${vendorId}:`,
            vendorProfileError
          );
        }

        /*
         * FALLBACK VENDOR NAME
         */
        let storeName =
          vendorProfile?.store_name || '';

        if (!storeName.trim()) {
          const { data: vendorRecord } =
            await supabase
              .from('vendors')
              .select('shop_name')
              .eq('id', vendorId)
              .maybeSingle();

          storeName =
            vendorRecord?.shop_name ||
            'Partner Store';
        }

        /*
         * ACTIVE SUBSCRIPTION
         *
         * commission_percent is the source of truth.
         */
        let commissionPercent = 5;
        let planName = 'free';

        try {
          const { data: subscription } =
            await supabase
              .from('subscriptions')
              .select(
                'plan_name, commission_percent, status'
              )
              .eq('vendor_id', vendorId)
              .eq('status', 'active')
              .order('end_date', {
                ascending: false,
              })
              .limit(1)
              .maybeSingle();

          if (subscription) {
            if (subscription.plan_name) {
              planName =
                String(
                  subscription.plan_name
                ).toLowerCase();
            }

            if (
              subscription.commission_percent !==
                null &&
              subscription.commission_percent !==
                undefined
            ) {
              const databaseCommission =
                Number(
                  subscription.commission_percent
                );

              if (
                Number.isFinite(
                  databaseCommission
                ) &&
                databaseCommission >= 0
              ) {
                commissionPercent =
                  databaseCommission;
              }
            }
          }
        } catch (error) {
          console.error(
            `Error loading subscription for ${vendorId}:`,
            error
          );
        }

        newMap[vendorId] = {
          vendorId,
          storeName,
          latitude:
            vendorProfile?.latitude !== null &&
            vendorProfile?.latitude !== undefined
              ? Number(
                  vendorProfile.latitude
                )
              : null,
          longitude:
            vendorProfile?.longitude !== null &&
            vendorProfile?.longitude !== undefined
              ? Number(
                  vendorProfile.longitude
                )
              : null,
          planName,
          commissionPercent,
        };
      }

      setVendorDataMap(newMap);
    } catch (error) {
      console.error(
        'Error loading checkout setup:',
        error
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * CREATE CUSTOMER PROFILE IF NEEDED
   */
  async function handleCreateProfile() {
    if (!customerName.trim() || !phone.trim()) {
      Alert.alert(
        'Missing Fields',
        'Please enter your full name and phone number.'
      );

      return;
    }

    if (!authUserId) {
      return;
    }

    try {
      setCreatingProfile(true);

      const { data, error } = await supabase
        .from('customers')
        .insert({
          auth_user_id: authUserId,
          customer_name:
            customerName.trim(),
          phone: phone.trim(),
        })
        .select()
        .single();

      if (error || !data) {
        Alert.alert(
          'Error',
          error?.message ||
            'Could not create your customer profile.'
        );

        return;
      }

      setCustomerId(String(data.id));

      Alert.alert(
        'Success',
        'Profile linked successfully.'
      );
    } catch (error) {
      console.error(
        'Error creating customer profile:',
        error
      );

      Alert.alert(
        'Error',
        'Could not create your customer profile.'
      );
    } finally {
      setCreatingProfile(false);
    }
  }

  /*
   * ADDRESS FORM
   */
  const updateFormField = (
    key: keyof SavedAddress,
    value: string
  ) => {
    setFormAddress(previous => ({
      ...previous,
      [key]: value,
    }));
  };

  const validateForm = () => {
    if (
      !formAddress.address_line1.trim() ||
      !formAddress.city.trim() ||
      !formAddress.pin_code.trim()
    ) {
      Alert.alert(
        'Missing Fields',
        'Please complete address line 1, city and pincode.'
      );

      return false;
    }

    return true;
  };

  async function handleAddressResolution(
    saveToDatabase: boolean
  ) {
    if (!validateForm() || !customerId) {
      return;
    }

    if (saveToDatabase) {
      try {
        await supabase
          .from('customer_addresses')
          .update({
            is_default: false,
          })
          .eq('customer_id', customerId);

        const {
          data: newAddress,
          error,
        } = await supabase
          .from('customer_addresses')
          .insert({
            customer_id: customerId,
            is_default: true,
            address_line1:
              formAddress.address_line1,
            address_line2:
              formAddress.address_line2 || null,
            landmark:
              formAddress.landmark || null,
            city: formAddress.city,
            state: formAddress.state,
            pin_code:
              formAddress.pin_code,
            latitude:
              formAddress.latitude ?? null,
            longitude:
              formAddress.longitude ?? null,
          })
          .select()
          .single();

        if (error) {
          console.error(
            'Error saving address:',
            error
          );

          setAddress({
            ...formAddress,
          });
        } else if (newAddress) {
          setAddress({
            id: newAddress.id,
            address_line1:
              newAddress.address_line1 || '',
            address_line2:
              newAddress.address_line2 || '',
            landmark:
              newAddress.landmark || '',
            city: newAddress.city || '',
            state: newAddress.state || '',
            pin_code:
              newAddress.pin_code || '',
            latitude:
              newAddress.latitude !== null &&
              newAddress.latitude !==
                undefined
                ? Number(
                    newAddress.latitude
                  )
                : null,
            longitude:
              newAddress.longitude !== null &&
              newAddress.longitude !==
                undefined
                ? Number(
                    newAddress.longitude
                  )
                : null,
          });
        }
      } catch (error) {
        console.error(
          'Error saving address:',
          error
        );

        setAddress({
          ...formAddress,
        });
      }
    } else {
      setAddress({
        ...formAddress,
      });
    }

    setShowAddressForm(false);
  }

  /*
   * PLACE MULTI-VENDOR ORDER
   */
  async function placeOrder() {
    if (isPlacingOrder) {
      return;
    }

    try {
      setIsPlacingOrder(true);

      /*
       * AUTH
       */
      const { data: userData } =
        await supabase.auth.getUser();

      if (!userData.user?.id) {
        Alert.alert(
          'Session Error',
          'Your session could not be verified. Please login again.'
        );

        return;
      }

      /*
       * CUSTOMER
       */
      const {
        data: currentCustomer,
        error: currentCustomerError,
      } = await supabase
        .from('customers')
        .select('id')
        .eq(
          'auth_user_id',
          userData.user.id
        )
        .maybeSingle();

      if (
        currentCustomerError ||
        !currentCustomer
      ) {
        Alert.alert(
          'Profile Error',
          'Could not locate your customer profile.'
        );

        return;
      }

      /*
       * ADDRESS
       */
      if (!address) {
        Alert.alert(
          'Address Required',
          'Please select or enter a delivery address.'
        );

        return;
      }

      /*
       * CART
       */
      if (!cart.length) {
        Alert.alert(
          'Cart Empty',
          'Please add products before checkout.'
        );

        return;
      }

      /*
       * VALIDATE THAT EVERY ITEM HAS A VENDOR
       */
      const itemsWithoutVendor = cart.filter(
        item => !item.vendor_id
      );

      if (itemsWithoutVendor.length > 0) {
        Alert.alert(
          'Checkout Error',
          'One or more cart items are missing vendor information. Please remove those items and add them again.'
        );

        return;
      }

      /*
       * ACTIVE ADDRESS MUST HAVE A DATABASE ID
       */
      let activeAddress: SavedAddress | null =
        address;

      if (!activeAddress.id) {
        const {
          data: freshAddress,
          error: freshAddressError,
        } = await supabase
          .from('customer_addresses')
          .select(
            'id, address_line1, address_line2, landmark, city, state, pin_code, latitude, longitude'
          )
          .eq(
            'customer_id',
            currentCustomer.id
          )
          .eq('is_default', true)
          .maybeSingle();

        if (
          !freshAddressError &&
          freshAddress
        ) {
          activeAddress = {
            id: freshAddress.id,
            address_line1:
              freshAddress.address_line1 ||
              '',
            address_line2:
              freshAddress.address_line2 ||
              '',
            landmark:
              freshAddress.landmark || '',
            city: freshAddress.city || '',
            state:
              freshAddress.state || '',
            pin_code:
              freshAddress.pin_code || '',
            latitude:
              freshAddress.latitude !== null &&
              freshAddress.latitude !==
                undefined
                ? Number(
                    freshAddress.latitude
                  )
                : null,
            longitude:
              freshAddress.longitude !== null &&
              freshAddress.longitude !==
                undefined
                ? Number(
                    freshAddress.longitude
                  )
                : null,
          };

          setAddress(activeAddress);
        }
      }

      if (!activeAddress?.id) {
        Alert.alert(
          'Address Error',
          'Unable to determine your delivery address. Please save your address again.'
        );

        return;
      }

      /*
       * MULTI-VENDOR ORDER CREATION
       */
      const createdOrderSummaries: CreatedVendorOrderSummary[] =
        [];

      for (const group of vendorOrderGroups) {
        /*
         * SAFETY
         */
        if (!group.vendorId) {
          throw new Error(
            'A cart group is missing its vendor.'
          );
        }

        if (!group.items.length) {
          continue;
        }

        /*
         * ORDER NUMBER
         */
        const orderNumber =
          'ORD-' +
          Math.floor(
            100000 +
              Math.random() * 900000
          );

        /*
         * DELIVERY OTP
         */
        const deliveryOtp =
          Math.floor(
            100000 +
              Math.random() * 900000
          ).toString();

        const vendorDistance =
          group.distanceKm !== null &&
          Number.isFinite(
            group.distanceKm
          )
            ? Number(
                group.distanceKm.toFixed(3)
              )
            : null;

        /*
         * ORDER PAYLOAD
         *
         * ONE ORDER = ONE VENDOR.
         */
        const orderPayload = {
          order_number:
            orderNumber,

          customer_id:
            currentCustomer.id,

          customer_auth_id:
            userData.user.id,

          customer_address_id:
            activeAddress.id,

          vendor_id:
            group.vendorId,

          subtotal:
            Number(
              group.billing.itemsTotal || 0
            ),

          delivery_fee:
            Number(
              group.billing.deliveryFee || 0
            ),

          platform_fee:
            Number(
              group.billing.platformFee || 0
            ),

          total_amount:
            Number(
              group.billing.grandTotal || 0
            ),

          payment_status:
            'pending',

          order_status:
            'pending',

          payment_method:
            'COD',

          delivery_code:
            deliveryOtp,

          delivery_distance_km:
            vendorDistance,

          actual_distance_km:
            vendorDistance,

          chargeable_distance_km:
            Number(
              group.billing
                .chargeableDistanceKm || 0
            ),

          rider_earning:
            Number(
              group.billing.riderEarning || 0
            ),

          rivo_delivery_margin:
            Number(
              group.billing
                .rivoDeliveryMargin || 0
            ),

          vendor_commission:
            Number(
              group.billing
                .vendorCommission || 0
            ),

          vendor_earning:
            Number(
              group.billing.vendorEarning || 0
            ),

          settled_vendor:
            false,

          settled_rider:
            false,
        };

        /*
         * CREATE ORDER
         */
        const {
          data: orderData,
          error: orderError,
        } = await supabase
          .from('orders')
          .insert(orderPayload)
          .select('id, order_number')
          .single();

        if (
          orderError ||
          !orderData
        ) {
          throw new Error(
            `Failed to create the order for ${group.storeName}. ${
              orderError?.message ||
              'Database insert failed.'
            }`
          );
        }

        /*
         * CREATE ORDER ITEMS
         */
        const itemsToInsert =
          group.items.map(item => {
            const itemPrice =
              Number(
                item.price || 0
              );

            const itemQuantity =
              Number(
                item.quantity || 0
              );

            const itemTotal =
              Number(
                (
                  itemPrice *
                  itemQuantity
                ).toFixed(2)
              );

            const gstRate =
              Number(
                item.gst_rate || 0
              );

            let taxableValue =
              itemTotal;

            let gstAmount = 0;

            if (
              gstRate > 0
            ) {
              taxableValue =
                Number(
                  (
                    itemTotal /
                    (1 +
                      gstRate /
                        100)
                  ).toFixed(2)
                );

              gstAmount =
                Number(
                  (
                    itemTotal -
                    taxableValue
                  ).toFixed(2)
                );
            }

            const halfGst =
              Number(
                (
                  gstAmount /
                  2
                ).toFixed(2)
              );

            return {
              order_id:
                orderData.id,

              product_id:
                item.id,

              quantity:
                itemQuantity,

              unit_price:
                itemPrice,

              total_price:
                itemTotal,

              product_name:
                item.name ||
                'Product',

              gst_rate:
                gstRate,

              taxable_value:
                taxableValue,

              gst_amount:
                gstAmount,

              cgst_amount:
                halfGst,

              sgst_amount:
                halfGst,

              igst_amount:
                0,

              hsn_code:
                null,
            };
          });

        const {
          error: itemsError,
        } = await supabase
          .from('order_items')
          .insert(itemsToInsert);

        if (itemsError) {
          throw new Error(
            `Failed to add items for ${group.storeName}. ${itemsError.message}`
          );
        }

        /*
         * COD PAYMENT RECORD
         */
        const {
          error: paymentError,
        } = await supabase
          .from('payments')
          .insert({
            order_id:
              orderData.id,

            amount:
              Number(
                group.billing
                  .grandTotal || 0
              ),

            payment_method:
              'COD',

            payment_status:
              'pending',
          });

        if (paymentError) {
          throw new Error(
            `Failed to create the payment record for ${group.storeName}. ${paymentError.message}`
          );
        }

        /*
         * SUCCESS SUMMARY
         */
        createdOrderSummaries.push({
          orderId:
            orderData.id,

          orderNumber:
            orderData.order_number ||
            orderNumber,

          storeName:
            group.storeName,

          totalAmount:
            Number(
              group.billing
                .grandTotal || 0
            ),

          otp:
            deliveryOtp,
        });
      }

      /*
       * NOTHING CREATED
       */
      if (
        createdOrderSummaries.length ===
        0
      ) {
        throw new Error(
          'No valid vendor orders could be created.'
        );
      }

      /*
       * ONLY CLEAR CART AFTER ALL
       * ORDERS + ITEMS + PAYMENTS SUCCEED.
       */
      clearCart();

      setCreatedOrders(
        createdOrderSummaries
      );
    } catch (error: any) {
      console.error(
        'Error placing multi-vendor order:',
        error
      );

      Alert.alert(
        'Order Placement Error',
        error?.message ||
          'Could not complete checkout. Please try again.'
      );
    } finally {
      setIsPlacingOrder(false);
    }
  }

  /*
   * LOADING
   *
   * Missing coordinates DO NOT block checkout.
   */
  if (loading) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <ActivityIndicator
          size="large"
          color="#22CC71"
        />

        <Text
          style={
            styles.loadingText
          }
        >
          Preparing checkout...
        </Text>
      </View>
    );
  }

  /*
   * EMPTY CART
   */
  if (!cart.length && !createdOrders) {
    return (
      <View
        style={
          styles.emptyCartContainer
        }
      >
        <Text
          style={
            styles.emptyCartTitle
          }
        >
          Your cart is empty
        </Text>

        <Text
          style={
            styles.emptyCartSubtitle
          }
        >
          Add some products before checkout.
        </Text>

        <Pressable
          style={
            styles.primaryButton
          }
          onPress={() =>
            router.replace('/')
          }
        >
          <Text
            style={
              styles.primaryButtonText
            }
          >
            Continue Shopping
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={
        styles.mainWrapper
      }
    >
      {/* HEADER */}
      <View
        style={
          styles.topNavBar
        }
      >
        <Pressable
          onPress={() =>
            router.back()
          }
          style={
            styles.backButtonIcon
          }
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color="#0D0D0D"
          />
        </Pressable>

        <Text
          style={
            styles.navTitle
          }
        >
          Checkout
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={
          styles.container
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* PROFILE */}
        {!customerId && (
          <View
            style={[
              styles.card,
              styles.profileWarningCard,
            ]}
          >
            <Text
              style={
                styles.profileWarningTitle
              }
            >
              Complete Your Profile
            </Text>

            <Text
              style={
                styles.profileWarningText
              }
            >
              Add your name and phone number
              to continue with checkout.
            </Text>

            <TextInput
              placeholder="Your Full Name *"
              placeholderTextColor="#94A3B8"
              value={customerName}
              onChangeText={
                setCustomerName
              }
              style={
                styles.input
              }
            />

            <TextInput
              placeholder="Mobile Phone Number *"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={
                setPhone
              }
              style={
                styles.input
              }
            />

            <Pressable
              onPress={
                handleCreateProfile
              }
              disabled={
                creatingProfile
              }
              style={({ pressed }) => [
                styles.profileCreateButton,
                pressed &&
                  styles.microInteractionState,
              ]}
            >
              {creatingProfile ? (
                <ActivityIndicator
                  color="#FFFFFF"
                  size="small"
                />
              ) : (
                <Text
                  style={
                    styles.profileCreateButtonText
                  }
                >
                  Create & Continue
                </Text>
              )}
            </Pressable>
          </View>
        )}

        {/* DELIVERY INFORMATION */}
        <View
          style={
            styles.deliveryInfoCard
          }
        >
          <View
            style={
              styles.deliveryInfoDot
            }
          />

          <View
            style={
              styles.deliveryInfoContent
            }
          >
            <Text
              style={
                styles.deliveryInfoTitle
              }
            >
              Delivery timing
            </Text>

            <Text
              style={
                styles.deliveryInfoText
              }
            >
              Your delivery time depends on
              the store and distance.
            </Text>
          </View>
        </View>

        {/* ADDRESS */}
        <View
          style={
            styles.card
          }
        >
          <Text
            style={
              styles.sectionHeader
            }
          >
            Delivery Address
          </Text>

          {address &&
          !showAddressForm ? (
            <View
              style={
                styles.addressInfoBox
              }
            >
              <Text
                style={
                  styles.addressText
                }
              >
                {address.address_line1}
              </Text>

              {!!address.address_line2 && (
                <Text
                  style={
                    styles.addressText
                  }
                >
                  {
                    address.address_line2
                  }
                </Text>
              )}

              {!!address.landmark && (
                <Text
                  style={
                    styles.addressSubtext
                  }
                >
                  Landmark:{' '}
                  {
                    address.landmark
                  }
                </Text>
              )}

              <Text
                style={
                  styles.addressCityText
                }
              >
                {address.city},{' '}
                {address.state} -{' '}
                {address.pin_code}
              </Text>

              <Pressable
                style={
                  styles.changeAddressBtn
                }
                onPress={() =>
                  setShowAddressForm(
                    true
                  )
                }
              >
                <Text
                  style={
                    styles.changeAddressBtnText
                  }
                >
                  Edit Address
                </Text>
              </Pressable>
            </View>
          ) : !showAddressForm ? (
            <View
              style={
                styles.addressEmptyState
              }
            >
              <Text
                style={
                  styles.errorText
                }
              >
                No delivery address configured.
              </Text>

              <Pressable
                disabled={
                  !customerId
                }
                style={[
                  styles.primaryButton,
                  !customerId &&
                    styles.disabledButton,
                ]}
                onPress={() =>
                  setShowAddressForm(
                    true
                  )
                }
              >
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Add Address
                </Text>
              </Pressable>
            </View>
          ) : null}

          {showAddressForm && (
            <View
              style={
                styles.addressFormFields
              }
            >
              <TextInput
                placeholder="Address Line 1 *"
                placeholderTextColor="#94A3B8"
                value={
                  formAddress.address_line1
                }
                onChangeText={value =>
                  updateFormField(
                    'address_line1',
                    value
                  )
                }
                style={
                  styles.input
                }
              />

              <TextInput
                placeholder="Address Line 2"
                placeholderTextColor="#94A3B8"
                value={
                  formAddress.address_line2
                }
                onChangeText={value =>
                  updateFormField(
                    'address_line2',
                    value
                  )
                }
                style={
                  styles.input
                }
              />

              <TextInput
                placeholder="Landmark"
                placeholderTextColor="#94A3B8"
                value={
                  formAddress.landmark
                }
                onChangeText={value =>
                  updateFormField(
                    'landmark',
                    value
                  )
                }
                style={
                  styles.input
                }
              />

              <View
                style={
                  styles.row
                }
              >
                <TextInput
                  placeholder="City *"
                  placeholderTextColor="#94A3B8"
                  value={
                    formAddress.city
                  }
                  onChangeText={value =>
                    updateFormField(
                      'city',
                      value
                    )
                  }
                  style={[
                    styles.input,
                    styles.halfInputLeft,
                  ]}
                />

                <TextInput
                  placeholder="State"
                  placeholderTextColor="#94A3B8"
                  value={
                    formAddress.state
                  }
                  onChangeText={value =>
                    updateFormField(
                      'state',
                      value
                    )
                  }
                  style={[
                    styles.input,
                    styles.halfInputRight,
                  ]}
                />
              </View>

              <TextInput
                placeholder="Pin Code *"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                value={
                  formAddress.pin_code
                }
                onChangeText={value =>
                  updateFormField(
                    'pin_code',
                    value
                  )
                }
                style={
                  styles.input
                }
              />

              <Text
                style={
                  styles.promptLabel
                }
              >
                Save this address for future
                checkouts?
              </Text>

              <View
                style={
                  styles.row
                }
              >
                <Pressable
                  style={[
                    styles.actionChip,
                    styles.saveDefaultChip,
                  ]}
                  onPress={() =>
                    handleAddressResolution(
                      true
                    )
                  }
                >
                  <Text
                    style={
                      styles.actionChipText
                    }
                  >
                    Save Default
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.actionChip,
                    styles.useOnceChip,
                  ]}
                  onPress={() =>
                    handleAddressResolution(
                      false
                    )
                  }
                >
                  <Text
                    style={
                      styles.actionChipText
                    }
                  >
                    Use Once
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* MULTI-VENDOR ORDER */}
        <View
          style={
            styles.card
          }
        >
          <View
            style={
              styles.sectionHeaderRow
            }
          >
            <Text
              style={
                styles.sectionHeader
              }
            >
              Your Order
            </Text>

            <Text
              style={
                styles.itemCountText
              }
            >
              {cart.length}{' '}
              {cart.length === 1
                ? 'item'
                : 'items'}
            </Text>
          </View>

          {vendorOrderGroups.map(
            (group, groupIndex) => (
              <View
                key={
                  group.vendorId
                }
                style={[
                  styles.vendorGroupBlock,
                  groupIndex >
                    0 &&
                    styles.vendorGroupSeparator,
                ]}
              >
                <View
                  style={
                    styles.vendorHeaderRow
                  }
                >
                  <Text
                    style={
                      styles.vendorStoreTitle
                    }
                  >
                    {group.storeName}
                  </Text>

                  {group.distanceKm !==
                    null && (
                    <Text
                      style={
                        styles.vendorDistanceText
                      }
                    >
                      {group.distanceKm.toFixed(
                        1
                      )}{' '}
                      km
                    </Text>
                  )}
                </View>

                {group.items.map(
                  (
                    item,
                    itemIndex
                  ) => (
                    <View
                      key={`${group.vendorId}-${item.id}-${itemIndex}`}
                      style={
                        styles.summaryItemRow
                      }
                    >
                      <View
                        style={
                          styles.summaryItemContent
                        }
                      >
                        <Text
                          style={
                            styles.itemName
                          }
                          numberOfLines={
                            2
                          }
                        >
                          {item.name}
                        </Text>

                        <Text
                          style={
                            styles.itemQuantity
                          }
                        >
                          Qty:{' '}
                          {
                            item.quantity
                          }{' '}
                          × ₹
                          {Number(
                            item.price ||
                              0
                          ).toFixed(
                            2
                          )}
                        </Text>
                      </View>

                      <Text
                        style={
                          styles.itemPrice
                        }
                      >
                        ₹
                        {(
                          Number(
                            item.price ||
                              0
                          ) *
                          Number(
                            item.quantity ||
                              0
                          )
                        ).toFixed(2)}
                      </Text>
                    </View>
                  )
                )}

                <View
                  style={
                    styles.vendorSubtotalRow
                  }
                >
                  <Text
                    style={
                      styles.vendorSubtotalLabel
                    }
                  >
                    Store Subtotal
                  </Text>

                  <Text
                    style={
                      styles.vendorSubtotalValue
                    }
                  >
                    ₹
                    {group.subtotal.toFixed(
                      2
                    )}
                  </Text>
                </View>
              </View>
            )
          )}
        </View>

        {/* BILL DETAILS */}
        <View
          style={
            styles.card
          }
        >
          <Text
            style={
              styles.sectionHeader
            }
          >
            Bill Details
          </Text>

          <View
            style={
              styles.breakdownRow
            }
          >
            <Text
              style={
                styles.breakdownLabel
              }
            >
              Items Total
            </Text>

            <Text
              style={
                styles.breakdownValue
              }
            >
              ₹
              {aggregateBilling.itemsTotal.toFixed(
                2
              )}
            </Text>
          </View>

          <View
            style={
              styles.breakdownRow
            }
          >
            <Text
              style={
                styles.breakdownLabel
              }
            >
              Delivery Fee
            </Text>

            <Text
              style={
                styles.breakdownValue
              }
            >
              ₹
              {aggregateBilling.deliveryFee.toFixed(
                2
              )}
            </Text>
          </View>

          <View
            style={
              styles.breakdownRow
            }
          >
            <Text
              style={
                styles.breakdownLabel
              }
            >
              Platform Fee
            </Text>

            <Text
              style={
                styles.breakdownValue
              }
            >
              ₹
              {aggregateBilling.platformFee.toFixed(
                2
              )}
            </Text>
          </View>

          <Text
            style={
              styles.gstNotice
            }
          >
            Prices shown are inclusive of
            applicable GST.
          </Text>

          <View
            style={
              styles.grandTotalRow
            }
          >
            <Text
              style={
                styles.grandTotalLabel
              }
            >
              Grand Total
            </Text>

            <Text
              style={
                styles.grandTotalValue
              }
            >
              ₹
              {aggregateBilling.grandTotal.toFixed(
                2
              )}
            </Text>
          </View>
        </View>

        {/* PAYMENT */}
        <View
          style={
            styles.card
          }
        >
          <Text
            style={
              styles.sectionHeader
            }
          >
            Payment Method
          </Text>

          <View
            style={
              styles.paymentOptionSelected
            }
          >
            <View
              style={
                styles.radioFilled
              }
            />

            <View
              style={
                styles.paymentTextWrapper
              }
            >
              <Text
                style={
                  styles.paymentMethodNameText
                }
              >
                Cash on Delivery
              </Text>

              <Text
                style={
                  styles.paymentMethodSubtitleText
                }
              >
                Pay cash to the rider when
                your order is delivered.
              </Text>
            </View>
          </View>

          <View
            style={
              styles.noticeCardContainer
            }
          >
            <Text
              style={
                styles.noticeCardBody
              }
            >
              We're currently working on
              bringing online payments to
              RivoCity.
              {'\n\n'}
              For now, you can safely place
              your order using Cash on
              Delivery.
              {'\n\n'}
              Thank you for understanding
              and for using RivoCity.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* STICKY FOOTER */}
      <View
        style={
          styles.stickyFooterPanel
        }
      >
        <View
          style={
            styles.stickyFooterLeft
          }
        >
          <Text
            style={
              styles.orderTotalTitleLabel
            }
          >
            Order Total
          </Text>

          <Text
            style={
              styles.stickyTotalAmountText
            }
          >
            ₹
            {aggregateBilling.grandTotal.toFixed(
              2
            )}
          </Text>
        </View>

        <Pressable
          onPress={
            placeOrder
          }
          disabled={
            !address ||
            isPlacingOrder ||
            !customerId ||
            !vendorOrderGroups.length
          }
          style={({ pressed }) => [
            styles.stickyOrderPlacementButton,
            (!address ||
              isPlacingOrder ||
              !customerId ||
              !vendorOrderGroups.length) &&
              styles.disabledButton,
            pressed &&
              address &&
              !isPlacingOrder &&
              customerId &&
              vendorOrderGroups.length > 0 &&
              styles.microInteractionState,
          ]}
        >
          {isPlacingOrder ? (
            <ActivityIndicator
              color="#FFFFFF"
              size="small"
            />
          ) : (
            <Text
              style={
                styles.stickyButtonText
              }
            >
              Place Order
            </Text>
          )}
        </Pressable>
      </View>

      {/* SUCCESS MODAL */}
      <Modal
        visible={
          createdOrders !== null
        }
        animationType="none"
        transparent
      >
        <View
          style={
            styles.modalSystemOverlayBackground
          }
        >
          <Animated.View
            style={[
              styles.successScreenCardContainer,
              {
                opacity:
                  fadeAnim,
                transform: [
                  {
                    scale:
                      scaleAnim,
                  },
                ],
              },
            ]}
          >
            <ScrollView
              style={
                styles.successScroll
              }
              contentContainerStyle={
                styles.successScrollContent
              }
              showsVerticalScrollIndicator={
                false
              }
            >
              <Animated.View
                style={[
                  styles.successScreenBadgeCircle,
                  {
                    transform: [
                      {
                        scale:
                          checkmarkBounce.interpolate(
                            {
                              inputRange: [
                                0,
                                0.5,
                                0.8,
                                1,
                              ],
                              outputRange: [
                                0.3,
                                1.2,
                                0.95,
                                1,
                              ],
                            }
                          ),
                      },
                    ],
                  },
                ]}
              >
                <Ionicons
                  name="checkmark"
                  size={32}
                  color="#FFFFFF"
                />
              </Animated.View>

              <Text
                style={
                  styles.successTitle
                }
              >
                Order Placed Successfully
              </Text>

              <Text
                style={
                  styles.successSubtitle
                }
              >
                Thank you for ordering on
                RivoCity
              </Text>

              <Text
                style={
                  styles.successOrderCountText
                }
              >
                {createdOrders?.length ===
                1
                  ? 'Your order has been sent to the store.'
                  : `${createdOrders?.length} vendor orders have been created.`}
              </Text>

              {createdOrders?.map(
                (
                  order,
                  index
                ) => (
                  <View
                    key={
                      order.orderId
                    }
                    style={
                      styles.successMetaCard
                    }
                  >
                    <View
                      style={
                        styles.successVendorHeader
                      }
                    >
                      <Text
                        style={
                          styles.successVendorStoreHeader
                        }
                      >
                        {
                          order.storeName
                        }
                      </Text>

                      <Text
                        style={
                          styles.successVendorOrderNumberBadge
                        }
                      >
                        {
                          order.orderNumber
                        }
                      </Text>
                    </View>

                    <View
                      style={
                        styles.metaItemSeparator
                      }
                    />

                    <View
                      style={
                        styles.metaItemRow
                      }
                    >
                      <Text
                        style={
                          styles.metaCardLabel
                        }
                      >
                        Payment
                      </Text>

                      <Text
                        style={
                          styles.metaCardValue
                        }
                      >
                        Cash on Delivery
                      </Text>
                    </View>

                    <View
                      style={
                        styles.metaItemRow
                      }
                    >
                      <Text
                        style={
                          styles.metaCardLabel
                        }
                      >
                        Order Amount
                      </Text>

                      <Text
                        style={
                          styles.metaCardValueHighlight
                        }
                      >
                        ₹
                        {order.totalAmount.toFixed(
                          2
                        )}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.metaItemSeparator
                      }
                    />

                    <Pressable
                      style={({ pressed }) => [
                        styles.trackOrderInlineButton,
                        pressed &&
                          styles.microInteractionState,
                      ]}
                      onPress={() => {
                        setCreatedOrders(
                          null
                        );

                        router.replace({
                          pathname:
                            '/orders/[id]',
                          params: {
                            id: order.orderId,
                          },
                        });
                      }}
                    >
                      <Text
                        style={
                          styles.trackOrderInlineButtonText
                        }
                      >
                        Track Order
                      </Text>
                    </Pressable>

                    {index <
                      (createdOrders?.length ??
                        0) -
                        1 && (
                      <View
                        style={
                          styles.successOrderDivider
                        }
                      />
                    )}
                  </View>
                )
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.returnShoppingButton,
                  pressed &&
                    styles.microInteractionState,
                ]}
                onPress={() => {
                  setCreatedOrders(
                    null
                  );

                  router.replace(
                    '/'
                  );
                }}
              >
                <Text
                  style={
                    styles.returnShoppingButtonText
                  }
                >
                  Continue Shopping
                </Text>
              </Pressable>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },

  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
  },

  emptyCartContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#FAFAFA',
  },

  emptyCartTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0D0D0D',
  },

  emptyCartSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 6,
    marginBottom: 20,
    textAlign: 'center',
  },

  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },

  backButtonIcon: {
    padding: 8,
    marginRight: 8,
  },

  navTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D0D0D',
  },

  container: {
    padding: 16,
    paddingBottom: 170,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },

  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0D0D0D',
    marginBottom: 14,
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  itemCountText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 14,
  },

  profileWarningCard: {
    borderColor: '#F97316',
    backgroundColor: '#FFF7ED',
  },

  profileWarningTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F97316',
    marginBottom: 6,
  },

  profileWarningText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
    fontWeight: '500',
    lineHeight: 18,
  },

  profileCreateButton: {
    backgroundColor: '#F97316',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },

  profileCreateButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  deliveryInfoCard: {
    flexDirection: 'row',
    backgroundColor: '#E8FBF0',
    borderWidth: 1,
    borderColor: '#22CC71',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
  },

  deliveryInfoDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22CC71',
    marginRight: 12,
  },

  deliveryInfoContent: {
    flex: 1,
  },

  deliveryInfoTitle: {
    fontSize: 13,
    color: '#0D0D0D',
    fontWeight: '700',
  },

  deliveryInfoText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 17,
  },

  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0D0D0D',
    marginBottom: 10,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  halfInputLeft: {
    flex: 1,
    marginRight: 8,
  },

  halfInputRight: {
    flex: 1,
  },

  addressInfoBox: {
    marginTop: 2,
  },

  addressText: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
    lineHeight: 20,
  },

  addressSubtext: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 7,
  },

  addressCityText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 5,
    fontWeight: '500',
  },

  changeAddressBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },

  changeAddressBtnText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },

  addressEmptyState: {
    alignItems: 'center',
    paddingVertical: 10,
  },

  errorText: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
    fontWeight: '500',
  },

  primaryButton: {
    backgroundColor: '#22CC71',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },

  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  addressFormFields: {
    marginTop: 4,
  },

  promptLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 6,
    marginBottom: 8,
  },

  actionChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },

  saveDefaultChip: {
    backgroundColor: '#22CC71',
    marginRight: 8,
  },

  useOnceChip: {
    backgroundColor: '#64748B',
  },

  actionChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  vendorGroupBlock: {
    paddingVertical: 8,
  },

  vendorGroupSeparator: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    marginTop: 8,
    paddingTop: 14,
  },

  vendorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  vendorStoreTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0D0D0D',
  },

  vendorDistanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#22CC71',
    marginLeft: 10,
  },

  summaryItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
  },

  summaryItemContent: {
    flex: 1,
    paddingRight: 12,
  },

  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },

  itemQuantity: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },

  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D0D0D',
  },

  vendorSubtotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 9,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },

  vendorSubtotalLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },

  vendorSubtotalValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D0D0D',
  },

  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },

  breakdownLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },

  breakdownValue: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },

  gstNotice: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 6,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },

  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
  },

  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D0D0D',
  },

  grandTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#22CC71',
  },

  paymentOptionSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8FBF0',
    borderWidth: 1.5,
    borderColor: '#22CC71',
    borderRadius: 14,
    padding: 16,
  },

  radioFilled: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 5,
    borderColor: '#22CC71',
    marginRight: 12,
    backgroundColor: '#FFFFFF',
  },

  paymentTextWrapper: {
    flex: 1,
  },

  paymentMethodNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D0D0D',
  },

  paymentMethodSubtitleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '500',
  },

  noticeCardContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
  },

  noticeCardBody: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
    fontWeight: '500',
  },

  stickyFooterPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 14,
    paddingBottom: 36,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -6,
    },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 6,
  },

  stickyFooterLeft: {
    flex: 1,
    justifyContent: 'center',
  },

  orderTotalTitleLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2,
  },

  stickyTotalAmountText: {
    fontSize: 21,
    fontWeight: '900',
    color: '#0D0D0D',
  },

  stickyOrderPlacementButton: {
    backgroundColor: '#22CC71',
    paddingHorizontal: 22,
    paddingVertical: 15,
    borderRadius: 14,
    minWidth: 150,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22CC71',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },

  stickyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  disabledButton: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },

  microInteractionState: {
    opacity: 0.9,
    transform: [
      {
        scale: 0.98,
      },
    ],
  },

  modalSystemOverlayBackground: {
    flex: 1,
    backgroundColor:
      'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },

  successScreenCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },

  successScroll: {
    width: '100%',
  },

  successScrollContent: {
    alignItems: 'center',
    paddingBottom: 6,
  },

  successScreenBadgeCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#22CC71',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    marginTop: 6,
  },

  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0D0D0D',
    textAlign: 'center',
  },

  successSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },

  successOrderCountText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 6,
  },

  successMetaCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    width: '100%',
    padding: 14,
    marginTop: 14,
  },

  successVendorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  successVendorStoreHeader: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0D0D0D',
    paddingRight: 8,
  },

  successVendorOrderNumberBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#22CC71',
    backgroundColor: '#E8FBF0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  metaItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },

  metaCardLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },

  metaCardValue: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
    textAlign: 'right',
  },

  metaCardValueHighlight: {
    fontSize: 14,
    color: '#22CC71',
    fontWeight: '800',
  },

  metaItemSeparator: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 8,
  },

  trackOrderInlineButton: {
    backgroundColor: '#22CC71',
    width: '100%',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },

  trackOrderInlineButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  successOrderDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginTop: 14,
  },

  returnShoppingButton: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 14,
  },

  returnShoppingButtonText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
});