import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, FlatList, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';

interface Address {
  id: string;
  customer_id: number;
  address_line1: string;
  address_line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pin_code: string;
  address_type: string | null;
  is_default: boolean;
}

export default function AddressesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [currentCustomerId, setCurrentCustomerId] = useState<number | null>(null);

  // Animated visibility trackers
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const skeletonAnim = useRef(new Animated.Value(0.3)).current;

  // Skeleton shimmer simulation
  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(skeletonAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(skeletonAnim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [loading]);

  async function fetchAddresses() {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
        return;
      }

      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (customer) {
        setCurrentCustomerId(customer.id);
        const { data, error } = await supabase
          .from('customer_addresses')
          .select('*')
          .eq('customer_id', customer.id)
          .order('is_default', { ascending: false });

        if (error) throw error;
        setAddresses(data || []);
        
        // Trigger smooth entry animation for cards
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAddresses();
  }, []);

  const handleSetDefault = async (addressId: string) => {
    if (!currentCustomerId) return;

    try {
      setLoading(true);

      // 1. Update all customer addresses to is_default = false
      const { error: clearError } = await supabase
        .from('customer_addresses')
        .update({ is_default: false })
        .eq('customer_id', currentCustomerId);

      if (clearError) throw clearError;

      // 2. Update selected address to is_default = true
      const { error: setError } = await supabase
        .from('customer_addresses')
        .update({ is_default: true })
        .eq('id', addressId);

      if (setError) throw setError;

      // 3. Refresh list
      await fetchAddresses();
    } catch (error) {
      console.error('Error setting default address:', error);
      Alert.alert('Error', 'Failed to set default address.');
      setLoading(false);
    }
  };

  const handleDelete = (addressId: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const { error } = await supabase
                .from('customer_addresses')
                .delete()
                .eq('id', addressId);

              if (error) throw error;
              await fetchAddresses();
            } catch (error) {
              console.error('Error deleting address:', error);
              Alert.alert('Error', 'Failed to delete address.');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (loading && addresses.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.title}>My Addresses</Text>
            <Text style={styles.subtitle}>Manage your delivery locations</Text>
          </View>
        </View>
        <View style={styles.skeletonContainer}>
          {[1, 2, 3].map((key) => (
            <Animated.View key={key} style={[styles.skeletonCard, { opacity: skeletonAnim }]}>
              <View style={styles.skeletonRow}>
                <View style={styles.skeletonIcon} />
                <View style={styles.skeletonTextLineLong} />
              </View>
              <View style={styles.skeletonTextLineShort} />
              <View style={styles.skeletonTextLineMedium} />
            </Animated.View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Premium Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>My Addresses</Text>
          <Text style={styles.subtitle}>Manage your delivery locations</Text>
        </View>
        <Pressable 
          onPress={() => router.push('/add-address')}
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.pressedState
          ]}
        >
          <Text style={styles.addButtonText}>+ Add New Address</Text>
        </Pressable>
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <FlatList
          data={addresses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isHome = item.address_type?.toLowerCase() === 'home';
            const isWork = item.address_type?.toLowerCase() === 'work';

            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.badgeRow}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeIcon}>{isHome ? '🏠' : isWork ? '🏢' : '📍'}</Text>
                      <Text style={styles.addressType}>
                        {item.address_type ? item.address_type.toUpperCase() : 'ADDRESS'}
                      </Text>
                    </View>
                    {item.is_default && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.addressInfoBlock}>
                  <Text style={styles.addressTextLine1}>{item.address_line1}</Text>
                  {item.address_line2 && <Text style={styles.addressTextLine2}>{item.address_line2}</Text>}
                  {item.landmark && (
                    <Text style={styles.landmarkText}>
                      <Text style={styles.landmarkLabel}>Landmark:</Text> {item.landmark}
                    </Text>
                  )}
                  <Text style={styles.addressCityBlock}>
                    {item.city}, {item.state} - {item.pin_code}
                  </Text>
                </View>

                {/* Premium Action Row */}
                <View style={styles.actionRow}>
                  <View style={styles.leftActions}>
                    <Pressable 
                      onPress={() => router.push(`/edit-address?id=${item.id}`)}
                      style={({ pressed }) => [styles.actionButton, styles.editBtn, pressed && styles.pressedState]}
                    >
                      <Text style={styles.editButtonText}>📝 Edit</Text>
                    </Pressable>
                    
                    <Pressable 
                      onPress={() => handleDelete(item.id)}
                      style={({ pressed }) => [styles.actionButton, styles.deleteBtn, pressed && styles.pressedState]}
                    >
                      <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
                    </Pressable>
                  </View>

                  {!item.is_default && (
                    <Pressable 
                      onPress={() => handleSetDefault(item.id)}
                      style={({ pressed }) => [styles.setDefaultButton, pressed && styles.pressedState]}
                    >
                      <Text style={styles.setDefaultButtonText}>★ Set Default</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIllustrationWrapper}>
                <Text style={styles.emptyIcon}>📍</Text>
              </View>
              <Text style={styles.emptyTextTitle}>No addresses saved yet</Text>
              <Text style={styles.emptyTextSub}>Add your first delivery address.</Text>
              <Pressable 
                onPress={() => router.push('/add-address')}
                style={({ pressed }) => [styles.emptyAddButton, pressed && styles.pressedState]}
              >
                <Text style={styles.emptyAddButtonText}>Add Address</Text>
              </Pressable>
            </View>
          }
        />
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#EAEFF3',
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0D0D0D',
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  addButton: {
    backgroundColor: '#22CC71',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    shadowColor: '#22CC71',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAEFF3',
    marginBottom: 14,
    shadowColor: '#0D0D0D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F7F8FA',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EAEFF3',
  },
  typeBadgeIcon: {
    fontSize: 12,
  },
  addressType: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.3,
  },
  defaultBadge: {
    backgroundColor: '#22CC71',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  defaultBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  addressInfoBlock: {
    marginBottom: 4,
  },
  addressTextLine1: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0D0D0D',
    lineHeight: 22,
  },
  addressTextLine2: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
    marginTop: 2,
  },
  landmarkContainer: {
    marginTop: 2,
  },
  landmarkLabel: {
    fontWeight: '700',
    color: '#64748B',
  },
  landmarkText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    fontStyle: 'italic',
    marginTop: 2,
  },
  addressCityBlock: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  leftActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  editBtn: {
    backgroundColor: '#F7F8FA',
    borderColor: '#EAEFF3',
  },
  deleteBtn: {
    backgroundColor: '#EF444408',
    borderColor: '#EF444420',
  },
  editButtonText: {
    color: '#22CC71',
    fontSize: 13,
    fontWeight: '800',
  },
  deleteButtonText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '800',
  },
  setDefaultButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#22CC71',
  },
  setDefaultButtonText: {
    color: '#22CC71',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  emptyIllustrationWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EAEFF3',
  },
  emptyIcon: {
    fontSize: 44,
  },
  emptyTextTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0D0D0D',
    letterSpacing: -0.3,
  },
  emptyTextSub: {
    textAlign: 'center',
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
    marginBottom: 24,
  },
  emptyAddButton: {
    backgroundColor: '#22CC71',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#22CC71',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  emptyAddButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  skeletonContainer: {
    padding: 16,
    gap: 14,
  },
  skeletonCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#EAEFF3',
    gap: 12,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skeletonIcon: {
    width: 45,
    height: 24,
    backgroundColor: '#EAEFF3',
    borderRadius: 8,
  },
  skeletonTextLineLong: {
    width: '50%',
    height: 16,
    backgroundColor: '#EAEFF3',
    borderRadius: 4,
  },
  skeletonTextLineShort: {
    width: '80%',
    height: 18,
    backgroundColor: '#EAEFF3',
    borderRadius: 4,
  },
  skeletonTextLineMedium: {
    width: '40%',
    height: 14,
    backgroundColor: '#EAEFF3',
    borderRadius: 4,
  },
  pressedState: {
    transform: [{ scale: 0.96 }],
    opacity: 0.85,
  },
});