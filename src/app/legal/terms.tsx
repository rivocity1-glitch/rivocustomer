// src/app/legal/terms.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const sections = [
  ['1. About These Terms', 'These terms govern use of the RivoCity website, customer application, vendor portal, rider application and related services. By registering, browsing or placing an order, you agree. RivoCity is currently a platform/brand and is not represented as a separately incorporated company.'],
  ['2. Service Area and Eligibility', 'The Platform is currently being operated for Baramati, Maharashtra, India. Availability depends on your location and may change. You must provide accurate information and be legally capable of entering into the relevant transaction.'],
  ['3. Accounts and Security', 'Provide accurate account details, keep them updated and protect your login credentials. You are responsible for activity through your account. Contact support promptly if you suspect unauthorised access.'],
  ['4. Platform Role', 'RivoCity provides a technology platform to discover and order from participating local businesses and, where available, arrange delivery through delivery partners. Vendors are responsible for products they list and sell. RivoCity does not manufacture or own vendor products.'],
  ['5. Orders, Availability and Cancellation', 'Orders are requests to purchase from a vendor and are subject to vendor acceptance, stock availability and serviceability. Delivery times are estimates. Cancellation, returns and refunds follow the applicable policy displayed on the Platform and applicable law.'],
  ['6. Prices, Fees and Payments', 'Vendors determine product prices. Applicable delivery charges, platform fees, taxes and other charges are shown before confirmation. Payment methods vary by order and are displayed at checkout. Cash on Delivery, where enabled, must be paid as instructed.'],
  ['7. Delivery OTP and Receipt', 'Where a delivery OTP is used, share it only with the assigned delivery partner after physically receiving your order. Do not share the OTP in advance. You may still report a genuine order issue through support.'],
  ['8. Customer Responsibilities', 'Provide a correct delivery address and reachable contact details, remain reasonably available to receive the order, treat vendors and delivery partners respectfully, and report order issues accurately and promptly.'],
  ['9. Prohibited Use', 'Fraudulent orders or payments, false claims, harassment, abuse, unauthorised access, security circumvention, spam and attempts to disrupt or misuse the Platform are prohibited.'],
  ['10. Suspension', 'Access may be restricted or suspended where reasonably necessary for suspected fraud, safety, legal compliance, inaccurate account information or repeated violations. Outstanding matters are handled subject to verification and applicable law.'],
  ['11. Privacy', 'Personal information is handled under the applicable Privacy Policy and law. Use information received through the Platform only for legitimate purposes and protect it from unauthorised access or disclosure.'],
  ['12. Availability and Liability', 'The Platform is provided subject to availability. We do not guarantee uninterrupted access or a particular delivery time. Nothing in these terms limits rights or liability that cannot lawfully be limited.'],
  ['13. Changes', 'We may update these terms as operations or legal requirements change. The effective date will be revised when updates are published. Stop using the Platform if you do not agree to revised terms.'],
  ['14. Governing Law and Contact', 'These terms are governed by the laws of India. Subject to mandatory law and applicable jurisdiction rules, competent courts in Maharashtra will have jurisdiction. Contact support@rivocity.com.'],
];

export default function TermsScreen() {
  const router = useRouter();
  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} style={styles.backButton}><Ionicons name="arrow-back" size={20} color="#0D0D0D" /></Pressable>
      <Text style={styles.headerTitle}>Terms & Conditions</Text><View style={{ width: 36 }} />
    </View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.lastUpdated}>Last updated: 30 October 2026</Text>
      {sections.map(([title, body]) => <View key={title} style={styles.section}><Text style={styles.sectionHeading}>{title}</Text><Text style={styles.paragraph}>{body}</Text></View>)}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EAEFF3' },
  backButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#EAEFF3' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0D0D0D' },
  content: { padding: 20, paddingBottom: 40 },
  lastUpdated: { fontSize: 12, color: '#64748B', fontWeight: '600', marginBottom: 8 },
  section: { marginTop: 18 },
  sectionHeading: { fontSize: 16, fontWeight: '800', color: '#0D0D0D', marginBottom: 6 },
  paragraph: { fontSize: 14, color: '#334155', lineHeight: 22, fontWeight: '400' },
});
