// src/app/legal/privacy.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#0D0D0D" />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>Effective Date: July 2026</Text>

        <Text style={styles.paragraph}>
          Rivo.City is committed to maintaining the confidentiality, integrity, and security of your personal data. This Privacy Policy details how we collect, use, process, and protect your information when using the Rivo Platform.
        </Text>

        <Text style={styles.sectionHeading}>1. Information We Collect</Text>
        <Text style={styles.paragraph}>
          • Personal Information: Full name, phone number, email address, and saved delivery addresses.{'\n'}
          • Transactional Details: Order items, payment status, subtotals, platform fees, and delivery history.{'\n'}
          • Location Data: Precise geolocation data captured while using active tracking to match you with nearby merchants and enable real-time rider delivery routing.{'\n'}
          • Device Information: Device model, operating system, unique hardware identifiers, and app log diagnostics.
        </Text>

        <Text style={styles.sectionHeading}>2. How We Use Your Information</Text>
        <Text style={styles.paragraph}>
          Your information is utilized strictly to:{'\n'}
          1. Process, fulfill, and track your instant delivery orders.{'\n'}
          2. Authenticate user access via secure OTP verification.{'\n'}
          3. Facilitate communication between customers, store owners, and assigned delivery partners.{'\n'}
          4. Send transactional notifications and crucial order status alerts.{'\n'}
          5. Prevent fraudulent transactions and platform abuse.
        </Text>

        <Text style={styles.sectionHeading}>3. Information Sharing & Disclosure</Text>
        <Text style={styles.paragraph}>
          We share necessary delivery details (such as address, phone number, and delivery code) exclusively with verified delivery partners and merchants handling your specific order. We do not sell or lease your personal information to third-party advertisers.
        </Text>

        <Text style={styles.sectionHeading}>4. Data Protection & Security</Text>
        <Text style={styles.paragraph}>
          Rivo employs enterprise-grade database encryption, Row-Level Security (RLS) policies, and HTTPS encryption across all API transactions. While we maintain rigorous safeguards, no electronic transmission can be guaranteed to be 100% secure.
        </Text>

        <Text style={styles.sectionHeading}>5. Your Rights</Text>
        <Text style={styles.paragraph}>
          You have the right to inspect, update, or request the erasure of your personal data stored on our servers. You may update your account details directly through the Profile screen or contact support for privacy requests.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEFF3',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EAEFF3',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0D0D0D' },
  content: { padding: 20, paddingBottom: 40 },
  lastUpdated: { fontSize: 12, color: '#64748B', fontWeight: '600', marginBottom: 16 },
  sectionHeading: { fontSize: 16, fontWeight: '800', color: '#0D0D0D', marginTop: 20, marginBottom: 6 },
  paragraph: { fontSize: 14, color: '#334155', lineHeight: 22, fontWeight: '400' },
});