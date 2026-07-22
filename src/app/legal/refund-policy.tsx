// src/app/legal/refund-policy.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function RefundPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#0D0D0D" />
        </Pressable>
        <Text style={styles.headerTitle}>Refund & Cancellation</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>Effective Date: July 2026</Text>

        <Text style={styles.paragraph}>
          Rivo.City strives to deliver flawless, high-speed service on every order. This policy outlines customer rights regarding order cancellations, returns, and refund processing.
        </Text>

        <Text style={styles.sectionHeading}>1. Order Cancellation Policy</Text>
        <Text style={styles.paragraph}>
          • Allowed Cancellations: You may cancel an order free of charge while its status is marked as 'Pending' or 'Accepted', provided the store has not begun packing or preparing items.{'\n'}
          • Non-Refundable Cancellations: Once an order moves to 'Preparing', 'Packed', or 'Out For Delivery', cancellations cannot be processed through the app because items have been allocated and prepared.
        </Text>

        <Text style={styles.sectionHeading}>2. Refund Eligibility Criteria</Text>
        <Text style={styles.paragraph}>
          Refunds or replacements will be granted in the following scenarios:{'\n'}
          1. Missing Items: Specific ordered items were omitted from the delivered parcel.{'\n'}
          2. Damaged Goods: Delivered items arrived broken, unsealed, or compromised.{'\n'}
          3. Incorrect Products: Delivered products differed significantly from the items purchased.{'\n'}
          4. Non-Delivery: Order was marked delivered but never handed over to the customer.
        </Text>

        <Text style={styles.sectionHeading}>3. Verification & Reporting Window</Text>
        <Text style={styles.paragraph}>
          All issues regarding missing, incorrect, or damaged items must be reported within 2 hours of delivery receipt via the 'Report Issue' or 'Contact Support Desk' feature. Photographic evidence may be required for verification.
        </Text>

        <Text style={styles.sectionHeading}>4. Refund Timelines & Method</Text>
        <Text style={styles.paragraph}>
          Approved refunds are processed back to the original payment source or applied directly as Rivo credit. Bank and card refunds typically reflect within 3 to 7 business working days depending on your financial institution.
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