// src/app/legal/terms.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function TermsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#0D0D0D" />
        </Pressable>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>Effective Date: July 2026</Text>

        <Text style={styles.paragraph}>
          Welcome to Rivo.City ("Rivo", "we", "us", or "our"). These Terms & Conditions govern your access to and use of the Rivo mobile application, website, and related services (collectively, the "Platform"). By creating an account, browsing, or placing an order through Rivo, you agree to comply with and be bound by these terms.
        </Text>

        <Text style={styles.sectionHeading}>1. Platform Role & Marketplace Model</Text>
        <Text style={styles.paragraph}>
          Rivo operates exclusively as an instant hyperlocal delivery marketplace connecting registered customers ("Users"), independent third-party merchant vendors ("Stores"), and delivery partners ("Riders"). Rivo does not manufacture, prepare, package, or directly sell retail items unless explicitly stated. Vendors operate independently and are solely responsible for product quality, freshness, and regulatory compliance.
        </Text>

        <Text style={styles.sectionHeading}>2. Account Registration & Security</Text>
        <Text style={styles.paragraph}>
          To utilize Rivo, you must register an account providing accurate contact details. You are responsible for maintaining the confidentiality of your credentials. You must immediately notify Rivo of any unauthorized access to your account.
        </Text>

        <Text style={styles.sectionHeading}>3. Orders, Pricing & Charges</Text>
        <Text style={styles.paragraph}>
          All order prices—including the item subtotal, delivery logistics fee, and platform fee—are clearly displayed at checkout before confirmation. Prices are stored and verified directly against the database upon order creation. Rivo reserves the right to cancel orders in the event of technical errors, inventory unavailability, or pricing miscalculations.
        </Text>

        <Text style={styles.sectionHeading}>4. Delivery OTP & Order Fulfillment</Text>
        <Text style={styles.paragraph}>
          Each order generates a unique 4-digit Delivery One-Time Password (OTP). You must share this OTP with the rider ONLY after physically receiving and inspecting your package. Sharing the OTP serves as your confirmation that the delivery has been successfully fulfilled.
        </Text>

        <Text style={styles.sectionHeading}>5. User Conduct & Abuse</Text>
        <Text style={styles.paragraph}>
          You agree not to misuse the Platform, engage in fraudulent transactions, harass delivery partners or store employees, or breach applicable local laws. Accounts found engaging in abusive or fraudulent practices will be suspended or permanently terminated.
        </Text>

        <Text style={styles.sectionHeading}>6. Governance & Modifications</Text>
        <Text style={styles.paragraph}>
          Rivo reserves the right to amend these terms at any time. Continued usage of the Platform following updates constitutes your acceptance of the revised Terms & Conditions.
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