// src/app/checkout.tsx
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Clipboard,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import { cart, clearCart } from '../lib/cart';
import { supabase } from '../lib/supabase';
import { calculateBilling, DeliveryConfig } from '../utils/billing';
import { calculateDistance } from "../utils/distance";

interface SavedAddress {
  address_line1: string;
  address_line2: string;
  landmark: string;
  city: string;
  state: string;
  pin_code: string;
  latitude?: number | null;
  longitude?: number | null;
}

export default function CheckoutScreen() {
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [address, setAddress] = useState<SavedAddress | null>(null);
  const [loading, setLoading] = useState(true);
  const [vendorLocation, setVendorLocation] = useState<{ latitude: number; longitude: number } | null>(null);
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

  const [successOrderDetails, setSuccessOrderDetails] = useState<{
    orderId: string;
    orderNumber: string;
    totalAmount: number;
    eta: string;
    paymentMethod: 'cod' | 'upi';
  } | null>(null);

  const [vendorPlanName, setVendorPlanName] = useState<string>('free');

  // Dynamic remote settings states
  const [platformFee, setPlatformFee] = useState<number>(0);
  const [deliveryConfig, setDeliveryConfig] = useState<DeliveryConfig | null>(null);

  // UPI payment specific states
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'upi'>('cod');
  const [upiSettings, setUpiSettings] = useState<{ qr_code_url?: string; upi_id?: string; merchant_name?: string } | null>(null);
  
  // Track deep link handoff state
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);

  // Animation values for success state
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const checkmarkBounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (successOrderDetails !== null) {
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
        })
      ]).start();
    }
  }, [successOrderDetails]);

  const distance = useMemo(() => {
    if (
      address?.latitude == null ||
      address?.longitude == null ||
      vendorLocation?.latitude == null ||
      vendorLocation?.longitude == null
    ) {
      return null;
    }
    return calculateDistance(
      vendorLocation.latitude,
      vendorLocation.longitude,
      Number(address.latitude),
      Number(address.longitude)
    );
  }, [address, vendorLocation]);

  // Unified cost calculation logic using the central billing engine
  const checkoutCharges = useMemo(() => {
    if (distance === null) {
      return {
        itemsTotal: 0,
        deliveryFee: 0,
        platformFee: 0,
        grandTotal: 0,
        chargeableDistanceKm: 0,
        riderEarning: 0,
        rivoDeliveryMargin: 0,
        vendorCommission: 0,
        vendorEarning: 0,
      };
    }

    // Map active subscription plans explicitly to target percentages
    let commissionPercent = 5;
    if (vendorPlanName === 'basic' || vendorPlanName === 'growth' || vendorPlanName === 'pro') {
      commissionPercent = 0;
    }

    return calculateBilling({
      cartItems: cart, 
      distanceKm: distance,
      platformFee,
      commissionPercent,
      deliveryConfig,
    });
  }, [cart, distance, vendorPlanName, platformFee, deliveryConfig]);

  useEffect(() => {
    loadCheckoutDetails();
  }, []);

  async function loadCheckoutDetails() {
    try {
      setLoading(true);

      // Fetch dynamic platform configurations asynchronously
      const { data: feeSettings } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'platform_fee_config')
        .maybeSingle();

      if (feeSettings?.setting_value) {
        const parsedFee = typeof feeSettings.setting_value === 'string' 
          ? JSON.parse(feeSettings.setting_value) 
          : feeSettings.setting_value;
        setPlatformFee(Number(parsedFee.platform_fee || 0));
      }

      const { data: deliverySettings } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'delivery_config')
        .maybeSingle();

      if (deliverySettings?.setting_value) {
        const parsedDelivery = typeof deliverySettings.setting_value === 'string'
          ? JSON.parse(deliverySettings.setting_value)
          : deliverySettings.setting_value;
        setDeliveryConfig({
          base_customer_fee: Number(parsedDelivery.base_customer_fee || 0),
          customer_increment: Number(parsedDelivery.customer_increment || 0),
          base_rider_earning: Number(parsedDelivery.base_rider_earning || 0),
          rider_increment: Number(parsedDelivery.rider_increment || 0),
          base_distance: Number(parsedDelivery.base_distance || 0),
          max_auto_distance: Number(parsedDelivery.max_auto_distance || 0),
        });
      }

      // Fetch UPI settings from platform_settings
      const { data: platformSettingsData } = await supabase
        .from('platform_settings')
        .select('setting_key, setting_value');

      if (platformSettingsData) {
        const upiObj: any = {};
        platformSettingsData.forEach((setting) => {
          if (setting.setting_key === 'qr_code_url' || setting.setting_key === 'upi_id' || setting.setting_key === 'merchant_name') {
            upiObj[setting.setting_key] = setting.setting_value;
          }
        });
        setUpiSettings(upiObj);
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        Alert.alert('Login Required', 'Please login before placing an order');
        router.replace('/login');
        return;
      }

      setAuthUserId(user.id);

      const { data: customer } = await supabase
        .from('customers')
        .select('id, customer_name, phone')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (customer) {
        setCustomerId(customer.id);
        setCustomerName(customer.customer_name || '');
        setPhone(customer.phone || '');

        const { data: addressData, error: addressError } = await supabase
          .from('customer_addresses')
          .select('address_line1, address_line2, landmark, city, state, pin_code, latitude, longitude')
          .eq('customer_id', customer.id)
          .eq('is_default', true)
          .maybeSingle();

        if (!addressError && addressData) {
          setAddress({
            address_line1: addressData.address_line1 || '',
            address_line2: addressData.address_line2 || '',
            landmark: addressData.landmark || '',
            city: addressData.city || '',
            state: addressData.state || '',
            pin_code: addressData.pin_code || '',
            latitude: addressData.latitude ? Number(addressData.latitude) : null,
            longitude: addressData.longitude ? Number(addressData.longitude) : null,
          });
        }
      }

      if (cart.length > 0) {
        const vendorId = cart[0].vendor_id;
        const { data: vendorProfile, error: vendorError } = await supabase
          .from('vendor_profiles')
          .select('latitude, longitude')
          .eq('vendor_id', vendorId)
          .maybeSingle();

        if (!vendorError && vendorProfile?.latitude && vendorProfile?.longitude) {
          setVendorLocation({
            latitude: Number(vendorProfile.latitude),
            longitude: Number(vendorProfile.longitude),
          });
        }

        try {
          const { data: vendorSub } = await supabase
            .from('subscriptions')
            .select('plan_name, status')
            .eq('vendor_id', vendorId)
            .eq('status', 'active')
            .maybeSingle();
            
          if (vendorSub && vendorSub.plan_name) {
            setVendorPlanName(vendorSub.plan_name.toLowerCase());
          } else {
            setVendorPlanName('free');
          }
        } catch (e) {
          console.error('Error determining vendor subscription:', e);
          setVendorPlanName('free');
        }
      }
    } catch (err) {
      console.error('Error loading checkout setup context:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateProfile() {
    if (!customerName.trim() || !phone.trim()) {
      Alert.alert('Missing Fields', 'Please enter your full name and phone number.');
      return;
    }
    if (!authUserId) return;

    try {
      setCreatingProfile(true);
      const { data, error } = await supabase
        .from('customers')
        .insert({
          auth_user_id: authUserId,
          customer_name: customerName.trim(),
          phone: phone.trim(),
        })
        .select()
        .single();

      if (!error && data) {
        setCustomerId(data.id);
        Alert.alert('Success 🎉', 'Profile linked successfully!');
      } else {
        Alert.alert('Error', error?.message || 'Could not instantiate your customer profile card.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setCreatingProfile(false);
    }
  }

  const updateFormField = (key: keyof SavedAddress, val: string) => {
    setFormAddress((prev) => ({ ...prev, [key]: val }));
  };

  const validateForm = () => {
    if (!formAddress.address_line1.trim() || !formAddress.city.trim() || !formAddress.pin_code.trim()) {
      Alert.alert('Missing Fields', 'Please complete the line 1, city, and pincode fields.');
      return false;
    }
    return true;
  };

  const handleAddressResolution = async (saveToDb: boolean) => {
    if (!validateForm() || !customerId) return;

    if (saveToDb) {
      try {
        await supabase
          .from('customer_addresses')
          .update({ is_default: false })
          .eq('customer_id', customerId);

        await supabase.from('customer_addresses').insert({
          customer_id: customerId,
          is_default: true,
          ...formAddress,
        });
      } catch (err) {
        console.error('Error recording default address mapping node:', err);
      }
    }

    setAddress({ ...formAddress });
    setShowAddressForm(false);
  };

  function handleCopyUpiId() {
    if (upiSettings?.upi_id) {
      Clipboard.setString(upiSettings.upi_id);
      Alert.alert('Copied', 'UPI ID copied to clipboard successfully.');
    }
  }

  const upiUrlString = useMemo(() => {
    if (!upiSettings?.upi_id) return '';
    return `upi://pay?pa=${upiSettings.upi_id}&pn=${encodeURIComponent(upiSettings.merchant_name || 'Merchant')}&am=${checkoutCharges.grandTotal}&cu=INR`;
  }, [upiSettings, checkoutCharges.grandTotal]);

  const handleGooglePay = async () => {
    if (!upiUrlString) return;
    const gpayUrl = Platform.OS === 'ios' ? upiUrlString.replace('upi://', 'gpay://') : upiUrlString;
    const canOpen = await Linking.canOpenURL(gpayUrl).catch(() => false);
    if (canOpen) {
      await Linking.openURL(gpayUrl);
      setPaymentSubmitted(true);
    } else {
      Alert.alert('App Not Found', 'Google Pay is not installed.');
    }
  };

  const handlePhonePe = async () => {
    if (!upiUrlString) return;
    const phonepeUrl = Platform.OS === 'ios' ? upiUrlString.replace('upi://', 'phonepe://') : upiUrlString;
    const canOpen = await Linking.canOpenURL(phonepeUrl).catch(() => false);
    if (canOpen) {
      await Linking.openURL(phonepeUrl);
      setPaymentSubmitted(true);
    } else {
      Alert.alert('App Not Found', 'PhonePe is not installed.');
    }
  };

  const handlePaytm = async () => {
    if (!upiUrlString) return;
    const paytmUrl = Platform.OS === 'ios' ? upiUrlString.replace('upi://', 'paytmmp://') : upiUrlString;
    const canOpen = await Linking.canOpenURL(paytmUrl).catch(() => false);
    if (canOpen) {
      await Linking.openURL(paytmUrl);
      setPaymentSubmitted(true);
    } else {
      Alert.alert('App Not Found', 'Paytm is not installed.');
    }
  };

  const handleOtherUpi = async () => {
    if (!upiUrlString) return;
    const canOpen = await Linking.canOpenURL(upiUrlString).catch(() => false);
    if (canOpen) {
      await Linking.openURL(upiUrlString);
      setPaymentSubmitted(true);
    } else {
      Alert.alert('App Link Error', 'Could not open any compatible UPI client apps.');
    }
  };

  async function placeOrder() {
    if (isPlacingOrder) return;

    try {
      setIsPlacingOrder(true);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user?.id) {
        Alert.alert('Session Error', 'No active user session detected by the client instance.');
        return;
      }

      const { data: testCustomer, error: testCustomerErr } = await supabase
        .from("customers")
        .select("id")
        .eq("auth_user_id", userData.user.id)
        .single();

      if (testCustomerErr || !testCustomer) {
        Alert.alert('Profile Resolution Failure', 'Could not locate a row in customers matching this user UID.');
        return;
      }

      if (!address) {
        Alert.alert('Error', 'Missing verified checkout destination address details.');
        return;
      }

      if (!cart.length) {
        Alert.alert('Cart Empty', 'Please add products before checkout');
        return;
      }

      const orderNumber = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
      const vendorId = cart[0].vendor_id;

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          customer_id: testCustomer.id,
          customer_auth_id: userData.user.id,
          vendor_id: vendorId,
          subtotal: checkoutCharges.itemsTotal,
          delivery_fee: checkoutCharges.deliveryFee,
          platform_fee: checkoutCharges.platformFee,
          total_amount: checkoutCharges.grandTotal,
          payment_status: 'pending',
          order_status: 'pending',
          actual_distance_km: distance || 0,
          chargeable_distance_km: checkoutCharges.chargeableDistanceKm,
          rider_earning: checkoutCharges.riderEarning,
          rivo_delivery_margin: checkoutCharges.rivoDeliveryMargin,
          vendor_commission: checkoutCharges.vendorCommission,
          vendor_earning: checkoutCharges.vendorEarning,
          settled_vendor: false,
          settled_rider: false,
          payment_method: paymentMethod,
        })
        .select()
        .single();

      if (orderError) {
        Alert.alert(
          "Order creation failed",
          `Code: ${orderError.code || 'N/A'}\nMessage: ${orderError.message || 'N/A'}`
        );
        return;
      }

      // Automatically generate a matching record inside the payments table
      const paymentPayload: any = {
        order_id: orderData.id,
        amount: checkoutCharges.grandTotal,
        payment_method: paymentMethod === 'cod' ? 'COD' : 'UPI',
        payment_status: 'pending',
      };

      const { error: paymentError } = await supabase
        .from('payments')
        .insert(paymentPayload);

      if (paymentError) {
        console.error('Payment entry instantiation failed:', paymentError);
        Alert.alert('Database Error', 'Could not record the global payment transaction tracking data row.');
      }

      for (const item of cart) {
        await supabase.from('order_items').insert({
          order_id: orderData.id,
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
        });
      }

      clearCart();

      setSuccessOrderDetails({
        orderId: orderData.id,
        orderNumber: orderNumber,
        totalAmount: checkoutCharges.grandTotal,
        eta: '5-15 mins',
        paymentMethod: paymentMethod,
      });
    } catch (error) {
      console.error('Error placing order:', error);
      Alert.alert('Error', JSON.stringify(error));
    } finally {
      setIsPlacingOrder(false);
    }
  }

  const isCoordinatesMissing = 
    (address !== null && (address.latitude == null || address.longitude == null)) ||
    (cart.length > 0 && (!vendorLocation || vendorLocation.latitude == null || vendorLocation.longitude == null));

  if (loading || isCoordinatesMissing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <View style={styles.mainWrapper}>
      <View style={styles.topNavBar}>
        <Pressable onPress={() => router.back()} style={styles.backButtonIcon}>
          <Text style={styles.backButtonTextSymbol}>←</Text>
        </Pressable>
        <Text style={styles.navTitle}>Checkout</Text>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {!customerId && (
          <View style={[styles.card, { borderColor: '#F59E0B', backgroundColor: '#FFFDF5' }]}>
            <Text style={[styles.sectionHeader, { color: '#D97706' }]}>👤 Link Delivery Profile</Text>
            <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 12, fontWeight: '500' }}>
              Your account doesn't have a delivery profile yet. Add your info to activate quick checkout.
            </Text>
            <TextInput
              placeholder="Your Full Name *"
              placeholderTextColor="#94A3B8"
              value={customerName}
              onChangeText={setCustomerName}
              style={styles.input}
            />
            <TextInput
              placeholder="Mobile Phone Number *"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              style={styles.input}
            />
            <Pressable 
              onPress={handleCreateProfile} 
              disabled={creatingProfile}
              style={({ pressed }) => [
                {
                  backgroundColor: '#D97706',
                  borderRadius: 12,
                  paddingVertical: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 12,
                },
                pressed && styles.microInteractionState
              ]}
            >
              {creatingProfile ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>Create & Continue</Text>
              )}
            </Pressable>
          </View>
        )}

        <View style={styles.etaCard}>
          <View style={styles.etaIconWrapper}>
            <Text style={styles.etaIcon}>⚡</Text>
          </View>
          <View style={styles.etaTextContent}>
            <Text style={styles.etaTitle}>Instant Delivery to your location</Text>
            <Text style={styles.etaTime}>Arriving in 5 - 15 Mins</Text>
          </View>
          {distance !== null && (
            <View style={styles.distanceTag}>
              <Text style={styles.distanceTagText}>{distance.toFixed(1)} km</Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>🎒 Delivery Address</Text>
          </View>
          
          {address && !showAddressForm ? (
            <View style={styles.addressInfoBox}>
              <Text style={styles.addressText}>{address.address_line1}</Text>
              {!!address.address_line2 && <Text style={styles.addressText}>{address.address_line2}</Text>}
              {!!address.landmark && (
                <View style={styles.landmarkWrapper}>
                  <Text style={styles.addressSubtext}>📍 Landmark: {address.landmark}</Text>
                </View>
              )}
              <Text style={styles.addressCityText}>
                {address.city}, {address.state} - {address.pin_code}
              </Text>

              <Pressable style={styles.changeAddressBtn} onPress={() => setShowAddressForm(true)}>
                <Text style={styles.changeAddressBtnText}>Edit Address Details</Text>
              </Pressable>
            </View>
          ) : !showAddressForm ? (
            <View style={styles.addressEmptyState}>
              <Text style={styles.errorText}>No shipping destination configured.</Text>
              <Pressable 
                disabled={!customerId} 
                style={[styles.primaryButton, !customerId && { backgroundColor: '#CBD5E1' }]} 
                onPress={() => setShowAddressForm(true)}
              >
                <Text style={styles.primaryButtonText}>Add New Address</Text>
              </Pressable>
            </View>
          ) : null}

          {showAddressForm && (
            <View style={styles.addressFormFields}>
              <TextInput
                placeholder="Address Line 1 *"
                placeholderTextColor="#94A3B8"
                value={formAddress.address_line1}
                onChangeText={(t) => updateFormField('address_line1', t)}
                style={styles.input}
              />
              <TextInput
                placeholder="Address Line 2"
                placeholderTextColor="#94A3B8"
                value={formAddress.address_line2}
                onChangeText={(t) => updateFormField('address_line2', t)}
                style={styles.input}
              />
              <TextInput
                placeholder="Landmark"
                placeholderTextColor="#94A3B8"
                value={formAddress.landmark}
                onChangeText={(t) => updateFormField('landmark', t)}
                style={styles.input}
              />
              <View style={styles.row}>
                <TextInput
                  placeholder="City *"
                  placeholderTextColor="#94A3B8"
                  value={formAddress.city}
                  onChangeText={(t) => updateFormField('city', t)}
                  style={[styles.input, { flex: 1, marginRight: 8 }]}
                />
                <TextInput
                  placeholder="State"
                  placeholderTextColor="#94A3B8"
                  value={formAddress.state}
                  onChangeText={(t) => updateFormField('state', t)}
                  style={[styles.input, { flex: 1 }]}
                />
              </View>
              <TextInput
                placeholder="Pin Code *"
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                value={formAddress.pin_code}
                onChangeText={(t) => updateFormField('pin_code', t)}
                style={styles.input}
              />

              <Text style={styles.promptLabel}>Save this address for future checkouts?</Text>
              <View style={styles.row}>
                <Pressable
                  style={[styles.actionChip, { backgroundColor: '#10B981', marginRight: 8 }]}
                  onPress={() => handleAddressResolution(true)}
                >
                  <Text style={styles.actionChipText}>Save Default</Text>
                </Pressable>
                <Pressable
                  style={[styles.actionChip, { backgroundColor: '#64748B' }]}
                  onPress={() => handleAddressResolution(false)}
                >
                  <Text style={styles.actionChipText}>Use Once</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionHeader}>📦 Order Summary ({cart.length} items)</Text>
          <View style={styles.summaryListBlock}>
            {cart.map((item, index) => (
              <View key={item.id || index} style={[styles.row, styles.summaryItemRow]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemQuantity}>Quantity: {item.quantity}</Text>
                </View>
                <Text style={styles.itemPrice}>₹{item.price * item.quantity}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionHeader}>📑 Bill Details</Text>
          <View style={[styles.row, styles.breakdownRow]}>
            <Text style={styles.breakdownLabel}>Items Total</Text>
            <Text style={styles.breakdownValue}>₹{checkoutCharges.itemsTotal}</Text>
          </View>
          <View style={[styles.row, styles.breakdownRow]}>
            <Text style={styles.breakdownLabel}>Delivery Fee</Text>
            <Text style={styles.breakdownValue}>₹{checkoutCharges.deliveryFee}</Text>
          </View>
          <View style={[styles.row, styles.breakdownRow]}>
            <Text style={styles.breakdownLabel}>Platform Fee</Text>
            <Text style={styles.breakdownValue}>₹{checkoutCharges.platformFee}</Text>
          </View>
          
          <Text style={styles.gstNotice}>
            Prices shown are inclusive of applicable GST.
          </Text>

          <View style={[styles.row, styles.grandTotalRow]}>
            <Text style={styles.grandTotalLabel}>Grand Total</Text>
            <Text style={styles.grandTotalValue}>₹{checkoutCharges.itemsTotal + checkoutCharges.deliveryFee + checkoutCharges.platformFee}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionHeader}>🎒 Payment Method</Text>
          
          <Pressable 
            onPress={() => {
              setPaymentMethod('cod');
              setPaymentSubmitted(false);
            }}
            style={({ pressed }) => [
              styles.row, 
              paymentMethod === 'cod' ? styles.paymentOptionSelected : styles.paymentOptionUnselected, 
              { marginBottom: 12 },
              pressed && styles.microInteractionState
            ]}
          >
            <View style={paymentMethod === 'cod' ? styles.radioFilled : styles.radioEmpty} />
            <Text style={styles.paymentMethodNameText}>Cash on Delivery</Text>
          </Pressable>

          <Pressable 
            onPress={() => setPaymentMethod('upi')}
            style={({ pressed }) => [
              styles.row, 
              paymentMethod === 'upi' ? styles.paymentOptionSelected : styles.paymentOptionUnselected,
              { marginBottom: 12 },
              pressed && styles.microInteractionState
            ]}
          >
            <View style={paymentMethod === 'upi' ? styles.radioFilled : styles.radioEmpty} />
            <Text style={styles.paymentMethodNameText}>UPI</Text>
          </Pressable>

          {paymentMethod === 'upi' && (
            <View style={styles.upiPaymentContainer}>
              
              {/* Clean White Payment Card */}
              <View style={styles.cleanWhitePaymentCard}>
                <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 6 }]}>
                  <Text style={styles.whiteCardAmountLabel}>Amount to Pay</Text>
                  <Text style={styles.whiteCardAmountValue}>₹{checkoutCharges.grandTotal}</Text>
                </View>
                
                <View style={styles.whiteCardDivider} />
                
                <Text style={styles.whiteCardSecuredText}>Pay securely using any UPI app.</Text>

                {paymentSubmitted ? (
                  <View style={styles.statusInfoBox}>
                    <Text style={styles.statusTitle}>Payment Submitted</Text>
                    <Text style={styles.statusDescription}>
                      We're confirming your payment.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.upiAppsGrid}>
                    <Pressable onPress={handleGooglePay} style={styles.upiGridItemButton}>
                      <View style={[styles.appIconCircle, { backgroundColor: '#EAEFFF' }]}>
                        <Text style={[styles.appIconInitial, { color: '#2563EB' }]}>G</Text>
                      </View>
                      <Text style={styles.upiGridItemText}>Google Pay</Text>
                    </Pressable>

                    <Pressable onPress={handlePhonePe} style={styles.upiGridItemButton}>
                      <View style={[styles.appIconCircle, { backgroundColor: '#F5EFFF' }]}>
                        <Text style={[styles.appIconInitial, { color: '#7C3AED' }]}>P</Text>
                      </View>
                      <Text style={styles.upiGridItemText}>PhonePe</Text>
                    </Pressable>

                    <Pressable onPress={handlePaytm} style={styles.upiGridItemButton}>
                      <View style={[styles.appIconCircle, { backgroundColor: '#E6F7FF' }]}>
                        <Text style={[styles.appIconInitial, { color: '#00BAF2' }]}>P</Text>
                      </View>
                      <Text style={styles.upiGridItemText}>Paytm</Text>
                    </Pressable>

                    <Pressable onPress={handleOtherUpi} style={styles.upiGridItemButton}>
                      <View style={[styles.appIconCircle, { backgroundColor: '#F1F5F9' }]}>
                        <Text style={[styles.appIconInitial, { color: '#475569' }]}>★</Text>
                      </View>
                      <Text style={styles.upiGridItemText}>Other UPI Apps</Text>
                    </Pressable>
                  </View>
                )}

                <Pressable onPress={handleCopyUpiId} style={styles.copyUpiTextButton}>
                  <Text style={styles.copyUpiTextButtonText}>Copy UPI ID</Text>
                </Pressable>
              </View>

              {/* QR Layout */}
              <View style={styles.qrContainer}>
                {upiSettings?.qr_code_url ? (
                  <Image 
                    source={{ uri: upiSettings.qr_code_url }} 
                    style={styles.qrCodeImage} 
                    resizeMode="contain" 
                  />
                ) : (
                  <View style={styles.qrUnavailablePlaceholder}>
                    <Text style={styles.qrUnavailableLabel}>QR temporarily unavailable</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          <View style={[styles.row, styles.paymentOptionDisabled, { marginTop: 12, marginBottom: 12 }]}>
            <View style={styles.row}>
              <View style={styles.radioEmpty} />
              <Text style={styles.paymentMethodDisabledText}>Cards</Text>
            </View>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Coming Soon</Text>
            </View>
          </View>

          <View style={[styles.row, styles.paymentOptionDisabled, { marginBottom: 12 }]}>
            <View style={styles.row}>
              <View style={styles.radioEmpty} />
              <Text style={styles.paymentMethodDisabledText}>Wallets</Text>
            </View>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Coming Soon</Text>
            </View>
          </View>

          <View style={[styles.row, styles.paymentOptionDisabled]}>
            <View style={styles.row}>
              <View style={styles.radioEmpty} />
              <Text style={styles.paymentMethodDisabledText}>EMI</Text>
            </View>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Coming Soon</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Modernized Blinkit/Zepto Style Sticky Footer Panel */}
      <View style={styles.stickyFooterPanel}>
        <View style={styles.stickyFooterLeft}>
          <Text style={styles.orderTotalTitleLabel}>Order Total</Text>
          <Text style={styles.stickyTotalAmountText}>₹{checkoutCharges.grandTotal}</Text>
        </View>
        <Pressable
          onPress={placeOrder}
          disabled={!address || isPlacingOrder || !customerId}
          style={({ pressed }) => {
            const styleArray = [styles.stickyOrderPlacementButton];
            if (!address || isPlacingOrder || !customerId) styleArray.push(styles.disabledButton);
            if (pressed && address && !isPlacingOrder && customerId) styleArray.push(styles.microInteractionState);
            return styleArray;
          }}
        >
          {isPlacingOrder ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Text style={styles.stickyButtonText}>
              {paymentMethod === 'cod' ? 'Place Order' : 'Pay Securely'}
            </Text>
          )}
        </Pressable>
      </View>

      <Modal
        visible={successOrderDetails !== null}
        animationType="none"
        transparent={true}
      >
        <View style={styles.modalSystemOverlayBackground}>
          <Animated.View 
            style={[
              styles.successScreenCardContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }]
              }
            ]}
          >
            <Animated.View 
              style={[
                styles.successScreenBadgeCircle,
                {
                  transform: [
                    {
                      scale: checkmarkBounce.interpolate({
                        inputRange: [0, 0.5, 0.8, 1],
                        outputRange: [0.3, 1.2, 0.95, 1]
                      })
                    }
                  ]
                }
              ]}
            >
              <Text style={styles.successBadgeText}>✓</Text>
            </Animated.View>

            <Text style={styles.successTitle}>Thank you for choosing Rivo ❤️</Text>
            <Text style={styles.successSubtitle}>
              See you again in {address?.city || 'your city'} 👋
            </Text>

            <View style={styles.successMetaCard}>
              <View style={[styles.row, styles.metaItemRow]}>
                <Text style={styles.metaCardLabel}>Order Number</Text>
                <Text style={styles.metaCardValue}>{successOrderDetails?.orderNumber}</Text>
              </View>
              <View style={styles.metaItemSeparator} />
              <View style={[styles.row, styles.metaItemRow]}>
                <Text style={styles.metaCardLabel}>Estimated Delivery</Text>
                <Text style={styles.metaCardValue}>{successOrderDetails?.eta}</Text>
              </View>
              <View style={styles.metaItemSeparator} />
              <View style={[styles.row, styles.metaItemRow]}>
                <Text style={styles.metaCardLabel}>Total Paid</Text>
                <Text style={styles.metaCardValueHighlight}>₹{successOrderDetails?.totalAmount}</Text>
              </View>
              <View style={styles.metaItemSeparator} />
              <View style={[styles.row, styles.metaItemRow]}>
                <Text style={styles.metaCardLabel}>Payment Method</Text>
                <Text style={styles.metaCardValue}>
                  {successOrderDetails?.paymentMethod === 'cod' ? 'Cash on Delivery' : 'UPI'}
                </Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [styles.trackOrderButton, pressed && styles.microInteractionState]}
              onPress={() => {
                const oId = successOrderDetails?.orderId;
                setSuccessOrderDetails(null);
                if (oId) {
                  router.replace({ pathname: '/orders/[id]', params: { id: oId } });
                }
              }}
            >
              <Text style={styles.trackOrderButtonText}>Track Order</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.returnShoppingButton, pressed && styles.microInteractionState]}
              onPress={() => {
                setSuccessOrderDetails(null);
                router.replace('/');
              }}
            >
              <Text style={styles.returnShoppingButtonText}>Continue Shopping</Text>
            </Pressable>
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
  backButtonTextSymbol: {
    fontSize: 22,
    color: '#0F172A',
    fontWeight: '600',
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  container: {
    padding: 16,
    paddingBottom: 160,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  etaCard: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  etaIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  etaIcon: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  etaTextContent: {
    flex: 1,
  },
  etaTitle: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '600',
  },
  etaTime: {
    fontSize: 15,
    fontWeight: '700',
    color: '#065F46',
    marginTop: 2,
  },
  distanceTag: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  distanceTagText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
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
  landmarkWrapper: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 6,
    marginBottom: 4,
  },
  addressSubtext: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  addressCityText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '500',
  },
  changeAddressBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  changeAddressBtnText: {
    color: '#475569',
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
    backgroundColor: '#10B981',
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
    color: '#475569',
    marginTop: 6,
    marginBottom: 8,
  },
  actionChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  summaryListBlock: {
    marginTop: 2,
  },
  summaryItemRow: {
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  itemQuantity: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  breakdownRow: {
    justifyContent: 'space-between',
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
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#10B981',
  },
  paymentOptionSelected: {
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    borderColor: '#10B981',
    borderRadius: 14,
    padding: 16,
  },
  paymentOptionUnselected: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 16,
  },
  radioFilled: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 6,
    borderColor: '#10B981',
    marginRight: 12,
    backgroundColor: '#FFFFFF',
  },
  paymentMethodNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  paymentOptionDisabled: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 16,
    justifyContent: 'space-between',
    opacity: 0.5,
  },
  radioEmpty: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    marginRight: 12,
  },
  paymentMethodDisabledText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  comingSoonBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  comingSoonText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '700',
  },
  stickyFooterPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 16,
    paddingBottom: 36,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
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
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  stickyTotalSubText: {
    display: 'none',
  },
  stickyOrderPlacementButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 14,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  stickyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  disabledButton: {
    backgroundColor: '#CBD5E1',
    shadowOpacity: 0,
    elevation: 0,
  },
  microInteractionState: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  modalSystemOverlayBackground: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successScreenCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8,
  },
  successScreenBadgeCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successBadgeText: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '600',
  },
  successMetaCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    width: '100%',
    padding: 16,
    marginTop: 20,
    marginBottom: 20,
  },
  metaItemRow: {
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
  },
  metaCardValueHighlight: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '700',
  },
  metaItemSeparator: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 8,
  },
  trackOrderButton: {
    backgroundColor: '#10B981',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  trackOrderButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  returnShoppingButton: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  returnShoppingButtonText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  upiPaymentContainer: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  cleanWhitePaymentCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  whiteCardAmountLabel: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
  },
  whiteCardAmountValue: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  whiteCardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  whiteCardSecuredText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
    marginBottom: 14,
  },
  statusInfoBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#DCFCE7',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#15803D',
    marginBottom: 2,
  },
  statusDescription: {
    fontSize: 12,
    color: '#166534',
    textAlign: 'center',
    fontWeight: '500',
  },
  upiAppsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  upiGridItemButton: {
    width: '48%',
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  appIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  appIconInitial: {
    fontSize: 12,
    fontWeight: '800',
  },
  upiGridItemText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    flex: 1,
  },
  copyUpiTextButton: {
    alignSelf: 'center',
    marginTop: 6,
    padding: 4,
  },
  copyUpiTextButtonText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  qrCodeImage: {
    width: 150,
    height: 150,
  },
  qrUnavailablePlaceholder: {
    width: '100%',
    height: 60,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qrUnavailableLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
});