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

export default function RegisterScreen() {
  const router = useRouter();
  
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [addressType, setAddressType] = useState('home');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pinCode, setPinCode] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedField] = useState<string | null>(null);
  const [termsAgreed, setTermsAgreed] = useState(true);

  // Entrance Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleRegister = async () => {
    if (
      !customerName || 
      !email || 
      !phone || 
      !password || 
      !confirmPassword ||
      !addressLine1 ||
      !city ||
      !state ||
      !pinCode
    ) {
      Alert.alert('Error', 'All required fields must be filled.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
      });

      if (authError) throw authError;

      const user = authData?.user;

      if (user) {
        const { data: customerData, error: dbError } = await supabase
          .from('customers')
          .insert([
            {
              auth_user_id: user.id,
              customer_name: customerName.trim(),
              email: email.trim(),
              phone: phone.trim(),
            },
          ])
          .select()
          .single();

        if (dbError) throw dbError;

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
              },
            ]);

          if (addressError) throw addressError;
        }

        Alert.alert(
          'Registration Successful',
          'Your account has been created successfully!',
          [
            {
              text: 'OK',
              onPress: () => {
                router.replace('/login');
              },
            },
          ]
        );
      } else {
        throw new Error('Something went wrong during registration.');
      }
    } catch (error: any) {
      console.log('REGISTER ERROR:', error);
      Alert.alert(
        'Registration Failed',
        JSON.stringify(error, null, 2)
      );
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
                  placeholder="123-456-7890"
                  placeholderTextColor="#94A3B8"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <Text style={styles.fieldLabel}>Password *</Text>
              <View style={[styles.inputContainer, focusedInput === 'pass' && styles.inputFocused]}>
                <TextInput
                  style={styles.inputField}
                  placeholder="********"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  onFocus={() => setFocusedField('pass')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>

              <Text style={styles.fieldLabel}>Confirm Password *</Text>
              <View style={[styles.inputContainer, focusedInput === 'confirm' && styles.inputFocused]}>
                <TextInput
                  style={styles.inputField}
                  placeholder="********"
                  placeholderTextColor="#94A3B8"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  onFocus={() => setFocusedField('confirm')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>

            {/* Card 2: Address Information */}
            <View style={styles.formSectionCard}>
              <Text style={styles.cardHeaderHeading}>Delivery Address</Text>

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

              {/* UI Checkbox Placeholder Row */}
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

              {/* Action Submit Elements */}
              <TouchableOpacity
                style={[styles.submitButton, !termsAgreed && { backgroundColor: '#CBD5E1' }]}
                onPress={handleRegister}
                disabled={loading || !termsAgreed}
                activeOpacity={0.85}
              >
                {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>Register</Text>}
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
    marginBottom: 20,
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
    marginBottom: 16,
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
});