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
  // PERSONAL INFORMATION
  // ---------------------------------------------------------

  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // ---------------------------------------------------------
  // PASSWORD
  // ---------------------------------------------------------

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  // ---------------------------------------------------------
  // DELIVERY ADDRESS
  // ---------------------------------------------------------

  const [addressType, setAddressType] = useState('home');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pinCode, setPinCode] = useState('');

  // Hidden coordinates used for backend delivery calculations.
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  // ---------------------------------------------------------
  // COMMON STATE
  // ---------------------------------------------------------

  const [loading, setLoading] = useState(false);
  const [detectingLocation, setDetectingLocation] =
    useState(false);
  const [focusedInput, setFocusedField] =
    useState<string | null>(null);
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

  const timerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------
  // INITIAL ANIMATION
  // ---------------------------------------------------------

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

  // ---------------------------------------------------------
  // OTP TIMER
  // ---------------------------------------------------------

  useEffect(() => {
    if (!showOtpModal) {
      return;
    }

    if (resendTimer > 0) {
      setResendAvailable(false);

      timerRef.current = setTimeout(() => {
        setResendTimer((previous) => previous - 1);
      }, 1000);
    } else {
      setResendAvailable(true);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [showOtpModal, resendTimer]);

  // ---------------------------------------------------------
  // VALIDATION HELPERS
  // ---------------------------------------------------------

  const isValidEmail = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  const isValidPassword = (value: string) => {
    return value.length >= 6;
  };

  // ---------------------------------------------------------
  // LOCATION HELPERS
  // ---------------------------------------------------------

  const isPlusCodeOrCoordinate = (
    value?: string | null
  ) => {
    if (!value) return true;

    const clean = value.trim();

    if (
      clean.includes('+') &&
      /^[23456789CFGHJMPQRVWX]{2,8}\+/.test(
        clean.toUpperCase()
      )
    ) {
      return true;
    }

    if (/^-?\d+(\.\d+)?$/.test(clean)) {
      return true;
    }

    return false;
  };

  // ---------------------------------------------------------
  // GET CURRENT LOCATION
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

      // Coordinates are intentionally hidden from the user.
      // They are stored for delivery-distance calculations.
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

      const clean = (value?: string | null) =>
        value?.trim() || '';

      const isInvalidAddressValue = (
        value?: string | null
      ) => {
        const text = clean(value);

        if (!text) return true;

        const upper = text.toUpperCase();

        if (
          /^[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]+/.test(
            upper
          )
        ) {
          return true;
        }

        if (
          /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(
            text
          )
        ) {
          return true;
        }

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

      const detectedCity =
        clean(item.city) ||
        clean(item.subregion) ||
        clean(item.district);

      const detectedState =
        clean(item.region);

      const detectedPin =
        clean(item.postalCode);

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
  // SEND REGISTRATION OTP
  // ---------------------------------------------------------

  const handleStartOtpFlow = async () => {
    const cleanName = customerName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone
      .trim()
      .replace(/[^0-9]/g, '');

    if (
      !cleanName ||
      !cleanEmail ||
      !cleanPhone ||
      !password ||
      !confirmPassword ||
      !addressLine1.trim() ||
      !city.trim() ||
      !state.trim() ||
      !pinCode.trim()
    ) {
      Alert.alert(
        'Missing Fields',
        'Please complete all required fields marked with (*).'
      );
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      Alert.alert(
        'Invalid Email',
        'Please enter a valid email address.'
      );
      return;
    }

    if (cleanPhone.length !== 10) {
      Alert.alert(
        'Invalid Phone',
        'Please enter a valid 10-digit mobile number.'
      );
      return;
    }

    if (!isValidPassword(password)) {
      Alert.alert(
        'Weak Password',
        'Password must contain at least 6 characters.'
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        'Password Mismatch',
        'Password and confirm password must match.'
      );
      return;
    }

    if (!termsAgreed) {
      Alert.alert(
        'Terms Required',
        'Please agree to the terms before continuing.'
      );
      return;
    }

    if (loading) return;

    setLoading(true);

    try {
      /*
       * We intentionally use OTP for email verification.
       *
       * shouldCreateUser:true allows Supabase Auth to create
       * the authentication user during the verification flow.
       *
       * The password is NOT stored in the customers table.
       * It belongs exclusively to Supabase Auth.
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
    } catch (error: any) {
      console.error(
        'Registration OTP error:',
        error
      );

      Alert.alert(
        'Registration Error',
        error?.message ||
          'Failed to send OTP. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // VERIFY OTP + SET PASSWORD + CREATE PROFILE
  // ---------------------------------------------------------

  const handleVerifyOtpAndCreateProfile =
    async () => {
      const cleanOtp = otpToken.trim();

      if (cleanOtp.length !== 6) {
        Alert.alert(
          'Invalid Code',
          'Please enter a valid 6-digit verification code.'
        );
        return;
      }

      if (verifyingOtp) return;

      setVerifyingOtp(true);

      try {
        const cleanEmail =
          email.trim().toLowerCase();

        const cleanPhone = phone
          .trim()
          .replace(/[^0-9]/g, '');

        /*
         * -----------------------------------------------------
         * 1. VERIFY EMAIL OTP
         * -----------------------------------------------------
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
            'Account verification failed.'
          );
        }

        /*
         * -----------------------------------------------------
         * 2. SET PASSWORD IN SUPABASE AUTH
         * -----------------------------------------------------
         *
         * The password is never inserted into the
         * customers table.
         */

        const {
          error: passwordError,
        } = await supabase.auth.updateUser({
          password,
        });

        if (passwordError) {
          throw passwordError;
        }

        /*
         * -----------------------------------------------------
         * 3. CHECK WHETHER CUSTOMER PROFILE ALREADY EXISTS
         * -----------------------------------------------------
         *
         * This prevents duplicate customer rows if the
         * registration flow is retried.
         */

        const {
          data: existingCustomer,
          error: existingCustomerError,
        } = await supabase
          .from('customers')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        if (existingCustomerError) {
          throw existingCustomerError;
        }

        let customerId: string;

        /*
         * -----------------------------------------------------
         * 4. CREATE CUSTOMER PROFILE
         * -----------------------------------------------------
         */

        if (existingCustomer) {
          customerId = existingCustomer.id;

          /*
           * Keep the existing profile if the user somehow
           * returns to this flow after authentication.
           */
          const {
            error: updateCustomerError,
          } = await supabase
            .from('customers')
            .update({
              customer_name:
                customerName.trim(),
              email: cleanEmail,
              phone: cleanPhone,
            })
            .eq('id', customerId);

          if (updateCustomerError) {
            throw updateCustomerError;
          }
        } else {
          const {
            data: customerData,
            error: customerError,
          } = await supabase
            .from('customers')
            .insert({
              auth_user_id: user.id,
              customer_name:
                customerName.trim(),
              email: cleanEmail,
              phone: cleanPhone,
            })
            .select()
            .single();

          if (customerError) {
            if (customerError.code === '23505') {
              throw new Error(
                'An account with this email or mobile number already exists.'
              );
            }

            throw customerError;
          }

          if (!customerData) {
            throw new Error(
              'Customer profile could not be created.'
            );
          }

          customerId = customerData.id;
        }

        /*
         * -----------------------------------------------------
         * 5. CREATE DEFAULT DELIVERY ADDRESS
         * -----------------------------------------------------
         *
         * Latitude and longitude remain hidden from UI.
         */

        const {
          error: addressError,
        } = await supabase
          .from('customer_addresses')
          .insert({
            customer_id: customerId,
            address_line1:
              addressLine1.trim(),
            address_line2:
              addressLine2.trim() || null,
            city: city.trim(),
            state: state.trim(),
            pin_code: pinCode.trim(),
            landmark:
              landmark.trim() || null,
            address_type: addressType,
            is_default: true,
            latitude,
            longitude,
          });

        if (addressError) {
          /*
           * Do not silently ignore address failures.
           * The customer account exists, but the delivery
           * address is important for Rivo ordering.
           */
          throw addressError;
        }

        /*
         * -----------------------------------------------------
         * 6. COMPLETE REGISTRATION
         * -----------------------------------------------------
         */

        setShowOtpModal(false);

        Alert.alert(
          'Account Created',
          'Your RivoCity customer account has been created successfully.',
          [
            {
              text: 'Continue',
              onPress: () =>
                router.replace('/'),
            },
          ]
        );
      } catch (error: any) {
        console.error(
          'Registration verification failed:',
          error
        );

        Alert.alert(
          'Registration Failed',
          error?.message ||
            'Verification failed. Please try again.'
        );
      } finally {
        setVerifyingOtp(false);
      }
    };

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------

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
            {/* BRANDING */}

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
                Join Rivo and shop from local
                stores.
              </Text>
            </View>

            {/* PERSONAL INFORMATION */}

            <View
              style={styles.formSectionCard}
            >
              <Text
                style={
                  styles.cardHeaderHeading
                }
              >
                Personal Details
              </Text>

              {/* NAME */}

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
                  onChangeText={
                    setCustomerName
                  }
                  onFocus={() =>
                    setFocusedField(
                      'name'
                    )
                  }
                  onBlur={() =>
                    setFocusedField(null)
                  }
                />
              </View>

              {/* EMAIL */}

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
                    setFocusedField(
                      'email'
                    )
                  }
                  onBlur={() =>
                    setFocusedField(null)
                  }
                />
              </View>

              {/* PHONE */}

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
                    setFocusedField(
                      'phone'
                    )
                  }
                  onBlur={() =>
                    setFocusedField(null)
                  }
                />
              </View>

              {/* PASSWORD */}

              <Text style={styles.fieldLabel}>
                Password *
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  focusedInput ===
                    'password' &&
                    styles.inputFocused,
                ]}
              >
                <TextInput
                  style={styles.inputField}
                  placeholder="Minimum 6 characters"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={
                    !showPassword
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() =>
                    setFocusedField(
                      'password'
                    )
                  }
                  onBlur={() =>
                    setFocusedField(null)
                  }
                />

                <TouchableOpacity
                  style={
                    styles.passwordToggle
                  }
                  onPress={() =>
                    setShowPassword(
                      (previous) =>
                        !previous
                    )
                  }
                >
                  <Text
                    style={
                      styles.passwordToggleText
                    }
                  >
                    {showPassword
                      ? 'Hide'
                      : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* CONFIRM PASSWORD */}

              <Text style={styles.fieldLabel}>
                Confirm Password *
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  focusedInput ===
                    'confirmPassword' &&
                    styles.inputFocused,
                ]}
              >
                <TextInput
                  style={styles.inputField}
                  placeholder="Re-enter your password"
                  placeholderTextColor="#94A3B8"
                  value={confirmPassword}
                  onChangeText={
                    setConfirmPassword
                  }
                  secureTextEntry={
                    !showConfirmPassword
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  onFocus={() =>
                    setFocusedField(
                      'confirmPassword'
                    )
                  }
                  onBlur={() =>
                    setFocusedField(null)
                  }
                />

                <TouchableOpacity
                  style={
                    styles.passwordToggle
                  }
                  onPress={() =>
                    setShowConfirmPassword(
                      (previous) =>
                        !previous
                    )
                  }
                >
                  <Text
                    style={
                      styles.passwordToggleText
                    }
                  >
                    {showConfirmPassword
                      ? 'Hide'
                      : 'Show'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text
                style={
                  styles.passwordHint
                }
              >
                Password must contain at least
                6 characters.
              </Text>
            </View>

            {/* DELIVERY ADDRESS */}

            <View
              style={styles.formSectionCard}
            >
              <Text
                style={
                  styles.cardHeaderHeading
                }
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
                disabled={
                  detectingLocation
                }
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

              {/* ADDRESS LINE 1 */}

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
                  placeholder="Flat / Building / Street"
                  placeholderTextColor="#94A3B8"
                  value={addressLine1}
                  onChangeText={
                    setAddressLine1
                  }
                  onFocus={() =>
                    setFocusedField(
                      'addr1'
                    )
                  }
                  onBlur={() =>
                    setFocusedField(null)
                  }
                />
              </View>

              {/* ADDRESS LINE 2 */}

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
                  onChangeText={
                    setAddressLine2
                  }
                  onFocus={() =>
                    setFocusedField(
                      'addr2'
                    )
                  }
                  onBlur={() =>
                    setFocusedField(null)
                  }
                />
              </View>

              {/* LANDMARK */}

              <Text style={styles.fieldLabel}>
                Landmark
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  focusedInput ===
                    'landmark' &&
                    styles.inputFocused,
                ]}
              >
                <TextInput
                  style={styles.inputField}
                  placeholder="Nearby Landmark (Optional)"
                  placeholderTextColor="#94A3B8"
                  value={landmark}
                  onChangeText={setLandmark}
                  onFocus={() =>
                    setFocusedField(
                      'landmark'
                    )
                  }
                  onBlur={() =>
                    setFocusedField(null)
                  }
                />
              </View>

              {/* CITY + STATE */}

              <View
                style={styles.formInputsRow}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={
                      styles.fieldLabel
                    }
                  >
                    City *
                  </Text>

                  <View
                    style={[
                      styles.inputContainer,
                      focusedInput ===
                        'city' &&
                        styles.inputFocused,
                    ]}
                  >
                    <TextInput
                      style={
                        styles.inputField
                      }
                      placeholder="City"
                      placeholderTextColor="#94A3B8"
                      value={city}
                      onChangeText={setCity}
                      onFocus={() =>
                        setFocusedField(
                          'city'
                        )
                      }
                      onBlur={() =>
                        setFocusedField(
                          null
                        )
                      }
                    />
                  </View>
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={
                      styles.fieldLabel
                    }
                  >
                    State *
                  </Text>

                  <View
                    style={[
                      styles.inputContainer,
                      focusedInput ===
                        'state' &&
                        styles.inputFocused,
                    ]}
                  >
                    <TextInput
                      style={
                        styles.inputField
                      }
                      placeholder="State"
                      placeholderTextColor="#94A3B8"
                      value={state}
                      onChangeText={setState}
                      onFocus={() =>
                        setFocusedField(
                          'state'
                        )
                      }
                      onBlur={() =>
                        setFocusedField(
                          null
                        )
                      }
                    />
                  </View>
                </View>
              </View>

              {/* PIN CODE */}

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
                    setFocusedField(
                      'pin'
                    )
                  }
                  onBlur={() =>
                    setFocusedField(null)
                  }
                />
              </View>

              {/* TERMS */}

              <TouchableOpacity
                style={
                  styles.termsRow
                }
                onPress={() =>
                  setTermsAgreed(
                    (previous) =>
                      !previous
                  )
                }
              >
                <View
                  style={[
                    styles.checkbox,
                    termsAgreed &&
                      styles.checkboxActive,
                  ]}
                >
                  {termsAgreed && (
                    <Text
                      style={
                        styles.checkboxTick
                      }
                    >
                      ✓
                    </Text>
                  )}
                </View>

                <Text
                  style={
                    styles.termsText
                  }
                >
                  I agree to the Rivo terms
                  and conditions.
                </Text>
              </TouchableOpacity>

              {/* SUBMIT */}

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!termsAgreed ||
                    loading) && {
                    backgroundColor:
                      '#CBD5E1',
                  },
                ]}
                onPress={
                  handleStartOtpFlow
                }
                disabled={
                  loading ||
                  !termsAgreed
                }
              >
                {loading ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <Text
                    style={
                      styles.submitButtonText
                    }
                  >
                    Verify Email & Continue
                  </Text>
                )}
              </TouchableOpacity>

              {/* LOGIN */}

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
                  Already registered?{' '}
                </Text>

                <TouchableOpacity
                  onPress={() =>
                    router.replace(
                      '/login'
                    )
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

      {/* OTP MODAL */}

      <Modal
        visible={showOtpModal}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setShowOtpModal(false)
        }
      >
        <View
          style={styles.modalOverlay}
        >
          <View
            style={styles.modalCard}
          >
            <Text
              style={styles.modalTitle}
            >
              Verify Email
            </Text>

            <Text
              style={
                styles.modalSubtitle
              }
            >
              Enter the 6-digit code sent
              to {email}
            </Text>

            <View
              style={styles.otpInputBox}
            >
              <TextInput
                style={
                  styles.otpInputField
                }
                placeholder="000000"
                placeholderTextColor="#CBD5E1"
                value={otpToken}
                onChangeText={
                  setOtpToken
                }
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={
                styles.verifySubmitBtn
              }
              onPress={
                handleVerifyOtpAndCreateProfile
              }
              disabled={verifyingOtp}
            >
              {verifyingOtp ? (
                <ActivityIndicator
                  color="#FFFFFF"
                />
              ) : (
                <Text
                  style={
                    styles.verifySubmitBtnText
                  }
                >
                  Verify & Complete Registration
                </Text>
              )}
            </TouchableOpacity>

            {/* RESEND */}

            <TouchableOpacity
              style={
                styles.resendButton
              }
              onPress={
                handleStartOtpFlow
              }
              disabled={
                !canResend ||
                loading ||
                verifyingOtp
              }
            >
              <Text
                style={[
                  styles.resendText,
                  !canResend && {
                    color:
                      '#94A3B8',
                  },
                ]}
              >
                {canResend
                  ? 'Resend OTP'
                  : `Resend OTP in ${resendTimer}s`}
              </Text>
            </TouchableOpacity>

            {/* CANCEL */}

            <TouchableOpacity
              style={
                styles.cancelModalBtn
              }
              onPress={() =>
                setShowOtpModal(false)
              }
              disabled={verifyingOtp}
            >
              <Text
                style={
                  styles.cancelModalText
                }
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

