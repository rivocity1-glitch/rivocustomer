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

  const [email, setEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [otpFocused, setOtpFocused] = useState(false);

  // Timer State
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setResendAvailable] = useState(false);

  // Animations Setup
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function checkExistingSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await ensureCustomerRecordExists(session.user);
        router.replace('/');
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
  }, []);

  // Timer logic for OTP resend
  useEffect(() => {
    if (otpSent && resendTimer > 0) {
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
  }, [otpSent, resendTimer]);

  // Ensure customer profile & address records exist
  const ensureCustomerRecordExists = async (user: any) => {
    try {
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (!existingCustomer) {
        const fullCustomerName = user.user_metadata?.full_name || 'Rivo Customer';
        const userEmail = user.email || '';
        const userPhone = user.phone || '';

        const { data: newCustomer, error: custError } = await supabase
          .from('customers')
          .insert([
            {
              auth_user_id: user.id,
              customer_name: fullCustomerName,
              email: userEmail,
              phone: userPhone,
            },
          ])
          .select()
          .single();

        if (!custError && newCustomer) {
          await supabase
            .from('customer_addresses')
            .insert([
              {
                customer_id: newCustomer.id,
                address_line1: '',
                address_line2: '',
                city: '',
                state: '',
                pin_code: '',
                landmark: '',
                address_type: 'home',
                is_default: true,
                latitude: null,
                longitude: null,
              },
            ]);
        }
      }
    } catch (e) {
      console.error('Error auto-provisioning customer profile:', e);
    }
  };

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

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
  email: cleanEmail,
  options: {
    shouldCreateUser: true,
    emailRedirectTo: undefined,
  },
});

      if (error) throw error;

      setOtpSent(true);
      setResendTimer(60);
      setResendAvailable(false);
      Alert.alert('OTP Sent ✉️', 'A 6-digit verification code has been dispatched to your email.');
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Could not send verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otpToken.trim();

    if (cleanOtp.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter a valid 6-digit verification code.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanOtp,
        type: 'email',
      });

      if (error) throw error;

      if (data?.user) {
        await ensureCustomerRecordExists(data.user);
        router.replace('/');
      }
    } catch (error: any) {
      Alert.alert('Verification Failed', error?.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.innerAnimated, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            
            {/* Top Hero Layout */}
            <View style={styles.heroSection}>
              <Animated.View style={[styles.logoCircle, { transform: [{ scale: logoScale }, { translateY: floatAnim }] }]}>
                <Text style={styles.logoSymbol}>R</Text>
              </Animated.View>
              <Text style={styles.welcomeHeading}>Welcome Back</Text>
              <Text style={styles.welcomeSubtitle}>Passwordless instant email sign-in.</Text>
            </View>

            {/* Forms Card */}
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

              {/* OTP Field revealed once code is sent */}
              {otpSent && (
                <>
                  <Text style={styles.inputLabel}>6-Digit Verification Code</Text>
                  <View style={[styles.inputContainer, otpFocused && styles.inputFocused]}>
                    <TextInput
                      style={[styles.inputField, { letterSpacing: 4, fontWeight: '800' }]}
                      placeholder="• • • • • •"
                      placeholderTextColor="#CBD5E1"
                      value={otpToken}
                      onChangeText={setOtpToken}
                      keyboardType="number-pad"
                      maxLength={6}
                      onFocus={() => setOtpFocused(true)}
                      onBlur={() => setOtpFocused(false)}
                    />
                  </View>
                </>
              )}

              {/* Primary Action Button */}
              {!otpSent ? (
                <TouchableOpacity
                  style={styles.loginSubmitButton}
                  onPress={handleSendOtp}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.loginButtonText}>Send OTP ✉️</Text>}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.loginSubmitButton}
                  onPress={handleVerifyOtp}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.loginButtonText}>Verify & Login</Text>}
                </TouchableOpacity>
              )}

              {/* Resend Code Link */}
              {otpSent && (
                <TouchableOpacity
                  style={{ marginTop: 12, alignItems: 'center' }}
                  onPress={handleSendOtp}
                  disabled={!canResend || loading}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.resendText, !canResend && { color: '#94A3B8' }]}>
                    {canResend ? 'Resend Verification Code' : `Resend Code in ${resendTimer}s`}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Toggle Back to Email Option */}
              {otpSent && (
                <TouchableOpacity
                  style={{ marginTop: 8, alignItems: 'center' }}
                  onPress={() => {
                    setOtpSent(false);
                    setOtpToken('');
                  }}
                  disabled={loading}
                >
                  <Text style={styles.changeEmailText}>Change Email Address</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.registerNavigateButton}
                onPress={() => router.push('/register')}
                disabled={loading}
                activeOpacity={0.75}
              >
                <Text style={styles.registerButtonText}>Create Account</Text>
              </TouchableOpacity>
            </View>

            {/* Compliant Subtext Footer */}
            <View style={styles.footerContainer}>
              <Text style={styles.footerText}>
                By logging in, you accept Rivo's standard dynamic{' '}
                <Text style={styles.footerLink}>Terms & Conditions</Text> and{' '}
                <Text style={styles.footerLink}>Privacy Policy</Text>.
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
    shadowOffset: { width: 0, height: 6 },
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
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.02,
    shadowRadius: 12,
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
  loginSubmitButton: {
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
    elevation: 4,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
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
    marginTop: 14,
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