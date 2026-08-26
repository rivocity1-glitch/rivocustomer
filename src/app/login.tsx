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

type LoginMethod = 'password' | 'otp';

export default function LoginScreen() {
  const router = useRouter();

  // ---------------------------------------------------------
  // LOGIN STATE
  // ---------------------------------------------------------

  const [loginMethod, setLoginMethod] =
    useState<LoginMethod>('password');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // ---------------------------------------------------------
  // OTP STATE
  // ---------------------------------------------------------

  const [otpSent, setOtpSent] = useState(false);
  const [otpToken, setOtpToken] = useState('');

  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setResendAvailable] = useState(false);

  // ---------------------------------------------------------
  // COMMON STATE
  // ---------------------------------------------------------

  const [loading, setLoading] = useState(false);

  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [otpFocused, setOtpFocused] = useState(false);

  // ---------------------------------------------------------
  // ANIMATIONS
  // ---------------------------------------------------------

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------
  // EXISTING SESSION
  // ---------------------------------------------------------

  useEffect(() => {
    async function checkExistingSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) return;

        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('auth_user_id', session.user.id)
          .maybeSingle();

        if (!existingCustomer) {
          await supabase.auth.signOut();
          return;
        }

        router.replace('/');
      } catch (error) {
        console.error('Existing session check failed:', error);
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

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // ---------------------------------------------------------
  // OTP TIMER
  // ---------------------------------------------------------

  useEffect(() => {
    if (loginMethod !== 'otp' || !otpSent) {
      return;
    }

    if (resendTimer > 0) {
      setResendAvailable(false);

      timerRef.current = setTimeout(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    } else {
      setResendAvailable(true);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [loginMethod, otpSent, resendTimer]);

  // ---------------------------------------------------------
  // VALIDATE EMAIL
  // ---------------------------------------------------------

  const validateEmail = (value: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  };

  // ---------------------------------------------------------
  // VERIFY CUSTOMER EXISTS
  // ---------------------------------------------------------

  const verifyCustomerAccount = async (authUserId: string) => {
    const { data: existingCustomer, error } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (error) {
      throw new Error(
        'Unable to verify your Rivo customer account.'
      );
    }

    if (!existingCustomer) {
      await supabase.auth.signOut();

      throw new Error(
        'This account is not registered as a Rivo customer.'
      );
    }

    return existingCustomer;
  };

  // ---------------------------------------------------------
  // PASSWORD LOGIN
  // ---------------------------------------------------------

  const handlePasswordLogin = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      Alert.alert(
        'Missing Email',
        'Please enter your email address.'
      );
      return;
    }

    if (!validateEmail(cleanEmail)) {
      Alert.alert(
        'Invalid Email',
        'Please enter a valid email address.'
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

    if (loading) return;

    setLoading(true);

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (error) {
        if (
          error.message
            ?.toLowerCase()
            .includes('email not confirmed')
        ) {
          throw new Error(
            'Please verify your email address before logging in.'
          );
        }

        throw error;
      }

      if (!data?.user) {
        throw new Error(
          'Unable to sign in to your Rivo account.'
        );
      }

      await verifyCustomerAccount(data.user.id);

      router.replace('/');
    } catch (error: any) {
      console.error('Password login failed:', error);

      const message =
        error?.message ||
        'Unable to login. Please check your email and password.';

      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // SEND OTP
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

    if (!validateEmail(cleanEmail)) {
      Alert.alert(
        'Invalid Email',
        'Please enter a valid email address.'
      );
      return;
    }

    if (loading) return;

    setLoading(true);

    try {
      // Confirm customer exists before sending OTP.
      const {
        data: registeredEmail,
        error: customerLookupError,
      } = await supabase.rpc(
        'get_customer_auth_email_by_email',
        {
          p_email: cleanEmail,
        }
      );

      if (customerLookupError) {
        if (
          customerLookupError.message?.includes(
            'FetchError'
          ) ||
          customerLookupError.message?.includes(
            'UnknownHostException'
          ) ||
          customerLookupError.name ===
            'AuthRetryableFetchError'
        ) {
          throw new Error(
            'Network error. Unable to reach server. Check your internet connection.'
          );
        }

        throw new Error(
          'Unable to verify this email address. Please try again.'
        );
      }

      if (!registeredEmail) {
        Alert.alert(
          'Account Not Found',
          'No Rivo customer account is registered with this email address. Please register first.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Register Now',
              onPress: () => router.push('/register'),
            },
          ]
        );

        return;
      }

      const { error: otpError } =
        await supabase.auth.signInWithOtp({
          email: cleanEmail,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: undefined,
          },
        });

      if (otpError) {
        throw otpError;
      }

      setOtpSent(true);
      setOtpToken('');
      setResendTimer(60);
      setResendAvailable(false);

      Alert.alert(
        'OTP Sent ✉️',
        `A 6-digit code has been sent to ${cleanEmail}.`
      );
    } catch (error: any) {
      console.error('Send OTP failed:', error);

      const message =
        error?.message?.includes('UnknownHostException') ||
        error?.name === 'AuthRetryableFetchError'
          ? 'Network error. Please check your internet connection.'
          : error?.message ||
            'Could not send verification code. Please try again.';

      Alert.alert('Unable to Send OTP', message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // VERIFY OTP
  // ---------------------------------------------------------

  const handleVerifyOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otpToken.trim();

    if (!cleanEmail) {
      Alert.alert(
        'Missing Email',
        'Please enter your email address.'
      );
      return;
    }

    if (cleanOtp.length !== 6) {
      Alert.alert(
        'Invalid OTP',
        'Please enter a valid 6-digit verification code.'
      );
      return;
    }

    if (loading) return;

    setLoading(true);

    try {
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
          'Unable to verify customer account.'
        );
      }

      await verifyCustomerAccount(data.user.id);

      router.replace('/');
    } catch (error: any) {
      console.error('OTP verification failed:', error);

      const message =
        error?.message?.includes('UnknownHostException') ||
        error?.name === 'AuthRetryableFetchError'
          ? 'Network error. Please check your internet connection.'
          : error?.message ||
            'Invalid or expired verification code.';

      Alert.alert('Verification Failed', message);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // SWITCH LOGIN METHOD
  // ---------------------------------------------------------

  const switchLoginMethod = (method: LoginMethod) => {
    if (loading) return;

    setLoginMethod(method);

    setOtpSent(false);
    setOtpToken('');
    setResendTimer(60);
    setResendAvailable(false);

    if (method === 'password') {
      setPassword('');
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
            {/* HERO */}

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
                <Text style={styles.logoSymbol}>
                  R
                </Text>
              </Animated.View>

              <Text style={styles.welcomeHeading}>
                Welcome Back
              </Text>

              <Text style={styles.welcomeSubtitle}>
                Login to your RivoCity customer account.
              </Text>
            </View>

            {/* FORM CARD */}

            <View style={styles.formCard}>
              {/* LOGIN METHOD SWITCH */}

              <View style={styles.methodContainer}>
                <TouchableOpacity
                  style={[
                    styles.methodButton,
                    loginMethod === 'password' &&
                      styles.methodButtonActive,
                  ]}
                  onPress={() =>
                    switchLoginMethod('password')
                  }
                  disabled={loading}
                >
                  <Text
                    style={[
                      styles.methodText,
                      loginMethod === 'password' &&
                        styles.methodTextActive,
                    ]}
                  >
                    Password
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.methodButton,
                    loginMethod === 'otp' &&
                      styles.methodButtonActive,
                  ]}
                  onPress={() =>
                    switchLoginMethod('otp')
                  }
                  disabled={loading}
                >
                  <Text
                    style={[
                      styles.methodText,
                      loginMethod === 'otp' &&
                        styles.methodTextActive,
                    ]}
                  >
                    Login with OTP
                  </Text>
                </TouchableOpacity>
              </View>

              {/* EMAIL */}

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

              {/* PASSWORD LOGIN */}

              {loginMethod === 'password' && (
                <>
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
                      secureTextEntry={!showPassword}
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

                  <TouchableOpacity
                    style={styles.forgotPasswordButton}
                    onPress={() => {
                      Alert.alert(
                        'Reset Password',
                        'Password reset is not configured yet. Use Login with OTP to access your account.'
                      );
                    }}
                    disabled={loading}
                  >
                    <Text
                      style={
                        styles.forgotPasswordText
                      }
                    >
                      Forgot Password?
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.loginSubmitButton}
                    onPress={handlePasswordLogin}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator
                        color="#FFFFFF"
                      />
                    ) : (
                      <Text
                        style={
                          styles.loginButtonText
                        }
                      >
                        Login
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              {/* OTP LOGIN */}

              {loginMethod === 'otp' && (
                <>
                  {otpSent && (
                    <>
                      <Text
                        style={styles.inputLabel}
                      >
                        6-Digit OTP Code
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
                          onChangeText={
                            setOtpToken
                          }
                          keyboardType="number-pad"
                          maxLength={6}
                          autoFocus
                          onFocus={() =>
                            setOtpFocused(
                              true
                            )
                          }
                          onBlur={() =>
                            setOtpFocused(
                              false
                            )
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
                        <ActivityIndicator
                          color="#FFFFFF"
                        />
                      ) : (
                        <Text
                          style={
                            styles.loginButtonText
                          }
                        >
                          Send Login OTP ✉️
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
                        <ActivityIndicator
                          color="#FFFFFF"
                        />
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
                    <>
                      <TouchableOpacity
                        style={
                          styles.resendButton
                        }
                        onPress={handleSendOtp}
                        disabled={
                          !canResend || loading
                        }
                        activeOpacity={0.7}
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
                            ? 'Resend Verification Code'
                            : `Resend Code in ${resendTimer}s`}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={
                          styles.changeEmailButton
                        }
                        onPress={() => {
                          setOtpSent(false);
                          setOtpToken('');
                          setResendTimer(60);
                          setResendAvailable(
                            false
                          );
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
                    </>
                  )}
                </>
              )}

              {/* REGISTER */}

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
                  Create New Account
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  },

  welcomeSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },

  formCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EAEFF3',
    elevation: 2,
  },

  methodContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 22,
  },

  methodButton: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },

  methodButtonActive: {
    backgroundColor: '#FFFFFF',
    elevation: 2,
  },

  methodText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },

  methodTextActive: {
    color: '#16A34A',
    fontWeight: '900',
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
    fontWeight: '900',
  },

  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginTop: -6,
    marginBottom: 4,
  },

  forgotPasswordText: {
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
    elevation: 4,
  },

  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  resendButton: {
    marginTop: 12,
    alignItems: 'center',
  },

  resendText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#22CC71',
  },

  changeEmailButton: {
    marginTop: 8,
    alignItems: 'center',
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
});