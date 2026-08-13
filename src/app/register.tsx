import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function RegisterScreen() {
  const router = useRouter();

  // ---------------------------------------------------------
  // FORM STATE (No passwords required)
  // ---------------------------------------------------------
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [addressType, setAddressType] = useState('home');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pinCode, setPinCode] = useState('');

  // Hidden coordinates stored strictly for backend calculations
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [focusedInput, setFocusedField] = useState<string | null>(null);
  const [termsAgreed, setTermsAgreed] = useState(true);

  // ---------------------------------------------------------
  // OTP STATE
  // ---------------------------------------------------------
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setResendAvailable] = useState(false);

  // ---------------------------------------------------------
  // ANIMATIONS
  // ---------------------------------------------------------
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (showOtpModal && resendTimer > 0) {
      setResendAvailable(false);
      timerRef.current = setTimeout(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (showOtpModal && resendTimer === 0) {
      setResendAvailable(true);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [showOtpModal, resendTimer]);

  // ---------------------------------------------------------
  // HELPER: FILTER OUT PLUS CODES & LAT/LNG STRINGS
  // ---------------------------------------------------------
  const isPlusCodeOrCoordinate = (val?: string | null) => {
    if (!val) return true;
    const clean = val.trim();
    // Filter out Plus Codes (e.g. 7JVW+7W) or numeric coordinate strings
    if (clean.includes('+') && /^[23456789CFGHJMPQRVWX]{2,8}\+/.test(clean.toUpperCase())) return true;
    if (/^-?\d+(\.\d+)?$/.test(clean)) return true;
    return false;
  };

  // ---------------------------------------------------------
  // LOCATION DETECT (READABLE ADDRESS PARSING)
  // ---------------------------------------------------------
  const handleGetCurrentLocation = async () => {
  try {
    setDetectingLocation(true);

    const { status } =
      await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permission Denied',
        'Please allow location access or enter your address manually.'
      );
      return;
    }

    const location =
      await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

    const lat = location.coords.latitude;
    const lng = location.coords.longitude;

    // Keep GPS coordinates hidden.
    // They are stored only for delivery-distance calculations.
    setLatitude(lat);
    setLongitude(lng);

    const results =
      await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });

    if (!results || results.length === 0) {
      Alert.alert(
        'Location Found',
        'Your location was detected, but we could not generate a readable address. Please enter the address manually.'
      );
      return;
    }

    const item = results[0];

    // ---------------------------------------------------------
    // HELPERS
    // ---------------------------------------------------------

    const clean = (value?: string | null) =>
      value?.trim() || '';

    const isInvalidAddressValue = (
      value?: string | null
    ) => {
      const text = clean(value);

      if (!text) return true;

      const upper = text.toUpperCase();

      // Plus Code
      if (
        /^[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]+/.test(
          upper
        )
      ) {
        return true;
      }

      // Latitude / longitude
      if (
        /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(
          text
        )
      ) {
        return true;
      }

      // Pure numeric value
      if (/^-?\d+(\.\d+)?$/.test(text)) {
        return true;
      }

      return false;
    };

    const uniqueValues = (
      values: Array<string | null | undefined>
    ) => {
      const output: string[] = [];

      for (const value of values) {
        const text = clean(value);

        if (
          !text ||
          isInvalidAddressValue(text)
        ) {
          continue;
        }

        const exists = output.some(
          (existing) =>
            existing.toLowerCase() ===
            text.toLowerCase()
        );

        if (!exists) {
          output.push(text);
        }
      }

      return output;
    };

    // ---------------------------------------------------------
    // CITY / STATE / PIN
    // ---------------------------------------------------------

    const detectedCity =
      clean(item.city) ||
      clean(item.subregion) ||
      clean(item.district);

    const detectedState =
      clean(item.region);

    const detectedPin =
      clean(item.postalCode);

    // ---------------------------------------------------------
    // ADDRESS LINE 1
    //
    // Prefer:
    // House/Street Number + Street
    //
    // Then:
    // Building/place name
    // ---------------------------------------------------------

    const streetParts = uniqueValues([
      item.streetNumber,
      item.street,
    ]);

    let detectedAddressLine1 =
      streetParts.join(' ');

    if (!detectedAddressLine1) {
      const safeName =
        !isInvalidAddressValue(item.name)
          ? clean(item.name)
          : '';

      if (safeName) {
        detectedAddressLine1 = safeName;
      }
    }

    // ---------------------------------------------------------
    // ADDRESS LINE 2
    //
    // Area / locality / district.
    // Never put coordinates here.
    // ---------------------------------------------------------

    const detectedAddressLine2 =
      uniqueValues([
        item.district,
        item.subregion,
      ])
        .filter(
          (value) =>
            value.toLowerCase() !==
            detectedAddressLine1.toLowerCase()
        )
        .join(', ');

    // ---------------------------------------------------------
    // UPDATE FORM
    // ---------------------------------------------------------

    setAddressLine1(
      detectedAddressLine1 || ''
    );

    setAddressLine2(
      detectedAddressLine2
    );

    setCity(detectedCity);
    setState(detectedState);
    setPinCode(detectedPin);

    Alert.alert(
      'Location Added 📍',
      'Your readable delivery address has been added. Please review the details before continuing.'
    );
  } catch (error) {
    console.error(
      'Location detection error:',
      error
    );

    Alert.alert(
      'Location Error',
      'Unable to retrieve your current location. Please enter your address manually.'
    );
  } finally {
    setDetectingLocation(false);
  }
};

  // ---------------------------------------------------------
  // START REGISTRATION FLOW (SEND OTP)
  // ---------------------------------------------------------
  const handleStartOtpFlow = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim().replace(/[^0-9]/g, '');

    if (
      !customerName.trim() ||
      !cleanEmail ||
      !cleanPhone ||
      !addressLine1.trim() ||
      !city.trim() ||
      !state.trim() ||
      !pinCode.trim()
    ) {
      Alert.alert('Missing Fields', 'Please complete all required fields marked with (*).');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    if (loading) return;
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) throw error;

      setResendTimer(60);
      setResendAvailable(false);
      setOtpToken('');
      setShowOtpModal(true);
    } catch (error: any) {
      Alert.alert('Registration Error', error?.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // VERIFY OTP + CREATE PROFILE
  // ---------------------------------------------------------
  const handleVerifyOtpAndCreateProfile = async () => {
    const cleanOtp = otpToken.trim();
    if (cleanOtp.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a valid 6-digit verification code.');
      return;
    }

    if (verifyingOtp) return;
    setVerifyingOtp(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPhone = phone.trim().replace(/[^0-9]/g, '');

      // 1. Verify OTP
      const { data: authData, error: verifyError } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanOtp,
        type: 'email',
      });

      if (verifyError) throw verifyError;
      const user = authData?.user;
      if (!user) throw new Error('Account verification failed.');

      // 2. Insert Customer Profile
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .insert({
          auth_user_id: user.id,
          customer_name: customerName.trim(),
          email: cleanEmail,
          phone: cleanPhone,
        })
        .select()
        .single();

      if (customerError) {
        if (customerError.code === '23505') {
          throw new Error('An account with this email or mobile number already exists.');
        }
        throw customerError;
      }

      // 3. Insert Delivery Address (Latitude & Longitude saved silently)
      await supabase.from('customer_addresses').insert({
        customer_id: customerData.id,
        address_line1: addressLine1.trim(),
        address_line2: addressLine2.trim() || null,
        city: city.trim(),
        state: state.trim(),
        pin_code: pinCode.trim(),
        landmark: landmark.trim() || null,
        address_type: addressType,
        is_default: true,
        latitude,
        longitude,
      });

      setShowOtpModal(false);
      Alert.alert('Account Created', 'Your account has been created successfully.', [
        { text: 'Continue', onPress: () => router.replace('/') },
      ]);
    } catch (error: any) {
      Alert.alert('Registration Failed', error?.message || 'Verification failed.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[styles.animatedWrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            {/* BRANDING */}
            <View style={styles.brandHeader}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoText}>R</Text>
              </View>
              <Text style={styles.titleText}>Create Account</Text>
              <Text style={styles.subtitleText}>Join Rivo and shop from local stores.</Text>
            </View>

            {/* PERSONAL INFORMATION */}
            <View style={styles.formSectionCard}>
              <Text style={styles.cardHeaderHeading}>Personal Details</Text>

              <Text style={styles.fieldLabel}>Customer Name *</Text>
              <View style={[styles.inputContainer, focusedInput === 'name' && styles.inputFocused]}>
                <TextInput
                  style={styles.inputField}
                  placeholder="John Doe"
                  placeholderTextColor="#94A3B8"
                  value={customerName}
                  onChangeText={setCustomerName}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <Text style={styles.fieldLabel}>Email *</Text>
              <View style={[styles.inputContainer, focusedInput === 'email' && styles.inputFocused]}>
                <TextInput
                  style={styles.inputField}
                  placeholder="john@example.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <Text style={styles.fieldLabel}>Phone *</Text>
              <View style={[styles.inputContainer, focusedInput === 'phone' && styles.inputFocused]}>
                <TextInput
                  style={styles.inputField}
                  placeholder="10-digit mobile number"
                  placeholderTextColor="#94A3B8"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            {/* DELIVERY ADDRESS */}
            <View style={styles.formSectionCard}>
              <Text style={styles.cardHeaderHeading}>Delivery Address</Text>

              <TouchableOpacity
                style={styles.getCurrentLocationButton}
                onPress={handleGetCurrentLocation}
                disabled={detectingLocation}
              >
                {detectingLocation ? (
                  <ActivityIndicator size="small" color="#22CC71" />
                ) : (
                  <Text style={styles.getCurrentLocationButtonText}>Get Current Location</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Address Line 1 *</Text>
              <View style={[styles.inputContainer, focusedInput === 'addr1' && styles.inputFocused]}>
                <TextInput
                  style={styles.inputField}
                  placeholder="Flat / Building / Street"
                  placeholderTextColor="#94A3B8"
                  value={addressLine1}
                  onChangeText={setAddressLine1}
                  onFocus={() => setFocusedField('addr1')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <Text style={styles.fieldLabel}>Address Line 2</Text>
              <View style={[styles.inputContainer, focusedInput === 'addr2' && styles.inputFocused]}>
                <TextInput
                  style={styles.inputField}
                  placeholder="Area / Locality"
                  placeholderTextColor="#94A3B8"
                  value={addressLine2}
                  onChangeText={setAddressLine2}
                  onFocus={() => setFocusedField('addr2')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <Text style={styles.fieldLabel}>Landmark</Text>
              <View style={[styles.inputContainer, focusedInput === 'landmark' && styles.inputFocused]}>
                <TextInput
                  style={styles.inputField}
                  placeholder="Nearby Landmark (Optional)"
                  placeholderTextColor="#94A3B8"
                  value={landmark}
                  onChangeText={setLandmark}
                  onFocus={() => setFocusedField('landmark')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <View style={styles.formInputsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>City *</Text>
                  <View style={[styles.inputContainer, focusedInput === 'city' && styles.inputFocused]}>
                    <TextInput
                      style={styles.inputField}
                      placeholder="City"
                      placeholderTextColor="#94A3B8"
                      value={city}
                      onChangeText={setCity}
                      onFocus={() => setFocusedField('city')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>State *</Text>
                  <View style={[styles.inputContainer, focusedInput === 'state' && styles.inputFocused]}>
                    <TextInput
                      style={styles.inputField}
                      placeholder="State"
                      placeholderTextColor="#94A3B8"
                      value={state}
                      onChangeText={setState}
                      onFocus={() => setFocusedField('state')}
                      onBlur={() => setFocusedField(null)}
                    />
                  </View>
                </View>
              </View>

              <Text style={styles.fieldLabel}>Pin Code *</Text>
              <View style={[styles.inputContainer, focusedInput === 'pin' && styles.inputFocused]}>
                <TextInput
                  style={styles.inputField}
                  placeholder="Pin Code"
                  placeholderTextColor="#94A3B8"
                  value={pinCode}
                  onChangeText={setPinCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  onFocus={() => setFocusedField('pin')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, (!termsAgreed || loading) && { backgroundColor: '#CBD5E1' }]}
                onPress={handleStartOtpFlow}
                disabled={loading || !termsAgreed}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Send OTP & Continue</Text>
                )}
              </TouchableOpacity>

              <View style={styles.alternativeLoginLinkRow}>
                <Text style={styles.alternativeLabelText}>Already registered? </Text>
                <TouchableOpacity onPress={() => router.replace('/login')}>
                  <Text style={styles.alternativeActiveText}>Login</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* OTP MODAL */}
      <Modal visible={showOtpModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Verify Email</Text>
            <Text style={styles.modalSubtitle}>Enter 6-digit code sent to {email}</Text>

            <View style={styles.otpInputBox}>
              <TextInput
                style={styles.otpInputField}
                placeholder="000000"
                placeholderTextColor="#CBD5E1"
                value={otpToken}
                onChangeText={setOtpToken}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={styles.verifySubmitBtn}
              onPress={handleVerifyOtpAndCreateProfile}
              disabled={verifyingOtp}
            >
              {verifyingOtp ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.verifySubmitBtnText}>Verify & Complete Registration</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelModalBtn} onPress={() => setShowOtpModal(false)}>
              <Text style={styles.cancelModalText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  scrollContainer: { padding: 16 },
  animatedWrapper: { width: '100%', alignItems: 'center' },
  brandHeader: { alignItems: 'center', marginBottom: 16, marginTop: 16 },
  logoBadge: { width: 60, height: 60, borderRadius: 20, backgroundColor: '#22CC71', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  logoText: { fontSize: 26, fontWeight: '900', color: '#FFFFFF' },
  titleText: { fontSize: 24, fontWeight: '900', color: '#0D0D0D' },
  subtitleText: { fontSize: 13, color: '#64748B', fontWeight: '600', marginTop: 4 },
  formSectionCard: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#EAEFF3', marginBottom: 14 },
  cardHeaderHeading: { fontSize: 14, fontWeight: '900', color: '#22CC71', textTransform: 'uppercase', marginBottom: 14 },
  getCurrentLocationButton: { backgroundColor: '#E8FBF0', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#22CC7140', alignItems: 'center', marginBottom: 16 },
  getCurrentLocationButtonText: { fontSize: 13, fontWeight: '800', color: '#22CC71' },
  fieldLabel: { fontSize: 11, fontWeight: '900', color: '#0D0D0D', textTransform: 'uppercase', marginBottom: 6 },
  inputContainer: { width: '100%', flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#EAEFF3', borderRadius: 14, backgroundColor: '#F7F8FA', marginBottom: 14 },
  inputFocused: { borderColor: '#22CC71', backgroundColor: '#FFFFFF' },
  inputField: { flex: 1, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontWeight: '600', color: '#0D0D0D' },
  formInputsRow: { flexDirection: 'row', gap: 10 },
  submitButton: { backgroundColor: '#22CC71', width: '100%', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 6 },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  alternativeLoginLinkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  alternativeLabelText: { fontSize: 14, color: '#64748B' },
  alternativeActiveText: { fontSize: 14, fontWeight: '800', color: '#22CC71' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(13, 13, 13, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 340, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#0D0D0D', marginBottom: 8 },
  modalSubtitle: { fontSize: 13, color: '#64748B', textAlign: 'center', marginBottom: 16 },
  otpInputBox: { width: '100%', backgroundColor: '#F7F8FA', borderWidth: 1.5, borderColor: '#22CC71', borderRadius: 16, paddingVertical: 10, marginBottom: 16 },
  otpInputField: { fontSize: 24, fontWeight: '900', color: '#0D0D0D', textAlign: 'center', letterSpacing: 8 },
  verifySubmitBtn: { width: '100%', backgroundColor: '#22CC71', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginBottom: 12 },
  verifySubmitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  cancelModalBtn: { paddingVertical: 6 },
  cancelModalText: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
});