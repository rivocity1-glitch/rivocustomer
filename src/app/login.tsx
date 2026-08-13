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

export default function LoginScreen() {
  const router = useRouter();

  // ---------------------------------------------------------
  // STATE
  // ---------------------------------------------------------
  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [loading, setLoading] = useState(false);

  const [emailFocused, setEmailFocused] = useState(false);
  const [otpFocused, setOtpFocused] = useState(false);

  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setResendAvailable] = useState(false);

  // ---------------------------------------------------------
  // ANIMATIONS
  // ---------------------------------------------------------
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function checkExistingSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
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
        await supabase.auth.signOut();
      }
    }

    checkExistingSession();

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 6, duration: 1500, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // ---------------------------------------------------------
  // OTP TIMER
  // ---------------------------------------------------------
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
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [otpSent, resendTimer]);

  // ---------------------------------------------------------
  // SEND OTP
  // ---------------------------------------------------------
  const handleSendOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      Alert.alert('Missing Email', 'Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (loading) return;
    setLoading(true);

    try {
      // 1. Check if email exists in customers database
      const { data: registeredEmail, error: customerLookupError } =
        await supabase.rpc('get_customer_auth_email_by_email', {
          p_email: cleanEmail,
        });

      if (customerLookupError) {
        if (
          customerLookupError.message?.includes('FetchError') ||
          customerLookupError.message?.includes('UnknownHostException') ||
          customerLookupError.name === 'AuthRetryableFetchError'
        ) {
          throw new Error('Network error. Unable to reach server. Check internet connection.');
        }
        throw new Error('Unable to verify this email address. Please try again.');
      }

      // 2. If NOT registered, direct to Registration Page
      if (!registeredEmail) {
        Alert.alert(
          'Account Not Found',
          'No Rivo customer account is registered with this email address. Please register first.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Register Now',
              onPress: () => router.push('/register'),
            },
          ]
        );
        return;
      }

      // 3. Registered -> Send OTP
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: undefined,
        },
      });

      if (otpError) throw otpError;

      setOtpSent(true);
      setOtpToken('');
      setResendTimer(60);
      setResendAvailable(false);

      Alert.alert('OTP Sent ✉️', `A 6-digit code has been sent to ${cleanEmail}.`);
    } catch (error: any) {
      const message =
        error?.message?.includes('UnknownHostException') ||
        error?.name === 'AuthRetryableFetchError'
          ? 'Network error. Please check your internet connection.'
          : error?.message || 'Could not send verification code. Please try again.';

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
      Alert.alert('Missing Email', 'Please enter your email address.');
      return;
    }

    if (cleanOtp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter a valid 6-digit verification code.');
      return;
    }

    if (loading) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanOtp,
        type: 'email',
      });

      if (error) throw error;
      if (!data?.user) throw new Error('Unable to verify customer account.');

      // Confirm customer record exists
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('auth_user_id', data.user.id)
        .maybeSingle();

      if (!existingCustomer) {
        await supabase.auth.signOut();
        throw new Error('This account is not registered as a Rivo customer.');
      }

      router.replace('/');
    } catch (error: any) {
      const message =
        error?.message?.includes('UnknownHostException') ||
        error?.name === 'AuthRetryableFetchError'
          ? 'Network error. Please check your internet connection.'
          : error?.message || 'Invalid or expired verification code.';

      Alert.alert('Verification Failed', message);
    } finally {
      setLoading(false);
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
          <Animated.View
            style={[
              styles.innerAnimated,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* HERO */}
            <View style={styles.heroSection}>
              <Animated.View
                style={[
                  styles.logoCircle,
                  { transform: [{ scale: logoScale }, { translateY: floatAnim }] },
                ]}
              >
                <Text style={styles.logoSymbol}>R</Text>
              </Animated.View>

              <Text style={styles.welcomeHeading}>Welcome Back</Text>
              <Text style={styles.welcomeSubtitle}>
                Enter your email address to receive a login OTP code.
              </Text>
            </View>

            {/* FORM CARD */}
            <View style={styles.formCard}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={[styles.inputContainer, emailFocused && styles.inputFocused]}>
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
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                />
              </View>

              {otpSent && (
                <>
                  <Text style={styles.inputLabel}>6-Digit OTP Code</Text>
                  <View style={[styles.inputContainer, otpFocused && styles.inputFocused]}>
                    <TextInput
                      style={[styles.inputField, { letterSpacing: 4, fontWeight: '800' }]}
                      placeholder="• • • • • •"
                      placeholderTextColor="#CBD5E1"
                      value={otpToken}
                      onChangeText={setOtpToken}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                      onFocus={() => setOtpFocused(true)}
                      onBlur={() => setOtpFocused(false)}
                    />
                  </View>
                </>
              )}

              {!otpSent ? (
                <TouchableOpacity
                  style={styles.loginSubmitButton}
                  onPress={handleSendOtp}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.loginButtonText}>Send Login OTP ✉️</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.loginSubmitButton}
                  onPress={handleVerifyOtp}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.loginButtonText}>Verify & Login</Text>
                  )}
                </TouchableOpacity>
              )}

              {otpSent && (
                <>
                  <TouchableOpacity
                    style={styles.resendButton}
                    onPress={handleSendOtp}
                    disabled={!canResend || loading}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.resendText, !canResend && { color: '#94A3B8' }]}>
                      {canResend ? 'Resend Verification Code' : `Resend Code in ${resendTimer}s`}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.changeEmailButton}
                    onPress={() => {
                      setOtpSent(false);
                      setOtpToken('');
                      setResendTimer(60);
                    }}
                    disabled={loading}
                  >
                    <Text style={styles.changeEmailText}>Change Email Address</Text>
                  </TouchableOpacity>
                </>
              )}

              <TouchableOpacity
                style={styles.registerNavigateButton}
                onPress={() => router.push('/register')}
                disabled={loading}
                activeOpacity={0.75}
              >
                <Text style={styles.registerButtonText}>Create New Account</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  scrollContainer: { padding: 20, justifyContent: 'center', alignItems: 'center', flexGrow: 1 },
  innerAnimated: { width: '100%', alignItems: 'center' },
  heroSection: { alignItems: 'center', marginBottom: 24 },
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
  logoSymbol: { color: '#FFFFFF', fontSize: 30, fontWeight: '900' },
  welcomeHeading: { fontSize: 26, fontWeight: '900', color: '#0D0D0D' },
  welcomeSubtitle: { fontSize: 13, color: '#64748B', fontWeight: '600', marginTop: 4, textAlign: 'center' },
  formCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#EAEFF3',
    elevation: 2,
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
  inputFocused: { borderColor: '#22CC71', backgroundColor: '#FFFFFF' },
  inputField: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: '600', color: '#0D0D0D' },
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
  loginButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  resendButton: { marginTop: 12, alignItems: 'center' },
  resendText: { fontSize: 13, fontWeight: '800', color: '#22CC71' },
  changeEmailButton: { marginTop: 8, alignItems: 'center' },
  changeEmailText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
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
  registerButtonText: { color: '#22CC71', fontSize: 15, fontWeight: '800' },
});