// src/app/profile.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<{ name: string; email: string; phone: string } | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace('/login');
          return;
        }

        const { data: customer, error } = await supabase
          .from('customers')
          .select('customer_name, email, phone')
          .eq('auth_user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching customer data:', error.message);
        } else if (customer) {
          setUserData({
            name: customer.customer_name || 'N/A',
            email: customer.email || 'N/A',
            phone: customer.phone || 'N/A',
          });
        }
      } catch (error) {
        console.error('Unexpected error:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <View style={styles.centeredLoading}>
        <ActivityIndicator size="large" color="#22CC71" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Premium Header Block */}
      <View style={styles.gradientHeader}>
        <View style={styles.headerAccentCircleLeft} />
        <View style={styles.headerAccentCircleRight} />
        <View style={styles.navRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>
          <Text style={styles.headerTitle}>Account Profile</Text>
          <View style={{ width: 36 }} />
        </View>

        {userData && (
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarInner}>
              <Text style={styles.avatarText}>{getInitials(userData.name)}</Text>
            </View>
            <View style={styles.userMetaTextContainer}>
              <Text style={styles.userMetaName} numberOfLines={1}>
                {userData.name}
              </Text>
              <Text style={styles.userMetaSub} numberOfLines={1}>
                Rivo Premium Client
              </Text>
            </View>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {userData ? (
          <View style={styles.mainContainer}>
            {/* CUSTOMER INFORMATION CARD */}
            <Text style={styles.sectionTitle}>Personal Identification</Text>
            <View style={styles.premiumCard}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Customer Name</Text>
                <Text style={styles.infoValue}>{userData.name}</Text>
              </View>

              <View style={styles.cardSeparator} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email Address</Text>
                <Text style={styles.infoValue}>{userData.email}</Text>
              </View>

              <View style={styles.cardSeparator} />

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone Number</Text>
                <Text style={styles.infoValue}>{userData.phone}</Text>
              </View>
            </View>

            {/* QUICK ACTIONS SECTION */}
            <Text style={styles.sectionTitle}>Core Dashboard</Text>
            <View style={styles.premiumCard}>
              <Pressable onPress={() => router.push('/orders')} style={styles.menuRowItem}>
                <View style={styles.menuLeftBlock}>
                  <Ionicons name="clipboard-outline" size={20} color="#0D0D0D" />
                  <Text style={styles.menuItemText}>My Orders</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </Pressable>

              <View style={styles.cardSeparator} />

              <Pressable onPress={() => router.push('/addresses')} style={styles.menuRowItem}>
                <View style={styles.menuLeftBlock}>
                  <Ionicons name="location-outline" size={20} color="#0D0D0D" />
                  <Text style={styles.menuItemText}>My Addresses</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </Pressable>
            </View>

            {/* LEGAL & SUPPORT SECTION */}
            <Text style={styles.sectionTitle}>Legal & Support</Text>
            <View style={styles.premiumCard}>
              <Pressable onPress={() => router.push('/legal/terms' as any)} style={styles.menuRowItem}>
                <View style={styles.menuLeftBlock}>
                  <Ionicons name="document-text-outline" size={20} color="#0D0D0D" />
                  <Text style={styles.menuItemText}>Terms & Conditions</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </Pressable>

              <View style={styles.cardSeparator} />

              <Pressable onPress={() => router.push('/legal/privacy' as any)} style={styles.menuRowItem}>
                <View style={styles.menuLeftBlock}>
                  <Ionicons name="shield-checkmark-outline" size={20} color="#0D0D0D" />
                  <Text style={styles.menuItemText}>Privacy Policy</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </Pressable>

              <View style={styles.cardSeparator} />

              <Pressable onPress={() => router.push('/legal/liability' as any)} style={styles.menuRowItem}>
                <View style={styles.menuLeftBlock}>
                  <Ionicons name="information-circle-outline" size={20} color="#0D0D0D" />
                  <Text style={styles.menuItemText}>Limitation of Liability</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </Pressable>

              <View style={styles.cardSeparator} />

              <Pressable onPress={() => router.push('/legal/disclaimer' as any)} style={styles.menuRowItem}>
                <View style={styles.menuLeftBlock}>
                  <Ionicons name="help-circle-outline" size={20} color="#0D0D0D" />
                  <Text style={styles.menuItemText}>Disclaimer</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </Pressable>

              <View style={styles.cardSeparator} />

              <Pressable onPress={() => router.push('/legal/refund-policy' as any)} style={styles.menuRowItem}>
                <View style={styles.menuLeftBlock}>
                  <Ionicons name="document-text-outline" size={20} color="#0D0D0D" />
                  <Text style={styles.menuItemText}>Refund & Cancellation Policy</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </Pressable>

              <View style={styles.cardSeparator} />

              <Pressable onPress={() => router.push('/legal/contact' as any)} style={styles.menuRowItem}>
                <View style={styles.menuLeftBlock}>
                  <Ionicons name="mail-outline" size={20} color="#0D0D0D" />
                  <Text style={styles.menuItemText}>Contact Us</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </Pressable>

              <View style={styles.cardSeparator} />

              <Pressable onPress={() => router.push('/about' as any)} style={styles.menuRowItem}>
                <View style={styles.menuLeftBlock}>
                  <Ionicons name="information-circle-outline" size={20} color="#0D0D0D" />
                  <Text style={styles.menuItemText}>About Rivo</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTextText}>No customer profile found.</Text>
          </View>
        )}
      </ScrollView>

      {/* Logout Footer Pane */}
      <View style={styles.footerPanel}>
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutButton, pressed && styles.microInteractionState]}
        >
          <Ionicons name="log-out-outline" size={18} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.logoutButtonText}>Secure Logout</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centeredLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  gradientHeader: {
    backgroundColor: '#0D0D0D',
    paddingTop: 48,
    paddingBottom: 28,
    paddingHorizontal: 16,
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerAccentCircleLeft: {
    position: 'absolute',
    top: -40,
    left: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#22CC71',
    opacity: 0.15,
  },
  headerAccentCircleRight: {
    position: 'absolute',
    bottom: -60,
    right: -20,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#A8E63A',
    opacity: 0.1,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFFFFF15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  avatarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 4,
  },
  avatarInner: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: '#22CC71',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#22CC71',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  userMetaTextContainer: {
    flex: 1,
    gap: 2,
  },
  userMetaName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  userMetaSub: {
    fontSize: 12,
    color: '#A8E63A',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  mainContainer: {
    padding: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  premiumCard: {
    backgroundColor: '#F7F8FA',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#EAEFF3',
    shadowColor: '#0D0D0D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.01,
    shadowRadius: 8,
    elevation: 1,
  },
  infoRow: {
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    color: '#64748B',
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    color: '#0D0D0D',
    fontWeight: '700',
  },
  cardSeparator: {
    height: 1,
    backgroundColor: '#EAEFF3',
  },
  menuRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  menuLeftBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D0D0D',
  },
  footerPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingBottom: 24,
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#EF444412',
    borderWidth: 1,
    borderColor: '#EF444430',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '800',
  },
  errorContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTextText: {
    fontSize: 15,
    color: '#EF4444',
    fontWeight: '600',
    textAlign: 'center',
  },
  microInteractionState: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
});