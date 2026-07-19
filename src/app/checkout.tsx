// src/app/checkout.tsx
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Clipboard,
  Linking,
  Modal,
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
    paymentMethod: 'cod' | 'online';
    otp: string;
  } | null>(null);

  const [vendorPlanName, setVendorPlanName] = useState<string>('free');

  // Dynamic remote settings states
  const [platformFee, setPlatformFee] = useState<number>(0);
  const [deliveryConfig, setDeliveryConfig] = useState<DeliveryConfig | null>(null);

  // Modern payment specific states
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online'>('cod');
  const [selectedOnlineApp, setSelectedOnlineApp] = useState<'gpay' | 'phonepe' | null>(null);
  
  // Specific states gathered directly from active contextual vendor relational parameters
  const [vendorUpiId, setVendorUpiId] = useState<string>('');
  const [vendorShopName, setVendorShopName] = useState<string>('');
  
  // Track deep link handoff state
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);

  // Pre-generate order number so it can be safely referenced in the transaction note (tn) prior to submission
  const preGeneratedOrderNumber = useMemo(() => {
    return 'ORD-' + Math.floor(100000 + Math.random() * 900000);
  }, []);

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
          .select('latitude, longitude, upi_id, vendors(shop_name)')
          .eq('vendor_id', vendorId)
          .maybeSingle();

        if (!vendorError && vendorProfile) {
          if (vendorProfile.latitude && vendorProfile.longitude) {
            setVendorLocation({
              latitude: Number(vendorProfile.latitude),
              longitude: Number(vendorProfile.longitude),
            });
          }
          if (vendorProfile.upi_id) {
            setVendorUpiId(vendorProfile.upi_id);
          }
          const nestedVendorObj: any = vendorProfile.vendors;
          if (nestedVendorObj && nestedVendorObj.shop_name) {
            setVendorShopName(nestedVendorObj.shop_name);
          }
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

  async function handleUpiPayment(app: "gpay" | "phonepe") {
    const targetUpiId = vendorUpiId || 'merchant@upi';
    const targetShopName = vendorShopName || 'Merchant Partner';
    const amountValue = checkoutCharges.grandTotal.toString();

    const upiUri = `upi://pay?pa=${encodeURIComponent(targetUpiId)}&pn=${encodeURIComponent(targetShopName)}&am=${encodeURIComponent(amountValue)}&cu=${encodeURIComponent('INR')}&tn=${encodeURIComponent(preGeneratedOrderNumber)}`;
    
    console.log("UPI URI:", upiUri);

    try {
      await Linking.openURL(upiUri);
      setSelectedOnlineApp(app);
      setPaymentSubmitted(true);
    } catch (error) {
      console.error(error);
      Alert.alert("Payment Error", "No compatible UPI application was found.");
    }
  }

  // Action function to copy the OTP value to device clipboard node structures securely
  function handleCopyOtp() {
    const currentOtp = successOrderDetails?.otp;
    if (currentOtp) {
      Clipboard.setString(currentOtp);
      Alert.alert("Success", "OTP copied successfully.");
    }
  }

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

      const vendorId = cart[0].vendor_id;
      
      // Generate a random 6-digit numeric OTP and save to orders.delivery_code
      const randomOtp = Math.floor(100000 + Math.random() * 900000).toString();

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: preGeneratedOrderNumber,
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
          delivery_code: randomOtp,
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
        payment_method: paymentMethod === 'cod' ? 'COD' : 'ONLINE',
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
        orderNumber: preGeneratedOrderNumber,
        totalAmount: checkoutCharges.grandTotal,
        eta: '5-15 mins',
        paymentMethod: paymentMethod,
        otp: randomOtp,
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

        {/* Payment Methods */}
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
            onPress={() => setPaymentMethod('online')}
            style={({ pressed }) => [
              styles.row, 
              paymentMethod === 'online' ? styles.paymentOptionSelected : styles.paymentOptionUnselected,
              pressed && styles.microInteractionState
            ]}
          >
            <View style={paymentMethod === 'online' ? styles.radioFilled : styles.radioEmpty} />
            <Text style={styles.paymentMethodNameText}>Online Payment</Text>
          </Pressable>

          {paymentMethod === 'online' && (
            <View style={styles.modernAppsContainer}>
              {/* Google Pay Card */}
              <Pressable
                onPress={() => handleUpiPayment("gpay")}
                style={({ pressed }) => [
                  styles.modernAppCard,
                  selectedOnlineApp === 'gpay' && styles.modernAppCardSelected,
                  pressed && styles.microInteractionState
                ]}
              >
                <View style={[styles.appIconCircle, { backgroundColor: '#EAEFFF' }]}>
                  <Text style={[styles.appIconInitial, { color: '#2563EB' }]}>G</Text>
                </View>
                <View style={styles.appTextDetails}>
                  <Text style={styles.appNameTitle}>Google Pay</Text>
                  <Text style={styles.appSubtitleText}>Pay securely using Google Pay</Text>
                </View>
              </Pressable>

              {/* PhonePe Card */}
              <Pressable
                onPress={() => handleUpiPayment("phonepe")}
                style={({ pressed }) => [
                  styles.modernAppCard,
                  selectedOnlineApp === 'phonepe' && styles.modernAppCardSelected,
                  pressed && styles.microInteractionState
                ]}
              >
                <View style={[styles.appIconCircle, { backgroundColor: '#F5EFFF' }]}>
                  <Text style={[styles.appIconInitial, { color: '#7C3AED' }]}>P</Text>
                </View>
                <View style={styles.appTextDetails}>
                  <Text style={styles.appNameTitle}>PhonePe</Text>
                  <Text style={styles.appSubtitleText}>Pay securely using PhonePe</Text>
                </View>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Footer Panel */}
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
            <ScrollView style={{ width: '100%' }} contentContainerStyle={{ alignItems: 'center' }} showsVerticalScrollIndicator={false}>
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
                    {successOrderDetails?.paymentMethod === 'cod' ? 'Cash on Delivery' : 'Online Payment'}
                  </Text>
                </View>
              </View>

              {/* Target Requirement 1 & 6: Modern dynamic Delivery OTP details card container */}
              <View style={styles.otpCardWrapper}>
                <Text style={styles.otpSectionTitle}>Delivery OTP</Text>
                <Text style={styles.otpSectionSubtitle}>
                  Share this OTP with the rider ONLY after receiving your complete order.
                </Text>

                {/* Target Requirement 2 & 8: Large light-green pill code visualizer with validation state safe-guard */}
                <View style={styles.otpValuePillBox}>
                  <Text style={styles.otpLargeDigitsText}>
                    {successOrderDetails?.otp ? successOrderDetails.otp : "Generating OTP..."}
                  </Text>
                </View>

                {/* Target Requirement 3: Expo Clipboard Copy action component */}
                <Pressable 
                  onPress={handleCopyOtp} 
                  style={({ pressed }) => [styles.copyOtpInlineTextBtn, pressed && styles.microInteractionState]}
                >
                  <Text style={styles.copyOtpInlineTextBtnLabel}>[ Copy OTP ]</Text>
                </Pressable>

                {/* Target Requirement 4: Essential contextual safety warning node block */}
                <View style={styles.otpSafetyNoticeDivider} />
                <Text style={styles.otpSafetyNoticeHeading}>Security</Text>
                <Text style={styles.otpSafetyNoticeDescription}>
                  Never share this OTP before you receive your complete order.
                </Text>
              </View>

              {/* Target Requirement 5: Existing interactive functional process nodes maintained without alteration */}
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
  radioEmpty: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    marginRight: 12,
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
    marginTop: 10,
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
    marginBottom: 16,
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
    marginTop: 10,
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
    marginBottom: 15,
  },
  returnShoppingButtonText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  appIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  appIconInitial: {
    fontSize: 18,
    fontWeight: '800',
  },
  modernAppsContainer: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modernAppCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  modernAppCardSelected: {
    borderColor: '#10B981',
    borderWidth: 2,
    backgroundColor: '#F0FDF4',
  },
  appTextDetails: {
    flex: 1,
  },
  appNameTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  appSubtitleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  otpCardWrapper: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    width: '100%',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 2,
  },
  otpSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 4,
  },
  otpSectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 14,
  },
  otpValuePillBox: {
    backgroundColor: '#E6F4EA',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'center',
    minWidth: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  otpLargeDigitsText: {
    fontSize: 38,
    fontWeight: '900',
    color: '#137333',
    letterSpacing: 4,
    textAlign: 'center',
  },
  copyOtpInlineTextBtn: {
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  copyOtpInlineTextBtnLabel: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  otpSafetyNoticeDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  otpSafetyNoticeHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 2,
  },
  otpSafetyNoticeDescription: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    lineHeight: 15,
  },
});