// ---------------------------------------------------------
// STYLES
// ---------------------------------------------------------

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
  },

  cardHeaderHeading: {
    fontSize: 14,
    fontWeight: '900',
    color: '#22CC71',
    textTransform: 'uppercase',
    marginBottom: 14,
  },

  getCurrentLocationButton: {
    backgroundColor: '#E8FBF0',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22CC7140',
    alignItems: 'center',
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

  passwordToggle: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },

  passwordToggleText: {
    color: '#22CC71',
    fontSize: 12,
    fontWeight: '900',
  },

  passwordHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: -5,
    marginBottom: 8,
  },

  formInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },

  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  checkboxActive: {
    backgroundColor: '#22CC71',
    borderColor: '#22CC71',
  },

  checkboxTick: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  termsText: {
    flex: 1,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },

  submitButton: {
    backgroundColor: '#22CC71',
    width: '100%',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 12,
  },

  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  alternativeLoginLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 18,
  },

  alternativeLabelText: {
    fontSize: 14,
    color: '#64748B',
  },

  alternativeActiveText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#22CC71',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor:
      'rgba(13, 13, 13, 0.5)',
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
    marginBottom: 16,
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
    marginBottom: 12,
  },

  verifySubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },

  resendButton: {
    paddingVertical: 6,
    marginBottom: 4,
  },

  resendText: {
    color: '#22CC71',
    fontSize: 13,
    fontWeight: '800',
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