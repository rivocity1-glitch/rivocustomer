// src/app/legal/liability.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function LiabilityScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#0D0D0D" />
        </Pressable>
        <Text style={styles.headerTitle}>Limitation of Liability</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>Effective Date: July 2026</Text>

        <Text style={styles.paragraph}>
          This Limitation of Liability agreement defines the extent of financial and legal liability held by Rivo.City ("Rivo") in connection with your use of our Platform and delivery services.
        </Text>

        <Text style={styles.sectionHeading}>1. Exclusion of Consequential Damages</Text>
        <Text style={styles.paragraph}>
          To the maximum extent permitted by applicable law, Rivo, its parent entity, officers, directors, employees, or agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages—including lost profits, loss of data, business disruption, or personal injury—arising out of or related to your use of the Platform.
        </Text>

        <Text style={styles.sectionHeading}>2. Merchant & Delivery Partner Liability</Text>
        <Text style={styles.paragraph}>
          Rivo connects users with independent merchants and third-party delivery partners. Rivo explicitly disclaims liability for:{'\n'}
          • Quality, safety, ingredients, freshness, or packaging defects of items prepared by independent merchants.{'\n'}
          • Delays, traffic incidents, or conduct caused by independent delivery riders during fulfillment.
        </Text>

        <Text style={styles.sectionHeading}>3. Financial Cap on Liability</Text>
        <Text style={styles.paragraph}>
          Under no circumstances shall Rivo's total aggregate financial liability to you for all claims, damages, losses, or causes of action exceed the total amount actually paid by you for the specific order giving rise to the claim.
        </Text>

        <Text style={styles.sectionHeading}>4. Force Majeure</Text>
        <Text style={styles.paragraph}>
          Rivo shall not be held responsible or liable for failure or delay in performance caused by circumstances beyond its reasonable control, including extreme weather, natural disasters, network failures, acts of government, civil unrest, or traffic blockades.
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