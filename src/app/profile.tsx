// src/app/profile.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
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

  const handleHelpSupport = async () => {
    const helpUrl = 'https://rivo-website.pages.dev/contact';

    try {
      const supported = await Linking.canOpenURL(helpUrl);

      if (supported) {
        await Linking.openURL(helpUrl);
      } else {
        Alert.alert(
          'Unable to Open Help',
          'Please visit the Rivo support page from your browser.'
        );
      }
    } catch (error) {
      console.error('Failed to open Rivo Help & Support:', error);
      Alert.alert(
        'Unable to Open Help',
        'Please try again later.'
      );
    }
  };

  const handleDeleteAccount = async () => {
    const deleteAccountUrl = 'https://rivocity.com/delete-account';

    try {
      const supported = await Linking.canOpenURL(deleteAccountUrl);

      if (supported) {
        await Linking.openURL(deleteAccountUrl);
      } else {
        Alert.alert(
          'Unable to Open',
          'Please visit the Rivo account deletion page from your browser.'
        );
      }
    } catch (error) {
      console.error('Failed to open account deletion page:', error);
      Alert.alert(
        'Unable to Open',
        'Please try again later.'
      );
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Log out?',
      "Are you sure you want to log out of your Rivo account?\n\nYou'll need to verify your email with a new OTP the next time you sign in.",
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const getInitials = (name: string) => {
    if (!name || name === 'N/A') return 'U';

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
      {/* Premium Dark Header */}
      <View style={styles.gradientHeader}>
        <View style={styles.headerAccentCircleLeft} />
        <View style={styles.headerAccentCircleRight} />

        <View style={styles.navRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressOpacity,
            ]}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </Pressable>

          <Text style={styles.headerTitle}>Profile</Text>

          <View style={{ width: 40 }} />
        </View>

        {userData && (
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarInner}>
              <Text style={styles.avatarText}>
                {getInitials(userData.name)}
              </Text>
            </View>

            <View style={styles.userMetaTextContainer}>
              <Text style={styles.userMetaName} numberOfLines={1}>
                {userData.name}
              </Text>

              <View style={styles.badgeRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color="#22CC71"
                />
                <Text style={styles.userMetaSub}>
                  Verified Customer
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {userData ? (
          <View style={styles.mainContainer}>
            {/* PERSONAL INFORMATION */}
            <Text style={styles.sectionTitle}>
              Personal Information
            </Text>

            <View style={styles.premiumCard}>
              <View style={styles.infoRow}>
                <View style={styles.infoIconWrapper}>
                  <Ionicons
                    name="person-outline"
                    size={18}
                    color="#0D0D0D"
                  />
                </View>

                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Name</Text>
                  <Text style={styles.infoValue}>
                    {userData.name}
                  </Text>
                </View>
              </View>

              <View style={styles.cardSeparator} />

              <View style={styles.infoRow}>
                <View style={styles.infoIconWrapper}>
                  <Ionicons
                    name="mail-outline"
                    size={18}
                    color="#0D0D0D"
                  />
                </View>

                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>
                    {userData.email}
                  </Text>
                </View>
              </View>

              <View style={styles.cardSeparator} />

              <View style={styles.infoRow}>
                <View style={styles.infoIconWrapper}>
                  <Ionicons
                    name="call-outline"
                    size={18}
                    color="#0D0D0D"
                  />
                </View>

                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>
                    {userData.phone}
                  </Text>
                </View>
              </View>
            </View>

            {/* ACCOUNT */}
            <Text style={styles.sectionTitle}>Account</Text>

            <View style={styles.premiumCard}>
              <Pressable
                onPress={() => router.push('/orders')}
                style={({ pressed }) => [
                  styles.menuRowItem,
                  pressed && styles.pressOpacity,
                ]}
              >
                <View style={styles.menuLeftBlock}>
                  <View style={styles.menuIconWrapper}>
                    <Ionicons
                      name="receipt-outline"
                      size={18}
                      color="#0D0D0D"
                    />
                  </View>

                  <Text style={styles.menuItemText}>
                    My Orders
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#94A3B8"
                />
              </Pressable>

              <View style={styles.cardSeparator} />

              <Pressable
                onPress={() => router.push('/addresses')}
                style={({ pressed }) => [
                  styles.menuRowItem,
                  pressed && styles.pressOpacity,
                ]}
              >
                <View style={styles.menuLeftBlock}>
                  <View style={styles.menuIconWrapper}>
                    <Ionicons
                      name="location-outline"
                      size={18}
                      color="#0D0D0D"
                    />
                  </View>

                  <Text style={styles.menuItemText}>
                    My Addresses
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#94A3B8"
                />
              </Pressable>

              <View style={styles.cardSeparator} />

              <Pressable
                onPress={() => {}}
                style={({ pressed }) => [
                  styles.menuRowItem,
                  pressed && styles.pressOpacity,
                ]}
              >
                <View style={styles.menuLeftBlock}>
                  <View style={styles.menuIconWrapper}>
                    <Ionicons
                      name="notifications-outline"
                      size={18}
                      color="#0D0D0D"
                    />
                  </View>

                  <Text style={styles.menuItemText}>
                    Notifications
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#94A3B8"
                />
              </Pressable>

              <View style={styles.cardSeparator} />

              <Pressable
                onPress={handleHelpSupport}
                style={({ pressed }) => [
                  styles.menuRowItem,
                  pressed && styles.pressOpacity,
                ]}
              >
                <View style={styles.menuLeftBlock}>
                  <View style={styles.menuIconWrapper}>
                    <Ionicons
                      name="help-buoy-outline"
                      size={18}
                      color="#0D0D0D"
                    />
                  </View>

                  <Text style={styles.menuItemText}>
                    Help & Support
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#94A3B8"
                />
              </Pressable>

              <View style={styles.cardSeparator} />

              <Pressable
                onPress={handleDeleteAccount}
                style={({ pressed }) => [
                  styles.menuRowItem,
                  pressed && styles.pressOpacity,
                ]}
              >
                <View style={styles.menuLeftBlock}>
                  <View style={styles.menuIconWrapper}>
                    <Ionicons
                      name="trash-outline"
                      size={18}
                      color="#EF4444"
                    />
                  </View>

                  <Text
                    style={[
                      styles.menuItemText,
                      styles.deleteAccountText,
                    ]}
                  >
                    Delete Account
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#94A3B8"
                />
              </Pressable>
            </View>

            {/* HELP & LEGAL */}
            <Text style={styles.sectionTitle}>
              Help & Legal
            </Text>

            <View style={styles.premiumCard}>
              <Pressable
                onPress={() => router.push('/legal/terms' as any)}
                style={({ pressed }) => [
                  styles.menuRowItem,
                  pressed && styles.pressOpacity,
                ]}
              >
                <View style={styles.menuLeftBlock}>
                  <View style={styles.menuIconWrapper}>
                    <Ionicons
                      name="document-text-outline"
                      size={18}
                      color="#0D0D0D"
                    />
                  </View>

                  <Text style={styles.menuItemText}>
                    Terms & Conditions
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#94A3B8"
                />
              </Pressable>

              <View style={styles.cardSeparator} />

              <Pressable
                onPress={() => router.push('/legal/privacy' as any)}
                style={({ pressed }) => [
                  styles.menuRowItem,
                  pressed && styles.pressOpacity,
                ]}
              >
                <View style={styles.menuLeftBlock}>
                  <View style={styles.menuIconWrapper}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={18}
                      color="#0D0D0D"
                    />
                  </View>

                  <Text style={styles.menuItemText}>
                    Privacy Policy
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#94A3B8"
                />
              </Pressable>

              <View style={styles.cardSeparator} />

              <Pressable
                onPress={() => router.push('/legal/liability' as any)}
                style={({ pressed }) => [
                  styles.menuRowItem,
                  pressed && styles.pressOpacity,
                ]}
              >
                <View style={styles.menuLeftBlock}>
                  <View style={styles.menuIconWrapper}>
                    <Ionicons
                      name="alert-circle-outline"
                      size={18}
                      color="#0D0D0D"
                    />
                  </View>

                  <Text style={styles.menuItemText}>
                    Limitation of Liability
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#94A3B8"
                />
              </Pressable>

              <View style={styles.cardSeparator} />

              <Pressable
                onPress={() => router.push('/legal/disclaimer' as any)}
                style={({ pressed }) => [
                  styles.menuRowItem,
                  pressed && styles.pressOpacity,
                ]}
              >
                <View style={styles.menuLeftBlock}>
                  <View style={styles.menuIconWrapper}>
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color="#0D0D0D"
                    />
                  </View>

                  <Text style={styles.menuItemText}>
                    Disclaimer
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#94A3B8"
                />
              </Pressable>

              <View style={styles.cardSeparator} />

              <Pressable
                onPress={() => router.push('/legal/refund-policy' as any)}
                style={({ pressed }) => [
                  styles.menuRowItem,
                  pressed && styles.pressOpacity,
                ]}
              >
                <View style={styles.menuLeftBlock}>
                  <View style={styles.menuIconWrapper}>
                    <Ionicons
                      name="refresh-circle-outline"
                      size={18}
                      color="#0D0D0D"
                    />
                  </View>

                  <Text style={styles.menuItemText}>
                    Refund & Cancellation Policy
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#94A3B8"
                />
              </Pressable>

              <View style={styles.cardSeparator} />

              <Pressable
                onPress={() => router.push('/legal/contact' as any)}
                style={({ pressed }) => [
                  styles.menuRowItem,
                  pressed && styles.pressOpacity,
                ]}
              >
                <View style={styles.menuLeftBlock}>
                  <View style={styles.menuIconWrapper}>
                    <Ionicons
                      name="mail-open-outline"
                      size={18}
                      color="#0D0D0D"
                    />
                  </View>

                  <Text style={styles.menuItemText}>
                    Contact Us
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#94A3B8"
                />
              </Pressable>

              <View style={styles.cardSeparator} />

              <Pressable
                onPress={() => router.push('/about' as any)}
                style={({ pressed }) => [
                  styles.menuRowItem,
                  pressed && styles.pressOpacity,
                ]}
              >
                <View style={styles.menuLeftBlock}>
                  <View style={styles.menuIconWrapper}>
                    <Ionicons
                      name="ribbon-outline"
                      size={18}
                      color="#0D0D0D"
                    />
                  </View>

                  <Text style={styles.menuItemText}>
                    About Rivo
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color="#94A3B8"
                />
              </Pressable>
            </View>

            {/* LOGOUT BUTTON WITH SPACING */}
            <View style={styles.logoutContainer}>
              <Pressable
                onPress={handleLogout}
                style={({ pressed }) => [
                  styles.logoutButton,
                  pressed && styles.btnPressScale,
                ]}
              >
                <Ionicons
                  name="log-out-outline"
                  size={18}
                  color="#EF4444"
                  style={{ marginRight: 8 }}
                />

                <Text style={styles.logoutButtonText}>
                  Log Out
                </Text>
              </Pressable>
            </View>

            {/* FOOTER METADATA */}
            <View style={styles.footerContainer}>
              <Text style={styles.versionText}>
                Version 1.0.0
              </Text>

              <Text style={styles.madeWithLoveText}>
                Made with ❤️ in India
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTextText}>
              No customer profile found.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  centeredLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  gradientHeader: {
    backgroundColor: '#0D0D0D',
    paddingTop: 44,
    paddingBottom: 24,
    paddingHorizontal: 20,
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
    opacity: 0.12,
  },
  headerAccentCircleRight: {
    position: 'absolute',
    bottom: -60,
    right: -20,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#22CC71',
    opacity: 0.08,
  },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFFFFF1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  avatarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#22CC71',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF22',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  userMetaTextContainer: {
    flex: 1,
    gap: 4,
  },
  userMetaName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  userMetaSub: {
    fontSize: 13,
    color: '#E2E8F0',
    fontWeight: '600',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  mainContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  premiumCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  infoIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: '#0D0D0D',
    fontWeight: '600',
  },
  cardSeparator: {
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  menuRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    minHeight: 48,
  },
  menuLeftBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0D0D0D',
  },
  deleteAccountText: {
    color: '#EF4444',
  },
  logoutContainer: {
    marginTop: 36,
    marginBottom: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
  },
  footerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
  },
  versionText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  madeWithLoveText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
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
  pressOpacity: {
    opacity: 0.7,
  },
  btnPressScale: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
});