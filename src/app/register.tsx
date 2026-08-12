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

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // OTP resend timer
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
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [showOtpModal, resendTimer]);

  // ---------------------------------------------------------
  // LOCATION
  // ---------------------------------------------------------

  const isPlusCode = (value?: string | null) => {
    if (!value) return false;

    const normalized = value.trim().toUpperCase();

    return (
      normalized.includes('+') &&
      /^[23456789CFGHJMPQRVWX]{2,8}\+/.test(normalized)
    );
  };

  const uniqueNonEmpty = (values: Array<string | null | undefined>) => {
    return values
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value))
      .filter(
        (value, index, array) =>
          array.findIndex(
            (item) => item.toLowerCase() === value.toLowerCase()
          ) === index
      );
  };

  const handleGetCurrentLocation = async () => {
    try {
      setDetectingLocation(true);

      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Location Permission',
          'Location permission was denied. Please enter your address manually.'
        );
        return;
      }

      const location =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

      const lat = location.coords.latitude;
      const lng = location.coords.longitude;

      // Keep exact coordinates for distance and delivery-fee calculations.
      setLatitude(lat);
      setLongitude(lng);

      const geocodeResults =
        await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });

      if (!geocodeResults || geocodeResults.length === 0) {
        Alert.alert(
          'Location Found',
          'Your location was detected, but a readable address could not be found. Please enter your address manually.'
        );
        return;
      }

      const item = geocodeResults[0];

      /*
       * Build a human-readable address.
       *
       * Never use a Plus Code such as:
       * 5H28+HGW
       */

      const streetAddress = uniqueNonEmpty([
        item.streetNumber,
        item.street,
      ]).join(' ');

      const placeName =
        item.name && !isPlusCode(item.name)
          ? item.name.trim()
          : '';

      const districtArea = uniqueNonEmpty([
        item.district,
        item.subregion,
      ]).join(', ');

      const cityName =
        item.city?.trim() ||
        item.subregion?.trim() ||
        item.district?.trim() ||
        '';

      /*
       * Address Line 1:
       *
       * Prefer:
       * street number + street
       *
       * Otherwise:
       * place/building name
       *
       * Otherwise:
       * district/locality
       */
      const detectedAddressLine1 =
        streetAddress ||
        placeName ||
        districtArea ||
        cityName;

      /*
       * Address Line 2:
       *
       * Area / district information.
       */
      const detectedAddressLine2 = uniqueNonEmpty([
        districtArea,
        item.city,
      ]).join(', ');

      if (detectedAddressLine1) {
        setAddressLine1(detectedAddressLine1);
      }

      if (detectedAddressLine2) {
        setAddressLine2(detectedAddressLine2);
      }

      if (cityName) {
        setCity(cityName);
      }

      if (item.region?.trim()) {
        setState(item.region.trim());
      }

      if (item.postalCode?.trim()) {
        setPinCode(item.postalCode.trim());
      }

      Alert.alert(
        'Location Found',
        'Your location has been added to the address fields. Please review the address before continuing.'
      );
    } catch (error) {
      console.error('Location detection error:', error);

      Alert.alert(
        'Location Error',
        'Unable to retrieve your current location. Please enter your delivery address manually.'
      );
    } finally {
      setDetectingLocation(false);
    }
  };

  // ---------------------------------------------------------
  // VALIDATION
  // ---------------------------------------------------------

  const validateRegistrationForm =
    async (): Promise<boolean> => {
      const cleanEmail =
        email.trim().toLowerCase();

      const cleanPhone =
        phone.trim().replace(/[^0-9]/g, '');

      if (
        !customerName.trim() ||
        !cleanEmail ||
        !cleanPhone ||
        !addressLine1.trim() ||
        !city.trim() ||
        !state.trim() ||
        !pinCode.trim()
      ) {
        Alert.alert(
          'Missing Required Fields',
          'Please complete all required fields marked with an asterisk (*).'
        );
        return false;
      }

      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (!emailRegex.test(cleanEmail)) {
        Alert.alert(
          'Invalid Email',
          'Please enter a valid email address.'
        );
        return false;
      }

      if (cleanPhone.length !== 10) {
        Alert.alert(
          'Invalid Phone Number',
          'Please enter a valid 10-digit mobile phone number.'
        );
        return false;
      }

      // Check duplicate email in customers table.
      const {
        data: existingEmail,
        error: emailCheckError,
      } = await supabase
        .from('customers')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (emailCheckError) {
        console.error(
          'Customer email lookup error:',
          emailCheckError
        );

        Alert.alert(
          'Unable to Continue',
          'We could not verify whether this email is already registered. Please try again.'
        );

        return false;
      }

      if (existingEmail) {
        Alert.alert(
          'Account Exists',
          'An account with this email address already exists. Please login instead.'
        );
        return false;
      }

      // Check duplicate phone in customers table.
      const {
        data: existingPhone,
        error: phoneCheckError,
      } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (phoneCheckError) {
        console.error(
          'Customer phone lookup error:',
          phoneCheckError
        );

        Alert.alert(
          'Unable to Continue',
          'We could not verify whether this mobile number is already registered. Please try again.'
        );

        return false;
      }

      if (existingPhone) {
        Alert.alert(
          'Phone Number In Use',
          'An account with this mobile phone number is already registered.'
        );
        return false;
      }

      return true;
    };

  // ---------------------------------------------------------
  // SEND REGISTRATION OTP
  // ---------------------------------------------------------

  const handleStartOtpFlow = async () => {
    if (loading) return;

    setLoading(true);

    try {
      const isValid =
        await validateRegistrationForm();

      if (!isValid) return;

      const cleanEmail =
        email.trim().toLowerCase();

      /*
       * The customer record is NOT created here.
       *
       * It is created only after the OTP is successfully
       * verified.
       */
      const { error } =
        await supabase.auth.signInWithOtp({
          email: cleanEmail,
          options: {
            shouldCreateUser: true,
          },
        });

      if (error) {
        throw error;
      }

      setResendTimer(60);
      setResendAvailable(false);
      setOtpToken('');
      setShowOtpModal(true);

      Alert.alert(
        'Verification Code Sent',
        `A verification code has been sent to ${cleanEmail}.`
      );
    } catch (error: any) {
      console.error(
        'Registration OTP error:',
        error
      );

      Alert.alert(
        'Registration Error',
        error?.message ||
          'Could not send the verification code.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // VERIFY OTP + CREATE CUSTOMER
  // ---------------------------------------------------------

  const handleVerifyOtpAndCreateProfile =
    async () => {
      const cleanOtp =
        otpToken.trim();

      if (cleanOtp.length !== 6) {
        Alert.alert(
          'Invalid Code',
          'Please enter the 6-digit verification code.'
        );
        return;
      }

      if (verifyingOtp) return;

      setVerifyingOtp(true);

      try {
        const cleanEmail =
          email.trim().toLowerCase();

        const cleanPhone =
          phone.trim().replace(/[^0-9]/g, '');

        /*
         * Verify email OTP first.
         */
        const {
          data: authData,
          error: verifyError,
        } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanOtp,
          type: 'email',
        });

        if (verifyError) {
          throw verifyError;
        }

        const user = authData?.user;

        if (!user) {
          throw new Error(
            'Verification succeeded, but the customer account could not be retrieved.'
          );
        }

        /*
         * Final duplicate protection.
         *
         * This is important because the registration state
         * could have changed while the OTP was pending.
         */
        const {
          data: existingCustomer,
          error: existingCustomerError,
        } = await supabase
          .from('customers')
          .select('id')
          .or(
            `email.eq.${cleanEmail},phone.eq.${cleanPhone}`
          )
          .maybeSingle();

        if (existingCustomerError) {
          throw existingCustomerError;
        }

        if (existingCustomer) {
          Alert.alert(
            'Account Already Exists',
            'An account with this email address or mobile number already exists. Please login instead.'
          );

          await supabase.auth.signOut();

          setShowOtpModal(false);
          return;
        }

        /*
         * Create customer profile ONLY after OTP verification.
         */
        const {
          data: customerData,
          error: dbError,
        } = await supabase
          .from('customers')
          .insert([
            {
              auth_user_id: user.id,
              customer_name:
                customerName.trim(),
              email: cleanEmail,
              phone: cleanPhone,
            },
          ])
          .select()
          .single();

        if (dbError) {
          throw dbError;
        }

        if (!customerData) {
          throw new Error(
            'Customer profile could not be created.'
          );
        }

        /*
         * Create the default delivery address.
         *
         * latitude and longitude are deliberately retained
         * for distance and delivery-fee calculations.
         */
        const {
          error: addressError,
        } = await supabase
          .from('customer_addresses')
          .insert([
            {
              customer_id: customerData.id,
              address_line1:
                addressLine1.trim(),
              address_line2:
                addressLine2.trim(),
              city: city.trim(),
              state: state.trim(),
              pin_code: pinCode.trim(),
              landmark: landmark.trim(),
              address_type: addressType,
              is_default: true,
              latitude,
              longitude,
            },
          ]);

        if (addressError) {
          /*
           * The customer row exists at this point.
           * Surface the real database error instead of
           * pretending registration succeeded.
           */
          throw addressError;
        }

        setShowOtpModal(false);

        Alert.alert(
          'Account Created',
          'Your Rivo customer account has been created successfully.',
          [
            {
              text: 'Continue',
              onPress: () => {
                router.replace('/');
              },
            },
          ]
        );
      } catch (error: any) {
        console.error(
          'OTP Verification Error:',
          error
        );

        Alert.alert(
          'Verification Failed',
          error?.message ||
            'The verification code could not be verified. Please try again.'
        );
      } finally {
        setVerifyingOtp(false);
      }
    };

  // ---------------------------------------------------------
  // RESEND OTP
  // ---------------------------------------------------------

  const handleResendOtp = async () => {
    if (!canResend || loading) return;

    try {
      setLoading(true);

      const cleanEmail =
        email.trim().toLowerCase();

      const { error } =
        await supabase.auth.signInWithOtp({
          email: cleanEmail,
          options: {
            shouldCreateUser: true,
          },
        });

      if (error) {
        throw error;
      }

      setResendTimer(60);
      setResendAvailable(false);

      Alert.alert(
        'Verification Code Sent',
        'A new verification code has been sent to your email.'
      );
    } catch (error: any) {
      console.error(
        'Resend OTP error:',
        error
      );

      Alert.alert(
        'Error',
        error?.message ||
          'Failed to resend the verification code.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : 'height'
        }
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={
            styles.scrollContainer
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={[
              styles.animatedWrapper,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: slideAnim,
                  },
                ],
              },
            ]}
          >
            {/* Branding */}
            <View style={styles.brandHeader}>
              <View style={styles.logoBadge}>
                <Text style={styles.logoText}>
                  R
                </Text>
              </View>

              <Text style={styles.titleText}>
                Create Account
              </Text>

              <Text style={styles.subtitleText}>
                Join Rivo and shop from businesses
                nearby.
              </Text>
            </View>

            {/* Personal Information */}
            <View style={styles.formSectionCard}>
              <Text
                style={styles.cardHeaderHeading}
              >
                Personal Information
              </Text>

              <Text style={styles.fieldLabel}>
                Customer Name *
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  focusedInput === 'name' &&
                    styles.inputFocused,
                ]}
              >
                <TextInput
                  style={styles.inputField}
                  placeholder="John Doe"
                  placeholderTextColor="#94A3B8"
                  value={customerName}
                  onChangeText={setCustomerName}
                  autoCapitalize="words"
                  autoCorrect={false}
                  onFocus={() =>
                    setFocusedField('name')
                  }
                  onBlur={() =>
                    setFocusedField(null)
                  }
                />
              </View>

              <Text style={styles.fieldLabel}>
                Email *
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  focusedInput === 'email' &&
                    styles.inputFocused,
                ]}
              >
                <TextInput
                  style={styles.inputField}
                  placeholder="john@example.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() =>
                    setFocusedField('email')
                  }
                  onBlur={() =>
                    setFocusedField(null)
                  }
                />
              </View>

              <Text style={styles.fieldLabel}>
                Phone *
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  focusedInput === 'phone' &&
                    styles.inputFocused,
                ]}
              >
                <TextInput
                  style={styles.inputField}
                  placeholder="10-digit mobile number"
                  placeholderTextColor="#94A3B8"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                  onFocus={() =>
                    setFocusedField('phone')
                  }
                  onBlur={() =>
                    setFocusedField(null)
                  }
                />
              </View>
            </View>

            {/* Delivery Address */}
            <View style={styles.formSectionCard}>
              <Text
                style={styles.cardHeaderHeading}
              >
                Delivery Address
              </Text>

              <TouchableOpacity
                style={
                  styles.getCurrentLocationButton
                }
                onPress={
                  handleGetCurrentLocation
                }
                disabled={detectingLocation}
                activeOpacity={0.8}
              >
                {detectingLocation ? (
                  <ActivityIndicator
                    size="small"
                    color="#22CC71"
                  />
                ) : (
                  <Text
                    style={
                      styles.getCurrentLocationButtonText
                    }
                  >
                    Get Current Location
                  </Text>
                )}
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>
                Address Type
              </Text>

              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={[
                    styles.radioChip,
                    addressType === 'home' &&
                      styles.radioChipActive,
                  ]}
                  onPress={() =>
                    setAddressType('home')
                  }
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.radioChipText,
                      addressType === 'home' &&
                        styles.radioChipTextActive,
                    ]}
                  >
                    Home
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.radioChip,
                    addressType === 'work' &&
                      styles.radioChipActive,
                  ]}
                  onPress={() =>
                    setAddressType('work')
                  }
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.radioChipText,
                      addressType === 'work' &&
                        styles.radioChipTextActive,
                    ]}
                  >
                    Work
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>
                Address Line 1 *
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  focusedInput === 'addr1' &&
                    styles.inputFocused,
                ]}
              >
                <TextInput
                  style={styles.inputField}
                  placeholder="Building / Street"
                  placeholderTextColor="#94A3B8"
                  value={addressLine1}
                  onChangeText={setAddressLine1}
                  autoCapitalize="words"
                  onFocus={() =>
                    setFocusedField('addr1')
                  }
                  onBlur={() =>
                    setFocusedField(null)
                  }
                />
              </View>

              <Text style={styles.fieldLabel}>
                Address Line 2
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  focusedInput === 'addr2' &&
                    styles.inputFocused,
                ]}
              >
                <TextInput
                  style={styles.inputField}
                  placeholder="Area / Locality"
                  placeholderTextColor="#94A3B8"
                  value={addressLine2}
                  onChangeText={setAddressLine2}
                  autoCapitalize="words"
                  onFocus={() =>
                    setFocusedField('addr2')
                  }
                  onBlur={() =>
                    setFocusedField(null)
                  }
                />
              </View>

              <Text style={styles.fieldLabel}>
                Landmark
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  focusedInput === 'landmark' &&
                    styles.inputFocused,
                ]}
              >
                <TextInput
                  style={styles.inputField}
                  placeholder="Nearby landmark"
                  placeholderTextColor="#94A3B8"
                  value={landmark}
                  onChangeText={setLandmark}
                  autoCapitalize="words"
                  onFocus={() =>
                    setFocusedField('landmark')
                  }
                  onBlur={() =>
                    setFocusedField(null)
                  }
                />
              </View>

              <View style={styles.formInputsRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>
                    City *
                  </Text>

                  <View
                    style={[
                      styles.inputContainer,
                      focusedInput === 'city' &&
                        styles.inputFocused,
                    ]}
                  >
                    <TextInput
                      style={styles.inputField}
                      placeholder="City"
                      placeholderTextColor="#94A3B8"
                      value={city}
                      onChangeText={setCity}
                      autoCapitalize="words"
                      onFocus={() =>
                        setFocusedField('city')
                      }
                      onBlur={() =>
                        setFocusedField(null)
                      }
                    />
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>
                    State *
                  </Text>

                  <View
                    style={[
                      styles.inputContainer,
                      focusedInput === 'state' &&
                        styles.inputFocused,
                    ]}
                  >
                    <TextInput
                      style={styles.inputField}
                      placeholder="State"
                      placeholderTextColor="#94A3B8"
                      value={state}
                      onChangeText={setState}
                      autoCapitalize="words"
                      onFocus={() =>
                        setFocusedField('state')
                      }
                      onBlur={() =>
                        setFocusedField(null)
                      }
                    />
                  </View>
                </View>
              </View>

              <Text style={styles.fieldLabel}>
                Pin Code *
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  focusedInput === 'pin' &&
                    styles.inputFocused,
                ]}
              >
                <TextInput
                  style={styles.inputField}
                  placeholder="Pin Code"
                  placeholderTextColor="#94A3B8"
                  value={pinCode}
                  onChangeText={setPinCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  onFocus={() =>
                    setFocusedField('pin')
                  }
                  onBlur={() =>
                    setFocusedField(null)
                  }
                />
              </View>

              {/* Terms */}
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.checkboxLineRow}
                onPress={() =>
                  setTermsAgreed(
                    !termsAgreed
                  )
                }
              >
                <View
                  style={[
                    styles.checkboxIndicatorCircle,
                    termsAgreed &&
                      styles.checkboxIndicatorActive,
                  ]}
                >
                  {termsAgreed && (
                    <Text
                      style={
                        styles.checkboxIndicatorTick
                      }
                    >
                      ✓
                    </Text>
                  )}
                </View>

                <Text
                  style={
                    styles.checkboxDisclaimerText
                  }
                >
                  By creating an account you agree
                  to our{' '}
                  <Text
                    style={
                      styles.boldDisclaimerLink
                    }
                  >
                    Terms & Conditions
                  </Text>{' '}
                  and{' '}
                  <Text
                    style={
                      styles.boldDisclaimerLink
                    }
                  >
                    Privacy Policy
                  </Text>
                  .
                </Text>
              </TouchableOpacity>

              {/* Submit */}
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!termsAgreed || loading) && {
                    backgroundColor:
                      '#CBD5E1',
                  },
                ]}
                onPress={handleStartOtpFlow}
                disabled={
                  loading || !termsAgreed
                }
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text
                    style={
                      styles.submitButtonText
                    }
                  >
                    Continue
                  </Text>
                )}
              </TouchableOpacity>

              <View
                style={
                  styles.alternativeLoginLinkRow
                }
              >
                <Text
                  style={
                    styles.alternativeLabelText
                  }
                >
                  Already have an account?{' '}
                </Text>

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() =>
                    router.replace('/login')
                  }
                >
                  <Text
                    style={
                      styles.alternativeActiveText
                    }
                  >
                    Login
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* OTP VERIFICATION MODAL */}
      <Modal
        visible={showOtpModal}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setShowOtpModal(false)
        }
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Verify your email
            </Text>

            <Text style={styles.modalSubtitle}>
              Enter the 6-digit verification code
              sent to{' '}
              <Text
                style={{
                  color: '#0D0D0D',
                  fontWeight: '800',
                }}
              >
                {email}
              </Text>
              .
            </Text>

            <View style={styles.verificationBanner}>
              <Text
                style={
                  styles.verificationBannerText
                }
              >
                Verification code sent successfully.
              </Text>
            </View>

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
              onPress={
                handleVerifyOtpAndCreateProfile
              }
              disabled={verifyingOtp}
              activeOpacity={0.85}
            >
              {verifyingOtp ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text
                  style={
                    styles.verifySubmitBtnText
                  }
                >
                  Verify & Create Account
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.resendCodeBtn,
                !canResend && {
                  opacity: 0.6,
                },
              ]}
              onPress={handleResendOtp}
              disabled={
                !canResend ||
                loading ||
                verifyingOtp
              }
              activeOpacity={0.7}
            >
              <Text
                style={styles.resendCodeText}
              >
                {canResend
                  ? 'Resend Code'
                  : `Resend Code in ${resendTimer}s`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelModalBtn}
              onPress={() =>
                setShowOtpModal(false)
              }
              disabled={verifyingOtp}
            >
              <Text
                style={styles.cancelModalText}
              >
                Cancel
              </Text>
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
    shadowOffset: {
      width: 0,
      height: 6,
    },
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
    shadowOffset: {
      width: 0,
      height: 4,
    },
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
    shadowOffset: {
      width: 0,
      height: 6,
    },
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
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0D0D0D',
    marginBottom: 8,
  },

  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },

  verificationBanner: {
    width: '100%',
    backgroundColor: '#E8FBF0',
    borderWidth: 1,
    borderColor: '#B7EFCF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },

  verificationBannerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#168A4B',
    textAlign: 'center',
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
