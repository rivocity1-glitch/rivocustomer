// src/app/about.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function AboutScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#0D0D0D" />
        </Pressable>
        <Text style={styles.headerTitle}>About Rivo</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>RIVO</Text>
          </View>
          <Text style={styles.brandTitle}>Rivo.City</Text>
          <Text style={styles.tagline}>"One City. Infinite Possibilities."</Text>
          <View style={styles.versionChip}>
            <Text style={styles.versionText}>v1.0.0 (Production)</Text>
          </View>
        </View>

        <Text style={styles.paragraph}>
          Rivo.City is an instant hyperlocal marketplace delivering products from nearby stores to customer doorages within minutes.
        </Text>

        <Text style={styles.sectionHeading}>Our Vision</Text>
        <Text style={styles.paragraph}>
          We empower independent local merchants with digital inventory tools while providing urban consumers with transparent, high-speed delivery.
        </Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Rivo Technologies</Text>
          <Text style={styles.infoSub}>Built for high-performance commerce</Text>
        </View>

        <Text style={styles.copyrightText}>© 2026 Rivo.City. All rights reserved.</Text>
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
  content: { padding: 20, paddingBottom: 40, alignItems: 'center' },
  brandContainer: { alignItems: 'center', marginTop: 10, marginBottom: 28 },
  logoBadge: {
    backgroundColor: '#0D0D0D',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  logoText: { fontSize: 26, fontWeight: '900', color: '#22CC71', letterSpacing: 3 },
  brandTitle: { fontSize: 22, fontWeight: '900', color: '#0D0D0D', letterSpacing: -0.5 },
  tagline: { fontSize: 13, fontWeight: '700', color: '#22CC71', marginTop: 4, fontStyle: 'italic' },
  versionChip: {
    backgroundColor: '#F7F8FA',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#EAEFF3',
  },
  versionText: { fontSize: 11, color: '#64748B', fontWeight: '700' },
  sectionHeading: { fontSize: 16, fontWeight: '800', color: '#0D0D0D', marginTop: 20, marginBottom: 6, alignSelf: 'flex-start' },
  paragraph: { fontSize: 14, color: '#334155', lineHeight: 22, fontWeight: '400', alignSelf: 'flex-start' },
  infoCard: {
    width: '100%',
    backgroundColor: '#F7F8FA',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAEFF3',
    marginTop: 28,
    alignItems: 'center',
  },
  infoTitle: { fontSize: 14, fontWeight: '800', color: '#0D0D0D' },
  infoSub: { fontSize: 12, color: '#64748B', marginTop: 2, fontWeight: '500' },
  copyrightText: { fontSize: 12, color: '#94A3B8', marginTop: 32, fontWeight: '600' },
});