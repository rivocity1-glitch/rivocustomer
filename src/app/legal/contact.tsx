// src/app/legal/contact.tsx
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { Alert, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

export default function ContactScreen() {
  const router = useRouter();
  const supportEmail = 'support@rivo.city';

  const handleCopyEmail = async () => {
    await Clipboard.setStringAsync(supportEmail);
    Alert.alert('Copied', 'Support email copied to clipboard.');
  };

  const handleOpenMailApp = async () => {
    const mailUrl = `mailto:${supportEmail}`;
    const canOpen = await Linking.canOpenURL(mailUrl);
    if (canOpen) {
      Linking.openURL(mailUrl);
    } else {
      Alert.alert('Notice', 'Could not open default mail client.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#0D0D0D" />
        </Pressable>
        <Text style={styles.headerTitle}>Contact Us</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subTitle}>We're here to help you 24/7</Text>
        <Text style={styles.paragraph}>
          Have a question about an order, merchant onboarding, delivery feedback, or platform support? Reach out directly through the options below.
        </Text>

        <View style={styles.card}>
          <View style={styles.contactRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="mail-outline" size={20} color="#22CC71" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>Customer Delight Desk</Text>
              <Text style={styles.contactValue}>{supportEmail}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.contactRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="business-outline" size={20} color="#22CC71" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.contactLabel}>Company & Brand</Text>
              <Text style={styles.contactValue}>Rivo.City </Text>
            </View>
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <Pressable style={styles.primaryButton} onPress={handleOpenMailApp}>
            <Ionicons name="mail" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryButtonText}>Open Default Mail App</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={handleCopyEmail}>
            <Ionicons name="copy-outline" size={18} color="#0D0D0D" style={{ marginRight: 8 }} />
            <Text style={styles.secondaryButtonText}>Copy Email Address</Text>
          </Pressable>
        </View>
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
  subTitle: { fontSize: 18, fontWeight: '900', color: '#0D0D0D', marginBottom: 6, letterSpacing: -0.3 },
  paragraph: { fontSize: 14, color: '#64748B', lineHeight: 22, marginBottom: 24, fontWeight: '400' },
  card: {
    backgroundColor: '#F7F8FA',
    borderRadius: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#EAEFF3',
    marginBottom: 24,
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#22CC7115',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactLabel: { fontSize: 11, color: '#64748B', fontWeight: '700', textTransform: 'uppercase' },
  contactValue: { fontSize: 15, color: '#0D0D0D', fontWeight: '800', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#EAEFF3' },
  actionsContainer: { gap: 12 },
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#22CC71',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  secondaryButton: {
    flexDirection: 'row',
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: '#EAEFF3',
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: { color: '#0D0D0D', fontSize: 15, fontWeight: '800' },
});