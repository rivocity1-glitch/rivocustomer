import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
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

type LoginMode = 'password' | 'otp';

export default function LoginScreen() {
  const router = useRouter();

  // Password login
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);

  // OTP login
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpToken, setOtpToken] = useState('');

  const [loginMode, setLoginMode] = useState<LoginMode>('password');
  const [loading, setLoading] = useState(false);

  const [identifierFocused, setIdentifierFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [otpFocused, setOtpFocused] = useState(false);

  // OTP resend timer
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setResendAvailable] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function checkExistingSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        return;
      }

      try {
        // A Supabase Auth session alone is NOT enough.
        // The user must also have an existing Rivo customer record.
        const { data: existingCustomer, error } = await supabase
          .from('customers')
          .select('id')
          .eq('auth_user_id', session.user.id)
          .maybeSingle();

        if (error) {
          console.error(
            'Customer session validation error:',
            error
          );

          await supabase.auth.signOut();
          return;
        }

        if (!existingCustomer) {
          await supabase.auth.signOut();
          return;
        }

        router.replace('/');
      } catch (error) {
        console.error(
          'Existing session validation error:',
          error
        );

        await supabase.auth.signOut();
      }
    }

    checkExistingSession();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 6,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // OTP resend timer
  useEffect(() => {
    if (otpSent && resendTimer > 0) {
      setResendAvailable(false);

      timerRef.current = setTimeout(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else if (otpSent && resendTimer === 0) {
      setResendAvailable(true);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [otpSent, resendTimer]);

  // ---------------------------------------------------------
  // PASSWORD LOGIN
  // Supports:
  // 1. Email + password
  // 2. Mobile + password
  // ---------------------------------------------------------
  const handlePasswordLogin = async () => {
    const identifier = loginIdentifier.trim();

    if (!identifier) {
      Alert.alert(
        'Missing Login Details',
        'Please enter your email address or mobile number.'
      );
      return;
    }

    if (!password) {
      Alert.alert(
        'Missing Password',
        'Please enter your password.'
      );
      return;
    }

    setLoading(true);

    try {
      let authEmail = identifier.toLowerCase();

      // Detect mobile number
      const digitsOnly = identifier.replace(/\D/g, '');
      const looksLikePhone =
        !identifier.includes('@') && digitsOnly.length >= 10;

      if (looksLikePhone) {
        const { data, error } = await supabase.rpc(
          'get_customer_auth_email_by_phone',
          {
            p_phone: identifier,
          }
        );

        if (error) {
          console.error('Phone lookup error:', error);
          throw new Error(
            'Unable to find an account with this mobile number.'
          );
        }

        if (!data) {
          throw new Error(
            'No customer account was found with this mobile number.'
          );
        }

        authEmail = String(data).trim().toLowerCase();
      } else {
        const emailRegex =
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(authEmail)) {
          Alert.alert(
            'Invalid Email',
            'Please enter a valid email address or mobile number.'
          );
          return;
        }
      }

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: authEmail,
          password,
        });

      if (error) {
        throw error;
      }

      if (!data?.user) {
        throw new Error(
          'Unable to verify the customer account.'
        );
      }

      // IMPORTANT:
      // Password authentication does NOT create a customer.
      // The authenticated user must already have a customer record.
      const { data: existingCustomer, error: customerError } =
        await supabase
          .from('customers')
          .select('id')
          .eq('auth_user_id', data.user.id)
          .maybeSingle();

      if (customerError) {
        console.error(
          'Customer validation error:',
          customerError
        );

        await supabase.auth.signOut();

        throw new Error(
          'Unable to verify your customer account.'
        );
      }

      if (!existingCustomer) {
        await supabase.auth.signOut();

        throw new Error(
          'This account is not registered as a Rivo customer. Please create a customer account first.'
        );
      }

      router.replace('/');
    } catch (error: any) {
      console.error('Password login error:', error);

      Alert.alert(
        'Login Failed',
        error?.message ||
          'Incorrect email/mobile number or password.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // SEND EMAIL OTP
  // ---------------------------------------------------------
  const handleSendOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      Alert.alert(
        'Missing Email',
        'Please enter your email address.'
      );
      return;
    }

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleanEmail)) {
      Alert.alert(
        'Invalid Email',
        'Please enter a valid email address.'
      );
      return;
    }

    setLoading(true);

    try {
      // IMPORTANT:
      // OTP login is only for existing Rivo customers.
      // Check the customers table BEFORE sending the OTP.
      const { data: existingCustomer, error: customerError } =
        await supabase
          .from('customers')
          .select('id, auth_user_id')
          .eq('email', cleanEmail)
          .maybeSingle();

      if (customerError) {
        console.error(
          'OTP customer lookup error:',
          customerError
        );

        throw new Error(
          'Unable to verify this customer account. Please try again.'
        );
      }

      if (!existingCustomer) {
        Alert.alert(
          'Account Not Found',
          'No Rivo customer account is registered with this email address. Please create an account first.'
        );
        return;
      }

      if (!existingCustomer.auth_user_id) {
        Alert.alert(
          'Account Not Ready',
          'This customer account is not linked to a login account yet. Please contact Rivo support.'
        );
        return;
      }

      // IMPORTANT:
      // shouldCreateUser MUST remain false.
      // An unregistered email must NEVER create a new Auth user
      // from the login screen.
      const { error } =
        await supabase.auth.signInWithOtp({
          email: cleanEmail,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: undefined,
          },
        });

      if (error) {
        throw error;
      }

      setOtpSent(true);
      setResendTimer(60);
      setResendAvailable(false);

      Alert.alert(
        'OTP Sent ✉️',
        'A 6-digit verification code has been dispatched to your email.'
      );
    } catch (error: any) {
      console.error('Send OTP error:', error);

      Alert.alert(
        'Error',
        error?.message ||
          'Could not send verification code.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // VERIFY EMAIL OTP
  // ---------------------------------------------------------
  const handleVerifyOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otpToken.trim();

    if (cleanOtp.length !== 6) {
      Alert.alert(
        'Invalid OTP',
        'Please enter a valid 6-digit verification code.'
      );
      return;
    }

    setLoading(true);

    try {
      // Verify that this is still an existing Rivo customer
      // before allowing the OTP session to enter the app.
      const {
        data: existingCustomer,
        error: customerLookupError,
      } = await supabase
        .from('customers')
        .select('id, auth_user_id')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (customerLookupError) {
        console.error(
          'OTP verification customer lookup error:',
          customerLookupError
        );

        throw new Error(
          'Unable to verify your customer account.'
        );
      }

      if (!existingCustomer) {
        await supabase.auth.signOut();

        throw new Error(
          'This email is not registered as a Rivo customer. Please create an account first.'
        );
      }

      if (!existingCustomer.auth_user_id) {
        await supabase.auth.signOut();

        throw new Error(
          'This customer account is not linked to a login account.'
        );
      }

      const { data, error } =
        await supabase.auth.verifyOtp({
          email: cleanEmail,
          token: cleanOtp,
          type: 'email',
        });

      if (error) {
        throw error;
      }

      if (!data?.user) {
        throw new Error(
          'Unable to verify the customer account.'
        );
      }

      // The authenticated Auth user must belong to the
      // already-existing customer record.
      if (
        data.user.id !== existingCustomer.auth_user_id
      ) {
        await supabase.auth.signOut();

        throw new Error(
          'This login account is not linked to the Rivo customer account.'
        );
      }

      router.replace('/');
    } catch (error: any) {
      console.error('OTP verification error:', error);

      Alert.alert(
        'Verification Failed',
        error?.message ||
          'Invalid code. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // SWITCH TO PASSWORD LOGIN
  // ---------------------------------------------------------
  const switchToPasswordLogin = () => {
    setLoginMode('password');
    setOtpSent(false);
    setOtpToken('');
    setEmail('');
    setResendTimer(60);
    setResendAvailable(false);
  };

  // ---------------------------------------------------------
  // SWITCH TO OTP LOGIN
  // ---------------------------------------------------------
  const switchToOtpLogin = () => {
    setLoginMode('otp');
    setOtpSent(false);
    setOtpToken('');
    setResendTimer(60);
    setResendAvailable(false);
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
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={[
              styles.innerAnimated,
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
            {/* Hero */}
            <View style={styles.heroSection}>
              <Animated.View
                style={[
                  styles.logoCircle,
                  {
                    transform: [
                      {
                        scale: logoScale,
                      },
                      {
                        translateY: floatAnim,
                      },
                    ],
                  },
                ]}
              >
                <Text style={styles.logoSymbol}>R</Text>
              </Animated.View>

              <Text style={styles.welcomeHeading}>
                Welcome Back
              </Text>

              <Text style={styles.welcomeSubtitle}>
                Login to continue shopping nearby.
              </Text>
            </View>

            {/* Form Card */}
            <View style={styles.formCard}>
              {/* LOGIN MODE TABS */}
              <View style={styles.modeTabs}>
                <TouchableOpacity
                  style={[
                    styles.modeTab,
                    loginMode === 'password' &&
                      styles.modeTabActive,
                  ]}
                  onPress={switchToPasswordLogin}
                  disabled={loading}
                >
                  <Text
                    style={[
                      styles.modeTabText,
                      loginMode === 'password' &&
                        styles.modeTabTextActive,
                    ]}
                  >
                    Password
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.modeTab,
                    loginMode === 'otp' &&
                      styles.modeTabActive,
                  ]}
                  onPress={switchToOtpLogin}
                  disabled={loading}
                >
                  <Text
                    style={[
                      styles.modeTabText,
                      loginMode === 'otp' &&
                        styles.modeTabTextActive,
                    ]}
                  >
                    Email OTP
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ================================================= */}
              {/* PASSWORD LOGIN */}
              {/* ================================================= */}
              {loginMode === 'password' && (
                <>
                  <Text style={styles.inputLabel}>
                    Email or Mobile Number
                  </Text>

                  <View
                    style={[
                      styles.inputContainer,
                      identifierFocused &&
                        styles.inputFocused,
                    ]}
                  >
                    <TextInput
                      style={styles.inputField}
                      placeholder="Email or 9876543210"
                      placeholderTextColor="#94A3B8"
                      value={loginIdentifier}
                      onChangeText={setLoginIdentifier}
                      keyboardType="default"
                      autoCapitalize="none"
                      autoCorrect={false}
                      onFocus={() =>
                        setIdentifierFocused(true)
                      }
                      onBlur={() =>
                        setIdentifierFocused(false)
                      }
                    />
                  </View>

                  <Text style={styles.inputLabel}>
                    Password
                  </Text>

                  <View
                    style={[
                      styles.inputContainer,
                      passwordFocused &&
                        styles.inputFocused,
                    ]}
                  >
                    <TextInput
                      style={styles.inputField}
                      placeholder="Enter your password"
                      placeholderTextColor="#94A3B8"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!passwordVisible}
                      autoCapitalize="none"
                      autoCorrect={false}
                      onFocus={() =>
                        setPasswordFocused(true)
                      }
                      onBlur={() =>
                        setPasswordFocused(false)
                      }
                    />

                    <TouchableOpacity
                      style={styles.passwordToggle}
                      onPress={() =>
                        setPasswordVisible(
                          (prev) => !prev
                        )
                      }
                      disabled={loading}
                    >
                      <Text
                        style={
                          styles.passwordToggleText
                        }
                      >
                        {passwordVisible
                          ? 'Hide'
                          : 'Show'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.loginSubmitButton}
                    onPress={handlePasswordLogin}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text
                        style={styles.loginButtonText}
                      >
                        Login
                      </Text>
                    )}
                  </TouchableOpacity>

                  <Text style={styles.loginHint}>
                    Use your registered email or mobile
                    number with your password.
                  </Text>
                </>
              )}

              {/* ================================================= */}
              {/* EMAIL OTP LOGIN */}
              {/* ================================================= */}
              {loginMode === 'otp' && (
                <>
                  <Text style={styles.inputLabel}>
                    Email Address
                  </Text>

                  <View
                    style={[
                      styles.inputContainer,
                      emailFocused &&
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
                      editable={!otpSent}
                      onFocus={() =>
                        setEmailFocused(true)
                      }
                      onBlur={() =>
                        setEmailFocused(false)
                      }
                    />
                  </View>

                  {otpSent && (
                    <>
                      <Text style={styles.inputLabel}>
                        6-Digit Verification Code
                      </Text>

                      <View
                        style={[
                          styles.inputContainer,
                          otpFocused &&
                            styles.inputFocused,
                        ]}
                      >
                        <TextInput
                          style={[
                            styles.inputField,
                            {
                              letterSpacing: 4,
                              fontWeight: '800',
                            },
                          ]}
                          placeholder="• • • • • •"
                          placeholderTextColor="#CBD5E1"
                          value={otpToken}
                          onChangeText={setOtpToken}
                          keyboardType="number-pad"
                          maxLength={6}
                          onFocus={() =>
                            setOtpFocused(true)
                          }
                          onBlur={() =>
                            setOtpFocused(false)
                          }
                        />
                      </View>
                    </>
                  )}

                  {!otpSent ? (
                    <TouchableOpacity
                      style={
                        styles.loginSubmitButton
                      }
                      onPress={handleSendOtp}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text
                          style={
                            styles.loginButtonText
                          }
                        >
                          Send OTP ✉️
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={
                        styles.loginSubmitButton
                      }
                      onPress={handleVerifyOtp}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      {loading ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text
                          style={
                            styles.loginButtonText
                          }
                        >
                          Verify & Login
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}

                  {otpSent && (
                    <TouchableOpacity
                      style={{
                        marginTop: 12,
                        alignItems: 'center',
                      }}
                      onPress={handleSendOtp}
                      disabled={!canResend || loading}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.resendText,
                          !canResend && {
                            color: '#94A3B8',
                          },
                        ]}
                      >
                        {canResend
                          ? 'Resend Verification Code'
                          : `Resend Code in ${resendTimer}s`}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {otpSent && (
                    <TouchableOpacity
                      style={{
                        marginTop: 8,
                        alignItems: 'center',
                      }}
                      onPress={() => {
                        setOtpSent(false);
                        setOtpToken('');
                      }}
                      disabled={loading}
                    >
                      <Text
                        style={
                          styles.changeEmailText
                        }
                      >
                        Change Email Address
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {/* Register */}
              <TouchableOpacity
                style={
                  styles.registerNavigateButton
                }
                onPress={() =>
                  router.push('/register')
                }
                disabled={loading}
                activeOpacity={0.75}
              >
                <Text
                  style={
                    styles.registerButtonText
                  }
                >
                  Create Account
                </Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footerContainer}>
              <Text style={styles.footerText}>
                By logging in, you accept Rivo's standard
                dynamic{' '}
                <Text style={styles.footerLink}>
                  Terms & Conditions
                </Text>{' '}
                and{' '}
                <Text style={styles.footerLink}>
                  Privacy Policy
                </Text>
                .
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },

  scrollContainer: {
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexGrow: 1,
  },

  innerAnimated: {
    width: '100%',
    alignItems: 'center',
  },

  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
  },

  logoCircle: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: '#22CC71',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#22CC71',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 5,
  },

  logoSymbol: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
  },

  welcomeHeading: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0D0D0D',
    letterSpacing: -0.6,
  },

  welcomeSubtitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 4,
  },

  formCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EAEFF3',
    shadowColor: '#0D0D0D',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.02,
    shadowRadius: 12,
    elevation: 2,
  },

  modeTabs: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },

  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },

  modeTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },

  modeTabTextActive: {
    color: '#22CC71',
    fontWeight: '800',
  },

  inputLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#0D0D0D',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
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
    marginBottom: 16,
    position: 'relative',
  },

  inputFocused: {
    borderColor: '#22CC71',
    backgroundColor: '#FFFFFF',
  },

  inputField: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
    fontWeight: '800',
  },

  loginSubmitButton: {
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
    elevation: 4,
  },

  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  loginHint: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
    fontWeight: '500',
  },

  resendText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#22CC71',
  },

  changeEmailText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },

  registerNavigateButton: {
    width: '100%',
    padding: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#22CC71',
    marginTop: 18,
  },

  registerButtonText: {
    color: '#22CC71',
    fontSize: 15,
    fontWeight: '800',
  },

  footerContainer: {
    marginTop: 28,
    paddingHorizontal: 16,
  },

  footerText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 16,
    fontWeight: '500',
  },

  footerLink: {
    fontWeight: '700',
    color: '#64748B',
  },
});
