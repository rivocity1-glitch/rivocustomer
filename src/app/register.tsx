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

  // Form State
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
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [focusedInput, setFocusedField] = useState<string | null>(null);
  const [termsAgreed, setTermsAgreed] = useState(true);

  // OTP Modal & Timer State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setResendAvailable] = useState(false);

  // Animations Setup
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  // Timer logic for OTP resend
  useEffect(() => {
    if (showOtpModal && resendTimer > 0) {
      setResendAvailable(false);
      timerRef.current = setTimeout(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (resendTimer === 0) {
      setResendAvailable(true);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [showOtpModal, resendTimer]);

  const handleGetCurrentLocation = async () => {
  try {
    setDetectingLocation(true);

    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Location Permission Denied',
        'Permission to access your location was denied. Please enter your address manually.'
      );
      return;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const lat = location.coords.latitude;
    const lng = location.coords.longitude;

    // Always save the actual GPS coordinates.
    setLatitude(lat);
    setLongitude(lng);

    const geocodeResults = await Location.reverseGeocodeAsync({
      latitude: lat,
      longitude: lng,
    });

    if (!geocodeResults || geocodeResults.length === 0) {
      Alert.alert(
        'Location Found 📍',
        'Your GPS location was detected, but the address could not be converted into a readable address. Please enter the address manually.'
      );
      return;
    }

    const item = geocodeResults[0];

    /*
     * IMPORTANT:
     * item.name can sometimes be a Plus Code such as:
     * 5H28+HGW
     *
     * Never use that as Address Line 1.
     */

    const isPlusCode = (value?: string | null) => {
      if (!value) return false;

      const normalized = value.trim();

      // Detect common Plus Code patterns.
      return (
        normalized.includes('+') &&
        /^[23456789CFGHJMPQRVWX]{2,8}\+/.test(
          normalized.toUpperCase()
        )
      );
    };

    // Build a proper street/building address.
    const streetParts = [
      item.streetNumber,
      item.street,
    ].filter(Boolean);

    const streetAddress = streetParts.join(' ').trim();

    /*
     * Only use item.name when it is NOT a Plus Code and
     * when we don't already have a street address.
     */
    let detectedAddressLine1 = streetAddress;

    if (!detectedAddressLine1 && item.name && !isPlusCode(item.name)) {
      detectedAddressLine1 = item.name.trim();
    }

    /*
     * Area/locality information belongs in Address Line 2,
     * not inside Address Line 1.
     */
    const detectedArea = [
      item.district,
      item.subregion,
    ]
      .filter(Boolean)
      .filter(
        (value, index, array) =>
          array.indexOf(value) === index
      )
      .join(', ')
      .trim();

    if (detectedAddressLine1) {
      setAddressLine1(detectedAddressLine1);
    }

    if (detectedArea) {
      setAddressLine2((current) => current.trim() || detectedArea);
    }

    if (item.city) {
      setCity(item.city);
    } else if (item.subregion) {
      setCity(item.subregion);
    }

    if (item.region) {
      setState(item.region);
    }

    if (item.postalCode) {
      setPinCode(item.postalCode);
    }

    Alert.alert(
      'Location Fetched 📍',
      'Your current location has been detected and the address fields have been populated. Please review and correct the address before completing registration.'
    );
  } catch (err) {
    console.error('Location detection error:', err);

    Alert.alert(
      'Location Error',
      'Unable to retrieve your current location. Please enter your delivery address manually.'
    );
  } finally {
    setDetectingLocation(false);
  }
};
  const validateRegistrationForm = async (): Promise<boolean> => {
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
      Alert.alert('Missing Required Fields', 'Please complete all required fields marked with an asterisk (*).');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return false;
    }

    if (cleanPhone.length !== 10) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid 10-digit mobile phone number.');
      return false;
    }

    // Check duplicate email
    const { data: existingEmail } = await supabase
      .from('customers')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existingEmail) {
      Alert.alert('Account Exists', 'An account with this email address already exists. Please login instead.');
      return false;
    }

    // Check duplicate phone
    const { data: existingPhone } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (existingPhone) {
      Alert.alert('Phone Number In Use', 'An account with this mobile phone number is already registered.');
      return false;
    }

    return true;
  };

  const handleStartOtpFlow = async () => {
    setLoading(true);

    try {
      const isValid = await validateRegistrationForm();
      if (!isValid) {
        setLoading(false);
        return;
      }

      const cleanEmail = email.trim().toLowerCase();

      // Trigger Passwordless Email OTP
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) throw error;

      // Reset timer and show OTP modal
      setResendTimer(60);
      setOtpToken('');
      setShowOtpModal(true);
    } catch (error: any) {
      Alert.alert('Registration Error', error?.message || 'Could not send verification OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpAndCreateProfile = async () => {
    const cleanOtp = otpToken.trim();
    if (cleanOtp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter a valid 6-digit verification code.');
      return;
    }

    setVerifyingOtp(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPhone = phone.trim().replace(/[^0-9]/g, '');

      // Verify OTP token with Supabase Auth
      const { data: authData, error: verifyError } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanOtp,
        type: 'email',
      });

      if (verifyError) throw verifyError;

      const user = authData?.user;
      if (!user) throw new Error('Failed to retrieve authenticated user details.');

      // Insert customer record
      const { data: customerData, error: dbError } = await supabase
        .from('customers')
        .insert([
          {
            auth_user_id: user.id,
            customer_name: customerName.trim(),
            email: cleanEmail,
            phone: cleanPhone,
          },
        ])
        .select()
        .single();

      if (dbError) throw dbError;

      // Insert customer address record
      if (customerData) {
        const { error: addressError } = await supabase
          .from('customer_addresses')
          .insert([
            {
              customer_id: customerData.id,
              address_line1: addressLine1.trim(),
              address_line2: addressLine2.trim(),
              city: city.trim(),
              state: state.trim(),
              pin_code: pinCode.trim(),
              landmark: landmark.trim(),
              address_type: addressType,
              is_default: true,
              latitude: latitude,
              longitude: longitude,
            },
          ]);

        if (addressError) throw addressError;
      }

      setShowOtpModal(false);
      router.replace('/');
    } catch (error: any) {
      console.error('OTP Verification Error:', error);
      Alert.alert('Verification Failed', error?.message || 'Invalid code. Please try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    try {
      setLoading(true);
      const cleanEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) throw error;

      setResendTimer(60);
      setResendAvailable(false);
      Alert.alert('OTP Resent ✉️', 'A new 6-digit code has been sent to your email.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to resend OTP code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.animatedWrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            
            {/* Top Branding Section */}
            <View style={styles.brandHeader}>
              <View style={styles.logoBadge}><Text style={styles.logoText}>R</Text></View>
              <Text style={styles.titleText}>Create Account</Text>
              <Text style={styles.subtitleText}>Join thousands of customers shopping nearby.</Text>
            </View>

            {/* Card 1: Personal Information */}
            <View style={styles.formSectionCard}>
              <Text style={styles.cardHeaderHeading}>Personal Information</Text>

              <Text style={styles.fieldLabel}>Customer Name *</Text>
              <View style={[styles.inputContainer, focusedInput === 'name' && styles.inputFocused]}>
                <TextInput
                  style={styles.inputField}
                  placeholder="John Doe"
                  placeholderTextColor="#94A3B8"
                  value={customerName}
                  onChangeText={setCustomerName}
                  autoCapitalize="words"
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

            {/* Card 2: Address Information */}
            <View style={styles.formSectionCard}>
              <Text style={styles.cardHeaderHeading}>Delivery Address</Text>

              {/* Location Action Button */}
              <TouchableOpacity
                style={styles.getCurrentLocationButton}
                onPress={handleGetCurrentLocation}
                disabled={detectingLocation}
                activeOpacity={0.8}
              >
                {detectingLocation ? (
                  <ActivityIndicator size="small" color="#22CC71" />
                ) : (
                  <Text style={styles.getCurrentLocationButtonText}>📍 Get Current Location</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Address Type</Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={[styles.radioChip, addressType === 'home' && styles.radioChipActive]}
                  onPress={() => setAddressType('home')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.radioChipText, addressType === 'home' && styles.radioChipTextActive]}>🏠 Home</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.radioChip, addressType === 'work' && styles.radioChipActive]}
                  onPress={() => setAddressType('work')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.radioChipText, addressType === 'work' && styles.radioChipTextActive]}>🏢 Work</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Address Line 1 *</Text>
              <View style={[styles.inputContainer, focusedInput === 'addr1' && styles.inputFocused]}>
                <TextInput
                  style={styles.inputField}
                  placeholder="Building / Apt / Street layout"
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
                  placeholder="Suite / Unit / Floor"
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
                  placeholder="Near Metro Station, hospital etc."
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
                  onFocus={() => setFocusedField('pin')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              {/* Terms Checkbox Row */}
              <TouchableOpacity 
                activeOpacity={0.8} 
                style={styles.checkboxLineRow} 
                onPress={() => setTermsAgreed(!termsAgreed)}
              >
                <View style={[styles.checkboxIndicatorCircle, termsAgreed && styles.checkboxIndicatorActive]}>
                  {termsAgreed && <Text style={styles.checkboxIndicatorTick}>✓</Text>}
                </View>
                <Text style={styles.checkboxDisclaimerText}>
                  By creating an account you agree to our{' '}
                  <Text style={styles.boldDisclaimerLink}>Terms & Conditions</Text> and{' '}
                  <Text style={styles.boldDisclaimerLink}>Privacy Policy</Text>.
                </Text>
              </TouchableOpacity>

              {/* Submit CTA */}
              <TouchableOpacity
                style={[styles.submitButton, (!termsAgreed || loading) && { backgroundColor: '#CBD5E1' }]}
                onPress={handleStartOtpFlow}
                disabled={loading || !termsAgreed}
                activeOpacity={0.85}
              >
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>Continue ➔</Text>}
              </TouchableOpacity>

              <View style={styles.alternativeLoginLinkRow}>
                <Text style={styles.alternativeLabelText}>Already have an account? </Text>
                <TouchableOpacity activeOpacity={0.7} onPress={() => router.replace('/login')}>
                  <Text style={styles.alternativeActiveText}>Login</Text>
                </TouchableOpacity>
              </View>
            </View>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 6-DIGIT EMAIL OTP VERIFICATION MODAL */}
      <Modal
        visible={showOtpModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOtpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalBadgeIconCircle}>
              <Text style={{ fontSize: 28 }}>🔑</Text>
            </View>
            <Text style={styles.modalTitle}>Enter Verification Code</Text>
            <Text style={styles.modalSubtitle}>
              We sent a 6-digit code to{' '}
              <Text style={{ color: '#0D0D0D', fontWeight: '800' }}>{email}</Text>
            </Text>

            <View style={styles.otpInputBox}>
              <TextInput
                style={styles.otpInputField}
                placeholder="• • • • • •"
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
              activeOpacity={0.85}
            >
              {verifyingOtp ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.verifySubmitBtnText}>Verify & Create Profile</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.resendCodeBtn, !canResend && { opacity: 0.6 }]}
              onPress={handleResendOtp}
              disabled={!canResend || loading}
              activeOpacity={0.7}
            >
              <Text style={styles.resendCodeText}>
                {canResend ? 'Resend Code' : `Resend Code in ${resendTimer}s`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelModalBtn}
              onPress={() => setShowOtpModal(false)}
              disabled={verifyingOtp}
            >
              <Text style={styles.cancelModalText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  scrollContainer: {
    padding: 16,
  },
  animatedWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 16,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#22CC71',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#22CC71',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  },
  logoText: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  titleText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0D0D0D',
    letterSpacing: -0.5,
  },
  subtitleText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  formSectionCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EAEFF3',
    marginBottom: 14,
    shadowColor: '#0D0D0D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeaderHeading: {
    fontSize: 14,
    fontWeight: '900',
    color: '#22CC71',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 14,
  },
  getCurrentLocationButton: {
    backgroundColor: '#E8FBF0',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22CC7140',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  getCurrentLocationButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#22CC71',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0D0D0D',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  inputContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAEFF3',
    borderRadius: 14,
    backgroundColor: '#F7F8FA',
    marginBottom: 14,
  },
  inputFocused: {
    borderColor: '#22CC71',
    backgroundColor: '#FFFFFF',
  },
  inputField: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontWeight: '600',
    color: '#0D0D0D',
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  radioChip: {
    flex: 1,
    backgroundColor: '#F7F8FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAEFF3',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioChipActive: {
    borderColor: '#22CC71',
    backgroundColor: '#22CC7110',
  },
  radioChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  radioChipTextActive: {
    color: '#22CC71',
    fontWeight: '800',
  },
  formInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  checkboxLineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
    marginBottom: 16,
    paddingHorizontal: 2,
    gap: 10,
  },
  checkboxIndicatorCircle: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxIndicatorActive: {
    borderColor: '#22CC71',
    backgroundColor: '#22CC71',
  },
  checkboxIndicatorTick: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  checkboxDisclaimerText: {
    flex: 1,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    fontWeight: '500',
  },
  boldDisclaimerLink: {
    fontWeight: '700',
    color: '#475569',
  },
  submitButton: {
    backgroundColor: '#22CC71',
    width: '100%',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: '#22CC71',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  alternativeLoginLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 2,
  },
  alternativeLabelText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  alternativeActiveText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#22CC71',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(13, 13, 13, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  modalBadgeIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E8FBF0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0D0D0D',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  otpInputBox: {
    width: '100%',
    backgroundColor: '#F7F8FA',
    borderWidth: 1.5,
    borderColor: '#22CC71',
    borderRadius: 16,
    paddingVertical: 10,
    marginBottom: 16,
  },
  otpInputField: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0D0D0D',
    textAlign: 'center',
    letterSpacing: 8,
  },
  verifySubmitBtn: {
    width: '100%',
    backgroundColor: '#22CC71',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  verifySubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  resendCodeBtn: {
    paddingVertical: 6,
    marginBottom: 8,
  },
  resendCodeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#22CC71',
  },
  cancelModalBtn: {
    paddingVertical: 6,
  },
  cancelModalText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
});