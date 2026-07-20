import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { getUnreadCustomerNotificationCount } from '../services/notificationService';

interface Vendor {
  id: string;
  shop_name: string;
  avatar_url?: string | null;
  status: string;
}

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  vendor_id: string;
  category_id: string;
  status: string;
}

export default function HomeScreen() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [customerName, setCustomerName] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Animation values
  const searchScale = useMemo(() => new Animated.Value(1), []);
  const searchShadow = useMemo(() => new Animated.Value(2), []);

  // Fetch unread notification count & subscribe to realtime changes
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function initNotificationListener() {
      const count = await getUnreadCustomerNotificationCount();
      setUnreadCount(count);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      channel = supabase
        .channel(`home-notification-badge-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_type=eq.customer`,
          },
          async () => {
            const updatedCount = await getUnreadCustomerNotificationCount();
            setUnreadCount(updatedCount);
          }
        )
        .subscribe();
    }

    initNotificationListener();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Sync data refresh whenever the screen regains user focus
  useFocusEffect(
    useCallback(() => {
      let isMounted = true;

      async function syncHomeData() {
        try {
          setLoading(true);
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (!user) {
            setLoading(false);
            return;
          }

          // Fetch fresh unread count on focus return
          getUnreadCustomerNotificationCount().then((cnt) => {
            if (isMounted) setUnreadCount(cnt);
          });

          // 1. Fetch customer profile
          const { data: profile } = await supabase
            .from('customers')
            .select('customer_name')
            .eq('auth_user_id', user.id)
            .single();

          if (isMounted && profile) {
            setCustomerName(profile.customer_name);
          }

          // 2. Fetch categories
          const { data: catData } = await supabase
            .from('product_categories')
            .select('id, name');

          const map: Record<string, string> = {};
          if (catData) {
            if (isMounted) setCategories(catData);
            catData.forEach((cat: Category) => {
              map[cat.id] = cat.name;
            });
            if (isMounted) setCategoryMap(map);
          }

          // 3. Fetch approved vendors
          const { data: vendorData } = await supabase
            .from('vendors')
            .select('*, vendor_profiles(avatar_url)')
            .eq('status', 'approved');

          if (isMounted && vendorData) {
            const parsedVendors = vendorData.map((v: any) => ({
              ...v,
              avatar_url: Array.isArray(v.vendor_profiles)
                ? v.vendor_profiles[0]?.avatar_url
                : v.vendor_profiles?.avatar_url || null,
            }));
            setVendors(parsedVendors);
          }

          // 4. Fetch active products
          const { data: prodData } = await supabase
            .from('products')
            .select('id, vendor_id, category_id, status')
            .eq('status', 'active');

          if (isMounted && prodData) {
            setProducts(prodData);
          }
        } catch (error) {
          console.error('Error refreshing home data:', error);
        } finally {
          if (isMounted) setLoading(false);
        }
      }

      syncHomeData();

      return () => {
        isMounted = false;
      };
    }, [])
  );

  const handleCategoryPress = (categoryName: string) => {
    if (selectedCategory === categoryName) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(categoryName);
    }
  };

  const filteredVendors = useMemo(() => {
    return vendors.filter((vendor) => {
      const matchesSearch = vendor.shop_name?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!selectedCategory) {
        return matchesSearch;
      }

      const hasMatchingProduct = products.some((product) => {
        const productCategoryName = categoryMap[product.category_id];
        return product.vendor_id === vendor.id && productCategoryName === selectedCategory;
      });

      return matchesSearch && hasMatchingProduct;
    });
  }, [vendors, searchQuery, selectedCategory, products, categoryMap]);

  const getInitials = (name?: string) => {
    if (!name) return 'S';
    const cleanName = name.replace(/[0-9]/g, '').trim();
    if (!cleanName) return 'S';

    const parts = cleanName.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return cleanName.slice(0, 2).toUpperCase();
  };

  const handleSearchFocus = () => {
    Animated.parallel([
      Animated.timing(searchScale, {
        toValue: 1.015,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(searchShadow, {
        toValue: 6,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handleSearchBlur = () => {
    Animated.parallel([
      Animated.timing(searchScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(searchShadow, {
        toValue: 2,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        
        {/* Top Profile & Notification Header */}
        <View style={styles.topHeader}>
          <View>
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>RIVO INSTANT</Text>
            </View>
            <Text style={styles.greetingText}>
              Hello, {customerName || 'Customer'} 👋
            </Text>
            <Text style={styles.subGreetingText}>Let's find your favorite store</Text>
          </View>

          {/* Action Icons Wrapper */}
          <View style={styles.headerActionsWrapper}>
            {/* Notification Bell Button */}
            <TouchableOpacity
              onPress={() => router.push('/notifications')}
              style={styles.bellIconButton}
              activeOpacity={0.7}
            >
              <Text style={styles.bellIconSymbol}>🔔</Text>
              {unreadCount > 0 && (
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Profile Avatar Button */}
            <Pressable onPress={() => router.push('/profile')} style={styles.profileIconButton}>
              <View style={styles.profileInnerRing}>
                <Text style={styles.profileIconText}>
                  {getInitials(customerName || 'Customer')}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Animated Search Engine Box */}
        <Animated.View
          style={[
            styles.searchContainer,
            {
              transform: [{ scale: searchScale }],
              elevation: searchShadow,
              shadowRadius: searchShadow.interpolate({
                inputRange: [2, 6],
                outputRange: [6, 16],
              }),
              shadowOpacity: searchShadow.interpolate({
                inputRange: [2, 6],
                outputRange: [0.05, 0.12],
              }),
            },
          ]}
        >
          <View style={styles.searchIconWrapper}>
            <Text style={styles.searchIconSymbol}>🔍</Text>
          </View>
          <TextInput
            placeholder="Search stores, markets or shops..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={handleSearchFocus}
            onBlur={handleSearchBlur}
            style={styles.searchInput}
          />
        </Animated.View>

        {/* Categories Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Explore Categories</Text>
            <Text style={styles.sectionSubtitle}>Curated for you</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalGap}>
            <Pressable
              onPress={() => setSelectedCategory(null)}
              style={({ pressed }) => [
                styles.categoryChip,
                selectedCategory === null && styles.categoryChipSelected,
                pressed && styles.chipPressed,
              ]}
            >
              <Text style={[styles.categoryChipText, selectedCategory === null && styles.categoryChipTextSelected]}>
                ✨ All Stores
              </Text>
            </Pressable>

            {categories.map((category) => {
              const isSelected = selectedCategory === category.name;
              return (
                <Pressable
                  key={category.id}
                  onPress={() => handleCategoryPress(category.name)}
                  style={({ pressed }) => [
                    styles.categoryChip,
                    isSelected && styles.categoryChipSelected,
                    pressed && styles.chipPressed,
                  ]}
                >
                  <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextSelected]}>
                    📦 {category.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Featured Stores Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Featured Stores</Text>
            <Text style={styles.storeCountBadge}>{filteredVendors.length} Available</Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#22CC71" />
              <Text style={styles.loadingText}>Curating nearby stores...</Text>
            </View>
          ) : filteredVendors.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyIcon}>🏪</Text>
              <Text style={styles.emptyStateTitle}>
                {searchQuery ? 'No matching stores' : 'No stores found'}
              </Text>
              <Text style={styles.emptyStateSubtext}>
                {searchQuery ? 'Try checking your spelling or search another item' : 'There are no active vendors for this category right now.'}
              </Text>
            </View>
          ) : (
            <View style={styles.storesGrid}>
              {filteredVendors.map((vendor) => (
                <Pressable
                  key={vendor.id}
                  onPress={() => router.push(`/store/${vendor.id}` as any)}
                  style={({ pressed }) => [styles.storeCard, pressed && styles.pressedCard]}
                >
                  <View style={styles.storeCardAccent} />
                  {vendor.avatar_url ? (
                    <View style={styles.avatarContainer}>
                      <Image source={{ uri: vendor.avatar_url }} style={styles.storeAvatar} />
                    </View>
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarPlaceholderText}>{getInitials(vendor.shop_name)}</Text>
                    </View>
                  )}
                  <View style={styles.storeInfoWrapper}>
                    <Text style={styles.storeNameText} numberOfLines={2}>
                      {vendor.shop_name}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Bottom Navigation Tab Bar */}
      <View style={styles.bottomTabBar}>
        <Pressable onPress={() => router.push('/')} style={styles.tabItem}>
          <View style={[styles.tabIconIndicator, styles.tabIconIndicatorActive]}>
            <Text style={styles.tabIcon}>🏠</Text>
          </View>
          <Text style={[styles.tabText, styles.tabActiveText]}>Home</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/orders' as any)} style={styles.tabItem}>
          <View style={styles.tabIconIndicator}>
            <Text style={styles.tabIcon}>📋</Text>
          </View>
          <Text style={styles.tabText}>Orders</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/cart' as any)} style={styles.tabItem}>
          <View style={styles.tabIconIndicator}>
            <Text style={styles.tabIcon}>🛒</Text>
          </View>
          <Text style={styles.tabText}>Cart</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/profile')} style={styles.tabItem}>
          <View style={styles.tabIconIndicator}>
            <Text style={styles.tabIcon}>👤</Text>
          </View>
          <Text style={styles.tabText}>Profile</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerActionsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bellIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#EAEFF3',
    shadowColor: '#0D0D0D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  bellIconSymbol: {
    fontSize: 18,
  },
  badgeContainer: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#E53935',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  brandBadge: {
    backgroundColor: '#A8E63A25',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  brandBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#22CC71',
    letterSpacing: 1,
  },
  greetingText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0D0D0D',
    letterSpacing: -0.6,
  },
  subGreetingText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 1,
    fontWeight: '500',
  },
  profileIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F7F8FA',
    padding: 2,
    shadowColor: '#0D0D0D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  profileInnerRing: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#22CC71',
  },
  profileIconText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0D0D0D',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: '#F7F8FA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAEFF3',
    shadowColor: '#0D0D0D',
    shadowOffset: { width: 0, height: 2 },
  },
  searchIconWrapper: {
    paddingLeft: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchIconSymbol: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: '500',
    color: '#0D0D0D',
  },
  sectionContainer: {
    marginBottom: 28,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0D0D0D',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#22CC71',
    fontWeight: '700',
  },
  storeCountBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    backgroundColor: '#F7F8FA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  horizontalGap: {
    gap: 8,
    paddingBottom: 4,
    paddingHorizontal: 2,
  },
  categoryChip: {
    backgroundColor: '#F7F8FA',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EAEFF3',
  },
  categoryChipSelected: {
    backgroundColor: '#22CC71',
    borderColor: '#22CC71',
    shadowColor: '#22CC71',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  chipPressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.9,
  },
  categoryChipText: {
    fontWeight: '700',
    color: '#475569',
    fontSize: 13,
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  storesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  storeCard: {
    backgroundColor: '#F7F8FA',
    borderRadius: 20,
    width: '48%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAEFF3',
    overflow: 'hidden',
    paddingTop: 18,
    paddingBottom: 18,
    paddingHorizontal: 12,
    shadowColor: '#0D0D0D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 1,
  },
  storeCardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#A8E63A',
    opacity: 0.4,
  },
  pressedCard: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
    borderColor: '#22CC71',
  },
  avatarContainer: {
    shadowColor: '#0D0D0D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 12,
  },
  storeAvatar: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: '#22CC71',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#22CC71',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarPlaceholderText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  storeInfoWrapper: {
    alignItems: 'center',
    width: '100%',
    justifyContent: 'center',
  },
  storeNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D0D0D',
    textAlign: 'center',
    width: '100%',
    lineHeight: 18,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 10,
  },
  emptyStateContainer: {
    backgroundColor: '#F7F8FA',
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    marginTop: 4,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D0D0D',
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 12,
    lineHeight: 16,
  },
  bottomTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 84,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 20,
    shadowColor: '#0D0D0D',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 15,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    flex: 1,
  },
  tabIconIndicator: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    borderRadius: 8,
  },
  tabIconIndicatorActive: {
    transform: [{ scale: 1.1 }],
  },
  tabIcon: {
    fontSize: 16,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabActiveText: {
    color: '#22CC71',
    fontWeight: '800',
  },
});