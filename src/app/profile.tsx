import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase'; // Adjust this import path to match your Supabase client location[cite: 10]

export default function ProfileScreen() {
  const router = useRouter(); //[cite: 10]
  const [loading, setLoading] = useState(true); //[cite: 10]
  const [userData, setUserData] = useState<{ name: string; email: string; phone: string } | null>(null); //[cite: 10]

  useEffect(() => {
    async function fetchProfile() {
      try {
        setLoading(true); //[cite: 10]

        // 1. Get currently logged in user
        const {
          data: { user },
        } = await supabase.auth.getUser(); //[cite: 10]

        if (!user) {
          router.replace('/login'); //[cite: 10]
          return;
        }

        // 2. Fetch customer data from 'customers' table where auth_user_id matches
        const { data: customer, error } = await supabase
          .from('customers')
          .select('customer_name, email, phone')
          .eq('auth_user_id', user.id)
          .single(); //[cite: 10]

        if (error) {
          console.error('Error fetching customer data:', error.message); //[cite: 10]
        } else if (customer) {
          setUserData({
            name: customer.customer_name || 'N/A', //[cite: 10]
            email: customer.email || 'N/A', //[cite: 10]
            phone: customer.phone || 'N/A', //[cite: 10]
          });
        }
      } catch (error) {
        console.error('Unexpected error:', error); //[cite: 10]
      } finally {
        setLoading(false); //[cite: 10]
      }
    }

    fetchProfile(); //[cite: 10]
  }, []);

  // Handle user logout
  const handleLogout = async () => {
    await supabase.auth.signOut(); //[cite: 10]
    router.replace('/login'); //[cite: 10]
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // 5. Loading state view
  if (loading) {
    return (
      <View style={styles.centeredLoading}>
        <ActivityIndicator size="large" color="#22CC71" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Premium Faux Gradient Header Block */}
      <View style={styles.gradientHeader}>
        <View style={styles.headerAccentCircleLeft} />
        <View style={styles.headerAccentCircleRight} />
        <View style={styles.navRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
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
              <Text style={styles.userMetaName} numberOfLines={1}>{userData.name}</Text>
              <Text style={styles.userMetaSub} numberOfLines={1}>Rivo Premium Client</Text>
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
              {/* My Orders Menu Navigation */}
              <Pressable onPress={() => router.push('/orders')} style={styles.menuRowItem}>
                <View style={styles.menuLeftBlock}>
                  <Text style={styles.menuIconSymbol}>📋</Text>
                  <Text style={styles.menuItemText}>My Orders</Text>
                </View>
                <Text style={styles.menuChevron}>➔</Text>
              </Pressable>

              <View style={styles.cardSeparator} />

              {/* My Addresses Menu Navigation */}
              <Pressable onPress={() => router.push('/addresses')} style={styles.menuRowItem}>
                <View style={styles.menuLeftBlock}>
                  <Text style={styles.menuIconSymbol}>🏠</Text>
                  <Text style={styles.menuItemText}>My Addresses</Text>
                </View>
                <Text style={styles.menuChevron}>➔</Text>
              </Pressable>
            </View>

            {/* UPCOMING ECOSYSTEM PLUGINS */}
            <Text style={styles.sectionTitle}>Ecosystem Modules</Text>
            <View style={styles.premiumCard}>
              {/* Payments Menu Coming Soon */}
              <View style={[styles.menuRowItem, styles.disabledMenuRow]}>
                <View style={styles.menuLeftBlock}>
                  <Text style={styles.menuIconSymbol}>💳</Text>
                  <Text style={styles.menuItemText}>Saved Payments</Text>
                </View>
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonBadgeText}>SOON</Text>
                </View>
              </View>

              <View style={styles.cardSeparator} />

              {/* Wishlist Menu Coming Soon */}
              <View style={[styles.menuRowItem, styles.disabledMenuRow]}>
                <View style={styles.menuLeftBlock}>
                  <Text style={styles.menuIconSymbol}>❤️</Text>
                  <Text style={styles.menuItemText}>My Wishlist</Text>
                </View>
                <View style={styles.comingSoonBadge}>
                  <Text style={styles.comingSoonBadgeText}>SOON</Text>
                </View>
              </View>
            </View>

            {/* SETTINGS & SUPPORT */}
            <Text style={styles.sectionTitle}>Preferences & Help</Text>
            <View style={styles.premiumCard}>
              <View style={styles.menuRowItem}>
                <View style={styles.menuLeftBlock}>
                  <Text style={styles.menuIconSymbol}>⚙️</Text>
                  <Text style={styles.menuItemText}>Settings Configuration</Text>
                </View>
                <Text style={styles.menuChevron}>➔</Text>
              </View>

              <View style={styles.cardSeparator} />

              <View style={styles.menuRowItem}>
                <View style={styles.menuLeftBlock}>
                  <Text style={styles.menuIconSymbol}>🎧</Text>
                  <Text style={styles.menuItemText}>Rivo Support Desk</Text>
                </View>
                <Text style={styles.menuChevron}>➔</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.errorContainer}>
            <Text style={styles.errorTextText}>No customer profile found.</Text>
          </View>
        )}
      </ScrollView>

      {/* 6. Logout Button Footer Pane */}
      <View style={styles.footerPanel}>
        <Pressable
          onClick={handleLogout} //[cite: 10]
          onPress={handleLogout} //[cite: 10]
          style={({ pressed }) => [styles.logoutButton, pressed && styles.microInteractionState]}
        >
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
  backButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
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
  disabledMenuRow: {
    opacity: 0.55,
  },
  menuLeftBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIconSymbol: {
    fontSize: 16,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D0D0D',
  },
  menuChevron: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '700',
  },
  comingSoonBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  comingSoonBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
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