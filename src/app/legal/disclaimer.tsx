// src/app/legal/disclaimer.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function DisclaimerScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#0D0D0D" />
        </Pressable>
        <Text style={styles.headerTitle}>Disclaimer</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.lastUpdated}>Effective Date: July 2026</Text>

        <Text style={styles.paragraph}>
          The information, product listings, pricing, and services provided on the Rivo mobile application and Rivo.City platform are provided strictly on an "as is" and "as available" basis without express or implied warranties.
        </Text>

        <Text style={styles.sectionHeading}>1. Product Information & Packaging Disclaimer</Text>
        <Text style={styles.paragraph}>
          While Rivo makes every effort to ensure product details, descriptions, and images uploaded by stores are accurate, merchants may alter packaging, ingredients, or specifications without prior notice. Customers should always inspect labels and warnings before consuming products.
        </Text>

        <Text style={styles.sectionHeading}>2. Food Safety & Allergen Disclaimer</Text>
        <Text style={styles.paragraph}>
          Rivo does not prepare or handle fresh food or retail items directly. Customers with severe food allergies, specific dietary restrictions, or health conditions must contact the merchant store directly to verify preparation environments prior to ordering.
        </Text>

        <Text style={styles.sectionHeading}>3. Estimated Delivery Times</Text>
        <Text style={styles.paragraph}>
          All delivery duration estimates (e.g., "Within 10-15 mins") displayed on the Platform are dynamic estimates based on real-time distance and rider availability. Actual arrival times may vary depending on weather, store prep speed, and local traffic conditions.
        </Text>

        <Text style={styles.sectionHeading}>4. Technical Availability</Text>
        <Text style={styles.paragraph}>
          Rivo does not guarantee uninterrupted, error-free operation of the app. Maintenance, server upgrades, or external cellular connectivity issues may temporarily impact service availability.
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