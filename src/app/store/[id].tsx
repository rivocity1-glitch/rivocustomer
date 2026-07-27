// src/app/store/[id].tsx
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { addToCart, getCart, subscribeCart } from '../../lib/cart';
import { supabase } from '../../lib/supabase';

// --- TYPES ---
interface BusinessHoursDay {
  open?: string;
  close?: string;
  closed?: boolean;
}

type BusinessHoursJSON = Record<string, BusinessHoursDay>;

interface VendorProfile {
  vendor_id: string;
  avatar_url?: string | null;
  banner_url?: string | null;
  tagline?: string | null;
  store_status?: 'open' | 'busy' | 'closed' | string | null;
  manual_override?: boolean | null;
  latitude?: number | null;
  longitude?: number | null;
  preparation_time_minutes?: number | null;
  delivery_radius_km?: number | null;
  minimum_order?: number | null;
  business_hours?: BusinessHoursJSON | string | null;
  vendors?: {
    shop_name: string;
  } | null;
}

interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  mrp?: number | null;
  image_url?: string | null;
  category_id?: string | null;
  status?: string | null;
  stock?: number | null;
}

interface CategoryRow {
  id: string;
  name: string;
  icon?: string | null;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 40) / 2;
const BANNER_HEIGHT = 240;

// --- HAVERSINE DISTANCE HELPER ---
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// --- BUSINESS HOURS HELPER ---
function parseTimeString(timeStr?: string): { hours: number; minutes: number } | null {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length < 2) return null;
  return { hours: parseInt(parts[0], 10), minutes: parseInt(parts[1], 10) };
}

function format12Hour(timeStr?: string): string {
  const parsed = parseTimeString(timeStr);
  if (!parsed) return '';
  const period = parsed.hours >= 12 ? 'PM' : 'AM';
  const hours12 = parsed.hours % 12 || 12;
  const minsStr = parsed.minutes < 10 ? `0${parsed.minutes}` : `${parsed.minutes}`;
  return `${hours12}:${minsStr} ${period}`;
}

function getBusinessHoursDisplay(profile: VendorProfile | null) {
  const rawHours = profile?.business_hours;
  const rawStatus = (profile?.store_status || 'closed').toLowerCase();
  const manualOverride = !!profile?.manual_override;

  let parsedHours: BusinessHoursJSON | null = null;
  if (rawHours) {
    try {
      parsedHours = typeof rawHours === 'string' ? JSON.parse(rawHours) : rawHours;
    } catch {
      parsedHours = null;
    }
  }

  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const now = new Date();
  const currentDayName = days[now.getDay()];
  const todaySchedule = parsedHours ? parsedHours[currentDayName] : null;

  let timeLabel = 'Hours unavailable';
  let isClosingSoon = false;

  if (todaySchedule) {
    if (todaySchedule.closed) {
      timeLabel = 'Closed All Day';
    } else if (todaySchedule.open && todaySchedule.close) {
      timeLabel = `${format12Hour(todaySchedule.open)} - ${format12Hour(todaySchedule.close)}`;

      const closeTime = parseTimeString(todaySchedule.close);
      if (closeTime) {
        const currentMins = now.getHours() * 60 + now.getMinutes();
        const closeMins = closeTime.hours * 60 + closeTime.minutes;
        if (closeMins - currentMins > 0 && closeMins - currentMins <= 45) {
          isClosingSoon = true;
        }
      }
    }
  }

  if (manualOverride && rawStatus === 'closed') {
    return {
      statusType: 'closed' as const,
      statusBadge: 'Closed',
      timeLabel,
      color: '#EF4444',
      bgColor: '#FEF2F2',
    };
  }

  if (rawStatus === 'closed') {
    return {
      statusType: 'closed' as const,
      statusBadge: 'Closed',
      timeLabel,
      color: '#EF4444',
      bgColor: '#FEF2F2',
    };
  }

  if (rawStatus === 'busy') {
    return {
      statusType: 'busy' as const,
      statusBadge: 'Busy',
      timeLabel,
      color: '#F97316',
      bgColor: '#FFF7ED',
    };
  }

  if (isClosingSoon) {
    return {
      statusType: 'closing_soon' as const,
      statusBadge: 'Closing Soon',
      timeLabel,
      color: '#F97316',
      bgColor: '#FFF7ED',
    };
  }

  return {
    statusType: 'open' as const,
    statusBadge: 'Open Now',
    timeLabel,
    color: '#22CC71',
    bgColor: '#E8FBF0',
  };
}

// --- SHIMMER LOADER COMPONENT ---
function ShimmerView({ style }: { style: any }) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.7, 0.3],
  });

  return <Animated.View style={[style, { opacity, backgroundColor: '#E2E8F0' }]} />;
}

function StoreSkeleton() {
  return (
    <View style={styles.container}>
      <ShimmerView style={styles.skeletonBanner} />
      <View style={styles.profileCard}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <ShimmerView style={styles.skeletonAvatar} />
          <ShimmerView style={styles.skeletonBadge} />
        </View>
        <ShimmerView style={styles.skeletonTitle} />
        <ShimmerView style={styles.skeletonSubTitle} />
        <ShimmerView style={styles.skeletonMetrics} />
      </View>

      <View style={styles.skeletonGrid}>
        {[1, 2, 3, 4].map((key) => (
          <ShimmerView key={key} style={styles.skeletonCard} />
        ))}
      </View>
    </View>
  );
}

// --- BANNER ITEM MEMOIZED ---
const BannerSlideItem = React.memo(({ item }: { item: string }) => {
  useEffect(() => {
    if (item) Image.prefetch(item);
  }, [item]);

  return (
    <View style={styles.bannerItemContainer}>
      <Image source={{ uri: item }} style={styles.bannerImage} resizeMode="cover" />
      <LinearGradient
        colors={['rgba(0,0,0,0.55)', 'transparent', 'rgba(0,0,0,0.45)']}
        locations={[0, 0.45, 1]}
        style={styles.bannerGradientOverlay}
      />
    </View>
  );
});

// --- PRODUCTION-READY BANNER CAROUSEL ---
interface BannerCarouselProps {
  banners: string[];
  shopName: string;
  avatarUrl?: string | null;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onShare: () => void;
}

const BannerCarousel = React.memo(
  ({ banners, shopName, avatarUrl, isFavorite, onToggleFavorite, onShare }: BannerCarouselProps) => {
    const totalBanners = banners.length;
    const flatListRef = useRef<FlatList>(null);
    const [activeIndex, setActiveIndex] = useState(0);
    const activeIndexRef = useRef(0);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isUserDragging = useRef(false);

    useEffect(() => {
      activeIndexRef.current = activeIndex;
    }, [activeIndex]);

    // Recursive setTimeout for reliable autoplay
    const clearAutoplayTimer = useCallback(() => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }, []);

    const scheduleNextSlide = useCallback(() => {
      clearAutoplayTimer();
      if (totalBanners <= 1 || isUserDragging.current) return;

      timerRef.current = setTimeout(() => {
        if (isUserDragging.current || totalBanners <= 1) return;

        const nextIndex = (activeIndexRef.current + 1) % totalBanners;
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToIndex({
            index: nextIndex,
            animated: true,
          });
        });
      }, 4000);
    }, [totalBanners, clearAutoplayTimer]);

    useEffect(() => {
      scheduleNextSlide();
      return () => clearAutoplayTimer();
    }, [activeIndex, totalBanners, scheduleNextSlide, clearAutoplayTimer]);

    const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const contentOffset = event.nativeEvent.contentOffset.x;
      const index = Math.round(contentOffset / SCREEN_WIDTH);
      if (index >= 0 && index < totalBanners && index !== activeIndexRef.current) {
        setActiveIndex(index);
      }
    };

    const handleScrollBeginDrag = () => {
      isUserDragging.current = true;
      clearAutoplayTimer();
    };

    const handleScrollEndDrag = () => {
      isUserDragging.current = false;
      scheduleNextSlide();
    };

    const handleScrollToIndexFailed = (info: { index: number }) => {
      setTimeout(() => {
        if (flatListRef.current) {
          flatListRef.current.scrollToOffset({
            offset: info.index * SCREEN_WIDTH,
            animated: true,
          });
        }
      }, 100);
    };

    const getItemLayout = useCallback(
      (_: any, index: number) => ({
        length: SCREEN_WIDTH,
        offset: SCREEN_WIDTH * index,
        index,
      }),
      []
    );

    const renderBannerItem = useCallback(
      ({ item }: { item: string }) => <BannerSlideItem item={item} />,
      []
    );

    return (
      <View style={styles.carouselContainer}>
        {totalBanners > 0 ? (
          <FlatList
            ref={flatListRef}
            data={banners}
            horizontal
            pagingEnabled
            snapToInterval={SCREEN_WIDTH}
            snapToAlignment="center"
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            directionalLockEnabled
            disableIntervalMomentum
            keyExtractor={(_, index) => `banner-slide-${index}`}
            renderItem={renderBannerItem}
            getItemLayout={getItemLayout}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onScrollBeginDrag={handleScrollBeginDrag}
            onScrollEndDrag={handleScrollEndDrag}
            onMomentumScrollEnd={handleScrollEndDrag}
            onScrollToIndexFailed={handleScrollToIndexFailed}
          />
        ) : (
          <View style={styles.placeholderBannerContainer}>
            <LinearGradient
              colors={['#0F172A', '#1E293B', '#0F172A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.placeholderBannerAvatar} />
            ) : (
              <View style={styles.placeholderBannerIconCircle}>
                <Ionicons name="storefront-outline" size={42} color="#22CC71" />
              </View>
            )}
            <Text style={styles.placeholderBannerText}>{shopName}</Text>
          </View>
        )}

        {/* Top Header Floating Overlay Actions */}
        <View style={styles.bannerHeaderActions}>
          <Pressable onPress={() => router.back()} style={styles.actionIconButton} hitSlop={8}>
            <Ionicons name="arrow-back" size={20} color="#0D0D0D" />
          </Pressable>

          <View style={styles.bannerRightActions}>
            <Pressable onPress={onToggleFavorite} style={styles.actionIconButton} hitSlop={8}>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={20}
                color={isFavorite ? '#EF4444' : '#0D0D0D'}
              />
            </Pressable>
            <Pressable onPress={onShare} style={styles.actionIconButton} hitSlop={8}>
              <Ionicons name="share-social-outline" size={19} color="#0D0D0D" />
            </Pressable>
          </View>
        </View>

        {/* Animated Pagination Dots */}
        {totalBanners > 1 && (
          <View style={styles.paginationContainer}>
            {banners.map((_, i) => {
              const isActive = i === activeIndex;
              return (
                <View
                  key={`dot-${i}`}
                  style={[styles.paginationDot, isActive ? styles.paginationDotActive : styles.paginationDotInactive]}
                />
              );
            })}
          </View>
        )}
      </View>
    );
  }
);

// --- PRODUCT CARD COMPONENT ---
function StaggeredProductCard({
  item,
  index,
  isStoreClosed,
  alreadyInCart,
  onAddToCart,
}: {
  item: Product;
  index: number;
  isStoreClosed: boolean;
  alreadyInCart: boolean;
  onAddToCart: (p: Product) => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(18)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  const stockVal = item.stock != null ? Number(item.stock) : 0;
  const isOutOfStock = stockVal === 0;
  const isLowStock = stockVal > 0 && stockVal <= 5;

  const showMRP = item.mrp && item.mrp > item.price;
  const discountPercent = showMRP ? Math.round(((item.mrp! - item.price) / item.mrp!) * 100) : 0;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay: Math.min(index * 40, 200),
        useNativeDriver: true,
      }),
      Animated.spring(translateYAnim, {
        toValue: 0,
        delay: Math.min(index * 40, 200),
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, translateYAnim, index]);

  const handleAddPress = () => {
    if (isOutOfStock || isStoreClosed) return;
    if (alreadyInCart) {
      router.push('/cart');
    } else {
      Animated.sequence([
        Animated.timing(buttonScale, { toValue: 0.92, duration: 80, useNativeDriver: true }),
        Animated.spring(buttonScale, { toValue: 1, friction: 4, useNativeDriver: true }),
      ]).start();
      onAddToCart(item);
    }
  };

  const isDisabled = isOutOfStock || isStoreClosed;

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: fadeAnim,
          transform: [{ translateY: translateYAnim }],
        },
      ]}
    >
      <Pressable
        style={({ pressed }) => [styles.cardInnerPressable, pressed && { opacity: 0.92 }]}
        onPress={() =>
          router.push({
            pathname: '/product/[id]',
            params: { id: item.id },
          } as any)
        }
      >
        <View style={styles.imageContainer}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.productImage} resizeMode="cover" />
          ) : (
            <View style={styles.productImagePlaceholder}>
              <Ionicons name="image-outline" size={32} color="#CBD5E1" />
            </View>
          )}

          {/* Discount Tag */}
          {showMRP && discountPercent > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{discountPercent}% OFF</Text>
            </View>
          )}

          {/* Stock Tag */}
          <View
            style={[
              styles.stockBadge,
              isOutOfStock
                ? styles.stockBadgeOut
                : isLowStock
                ? styles.stockBadgeLow
                : styles.stockBadgeIn,
            ]}
          >
            <View
              style={[
                styles.stockDot,
                { backgroundColor: isOutOfStock ? '#EF4444' : isLowStock ? '#F97316' : '#22CC71' },
              ]}
            />
            <Text
              style={[
                styles.stockStatusText,
                { color: isOutOfStock ? '#EF4444' : isLowStock ? '#C2410C' : '#15803D' },
              ]}
            >
              {isOutOfStock ? 'Out of Stock' : isLowStock ? `Only ${stockVal} left` : 'In Stock'}
            </Text>
          </View>
        </View>

        <View style={styles.cardContent}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.productPrice}>₹{item.price}</Text>
            {showMRP && <Text style={styles.productMRP}>₹{item.mrp}</Text>}
          </View>
        </View>
      </Pressable>

      <View style={styles.actionRow}>
        <Animated.View style={{ transform: [{ scale: buttonScale }], width: '100%' }}>
          <Pressable
            style={[
              styles.addToCartButton,
              isDisabled && styles.outOfStockBtn,
              alreadyInCart && !isStoreClosed && styles.alreadyInCartBtn,
            ]}
            onPress={handleAddPress}
            disabled={isDisabled}
          >
            <Text
              style={[
                styles.addToCartButtonText,
                isDisabled && styles.outOfStockBtnText,
                alreadyInCart && !isStoreClosed && styles.alreadyInCartBtnText,
              ]}
            >
              {isStoreClosed
                ? 'STORE CLOSED'
                : isOutOfStock
                ? 'OUT OF STOCK'
                : alreadyInCart
                ? 'GO TO CART'
                : 'ADD'}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

// --- MAIN STORE SCREEN ---
export default function StoreScreen() {
  const { id } = useLocalSearchParams();
  const vendorId = Array.isArray(id) ? id[0] : id;

  const [vendorProfile, setVendorProfile] = useState<VendorProfile | null>(null);
  const [banners, setBanners] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [customerCoords, setCustomerCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState(getCart());
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  // Entrance animations
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const productsListOpacity = useRef(new Animated.Value(1)).current;

  // Floating Cart Animations
  const cartSlideAnim = useRef(new Animated.Value(120)).current;
  const cartBounceAnim = useRef(new Animated.Value(1)).current;
  const prevCartCount = useRef(cartItems.length);

  // --- REALTIME SUBSCRIPTION ---
  useEffect(() => {
    if (!vendorId) return;

    const profileChannel = supabase
      .channel(`customer-vendor-profile-${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vendor_profiles',
          filter: `vendor_id=eq.${vendorId}`,
        },
        (payload: any) => {
          if (payload.new) {
            setVendorProfile((prev) => ({
              ...prev,
              ...(payload.new as VendorProfile),
            }));
          }
        }
      )
      .subscribe();

    const bannerChannel = supabase
      .channel(`customer-vendor-banners-${vendorId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vendor_profile_banners',
          filter: `vendor_id=eq.${vendorId}`,
        },
        () => {
          fetchBannersOnly();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(bannerChannel);
    };
  }, [vendorId]);

  // --- CART SUBSCRIPTION ---
  useEffect(() => {
    const unsubscribe = subscribeCart(() => {
      const newCart = getCart();
      const newCount = newCart.length;

      setCartItems([...newCart]);

      if (prevCartCount.current === 0 && newCount > 0) {
        Animated.spring(cartSlideAnim, {
          toValue: 0,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }).start();
      } else if (prevCartCount.current > 0 && newCount === 0) {
        Animated.timing(cartSlideAnim, {
          toValue: 120,
          duration: 250,
          useNativeDriver: true,
        }).start();
      }

      if (newCount > 0) {
        Animated.sequence([
          Animated.spring(cartBounceAnim, { toValue: 1.05, useNativeDriver: true, speed: 20 }),
          Animated.spring(cartBounceAnim, { toValue: 1, useNativeDriver: true, friction: 4 }),
        ]).start();
      }

      prevCartCount.current = newCount;
    });
    return unsubscribe;
  }, [cartSlideAnim, cartBounceAnim]);

  useEffect(() => {
    if (cartItems.length > 0) {
      cartSlideAnim.setValue(0);
    }
  }, []);

  useEffect(() => {
    if (!vendorId) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        setLoading(true);
        await Promise.all([
          fetchVendorAndBanners(),
          fetchProductsAndCategories(),
          fetchCustomerAddress(),
        ]);
      } catch (err) {
        console.error('Error fetching store screen data:', err);
      } finally {
        setLoading(false);
        Animated.timing(headerOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }).start();
      }
    }

    fetchData();
  }, [vendorId]);

  async function fetchBannersOnly() {
    const bannersRes = await supabase
      .from('vendor_profile_banners')
      .select('banner_url, banner_order')
      .eq('vendor_id', vendorId)
      .eq('is_active', true)
      .order('banner_order', { ascending: true });

    const bannerList: string[] = [];
    if (!bannersRes.error && bannersRes.data && bannersRes.data.length > 0) {
      bannersRes.data.forEach((b: { banner_url?: string; banner_order?: number }) => {
        if (b.banner_url) bannerList.push(b.banner_url);
      });
    }

    if (bannerList.length === 0 && vendorProfile?.banner_url) {
      bannerList.push(vendorProfile.banner_url);
    }

    bannerList.forEach((url) => Image.prefetch(url));
    setBanners(bannerList);
  }

  async function fetchVendorAndBanners() {
    const vendorPromise = supabase
      .from('vendor_profiles')
      .select('*, vendors(shop_name)')
      .eq('vendor_id', vendorId)
      .maybeSingle();

    const bannersPromise = supabase
      .from('vendor_profile_banners')
      .select('banner_url, banner_order')
      .eq('vendor_id', vendorId)
      .eq('is_active', true)
      .order('banner_order', { ascending: true });

    const [vendorRes, bannersRes] = await Promise.all([vendorPromise, bannersPromise]);

    let loadedProfile: VendorProfile | null = null;
    if (!vendorRes.error && vendorRes.data) {
      loadedProfile = vendorRes.data as unknown as VendorProfile;
      setVendorProfile(loadedProfile);
    }

    const bannerList: string[] = [];
    if (!bannersRes.error && bannersRes.data && bannersRes.data.length > 0) {
      bannersRes.data.forEach((b: { banner_url?: string; banner_order?: number }) => {
        if (b.banner_url) bannerList.push(b.banner_url);
      });
    }

    if (bannerList.length === 0 && loadedProfile?.banner_url) {
      bannerList.push(loadedProfile.banner_url);
    }

    bannerList.forEach((url) => Image.prefetch(url));
    setBanners(bannerList);
  }

  async function fetchProductsAndCategories() {
    const catPromise = supabase.from('product_categories').select('id, name, icon');
    const prodPromise = supabase
      .from('products')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('status', 'active');

    const [catRes, prodRes] = await Promise.all([catPromise, prodPromise]);

    if (!catRes.error && catRes.data) {
      setCategories(catRes.data as CategoryRow[]);
    }

    if (!prodRes.error && prodRes.data) {
      setProducts(prodRes.data as Product[]);
    }
  }

  async function fetchCustomerAddress() {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user) return;

      const user = authData.user;
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (customerError || !customer) return;

      const { data: addressData, error: addressError } = await supabase
        .from('customer_addresses')
        .select('latitude, longitude')
        .eq('customer_id', customer.id)
        .eq('is_default', true)
        .maybeSingle();

      if (addressError || !addressData) return;
      if (addressData.latitude == null || addressData.longitude == null) return;

      setCustomerCoords({
        latitude: Number(addressData.latitude),
        longitude: Number(addressData.longitude),
      });
    } catch (err) {
      console.error('Error fetching customer address:', err);
    }
  }

  const distanceText = useMemo(() => {
    if (
      customerCoords?.latitude != null &&
      customerCoords?.longitude != null &&
      vendorProfile?.latitude != null &&
      vendorProfile?.longitude != null
    ) {
      const dist = calculateDistance(
        customerCoords.latitude,
        customerCoords.longitude,
        Number(vendorProfile.latitude),
        Number(vendorProfile.longitude)
      );
      return `${dist.toFixed(1)} km`;
    }
    return null;
  }, [customerCoords, vendorProfile]);

  const hoursDisplay = useMemo(() => {
    return getBusinessHoursDisplay(vendorProfile);
  }, [vendorProfile]);

  const isStoreClosed = useMemo(() => {
    return (vendorProfile?.store_status || 'closed').toLowerCase() === 'closed';
  }, [vendorProfile]);

  const isStoreBusy = useMemo(() => {
    return (vendorProfile?.store_status || '').toLowerCase() === 'busy';
  }, [vendorProfile]);

  const prepTimeText = useMemo(() => {
    if (vendorProfile?.preparation_time_minutes != null) {
      return `${vendorProfile.preparation_time_minutes} mins`;
    }
    return '15-25 mins';
  }, [vendorProfile]);

  const activeCategories = useMemo(() => {
    const catIds = new Set<string>();
    products.forEach((p) => {
      if (p.category_id) catIds.add(p.category_id);
    });
    return categories.filter((c) => catIds.has(c.id));
  }, [products, categories]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory ? p.category_id === selectedCategory : true;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  const handleCategorySelect = (catId: string | null) => {
    Animated.timing(productsListOpacity, {
      toValue: 0.3,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      setSelectedCategory(catId);
      Animated.timing(productsListOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleShare = async () => {
    try {
      const name = vendorProfile?.vendors?.shop_name || 'Store';
      await Share.share({
        message: `Check out ${name} on Rivo!`,
      });
    } catch {
      // Ignored
    }
  };

  const totalCartQuantity = useMemo(() => {
    return cartItems.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  }, [cartItems]);

  const totalCartPrice = useMemo(() => {
    return cartItems.reduce((acc, curr) => acc + (curr.price * (curr.quantity || 0)), 0);
  }, [cartItems]);

  const shopName = vendorProfile?.vendors?.shop_name || 'Store';

  const handleAddToCart = useCallback((product: Product) => {
    addToCart(product);
  }, []);

  if (loading) {
    return <StoreSkeleton />;
  }

  return (
    <View style={styles.container}>
      <Animated.FlatList
        key="store-grid-2-col"
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.rowWrapper}
        contentContainerStyle={styles.productsList}
        showsVerticalScrollIndicator={false}
        style={{ opacity: productsListOpacity }}
        ListHeaderComponent={
          <View style={styles.topSectionContainer}>
            {/* HERO BANNER CAROUSEL */}
            <BannerCarousel
              banners={banners}
              shopName={shopName}
              avatarUrl={vendorProfile?.avatar_url}
              isFavorite={isFavorite}
              onToggleFavorite={() => setIsFavorite(!isFavorite)}
              onShare={handleShare}
            />

            {/* FLOATING GLASS STORE INFO CARD */}
            <Animated.View style={[styles.profileCard, { opacity: headerOpacity }]}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.avatarWrapper}>
                  {vendorProfile?.avatar_url ? (
                    <Image source={{ uri: vendorProfile.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarText}>{shopName.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                </View>

                {/* Status Badge */}
                <View style={[styles.statusBadge, { backgroundColor: hoursDisplay.bgColor }]}>
                  <View style={[styles.statusDot, { backgroundColor: hoursDisplay.color }]} />
                  <Text style={[styles.statusBadgeText, { color: hoursDisplay.color }]}>
                    {hoursDisplay.statusBadge}
                  </Text>
                </View>
              </View>

              <View style={styles.storeNameRow}>
                <Text style={styles.storeName} numberOfLines={1}>
                  {shopName}
                </Text>
                <Ionicons name="checkmark-circle" size={18} color="#22CC71" style={styles.verifiedBadge} />
              </View>

              {vendorProfile?.tagline ? (
                <Text style={styles.storeTagline} numberOfLines={1}>
                  {vendorProfile.tagline}
                </Text>
              ) : null}

              {/* STORE CLOSED BANNER */}
              {isStoreClosed && (
                <View style={styles.closedWarningBanner}>
                  <Ionicons name="information-circle" size={15} color="#EF4444" />
                  <Text style={styles.closedWarningText}>
                    Store is closed. Orders are currently unavailable.
                  </Text>
                </View>
              )}

              {/* STORE BUSY BANNER */}
              {isStoreBusy && (
                <View style={styles.busyWarningBanner}>
                  <Ionicons name="alert-circle" size={15} color="#F97316" />
                  <Text style={styles.busyWarningText}>
                    High order volume. Deliveries may take slightly longer.
                  </Text>
                </View>
              )}

              <View style={styles.cardDivider} />

              {/* METRICS ROW */}
              <View style={styles.metricsContainer}>
                <View style={styles.metricItem}>
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Text style={styles.metricItemText}>4.8</Text>
                </View>

                <View style={styles.metricDotSeparator} />

                <View style={styles.metricItem}>
                  <Ionicons name="time-outline" size={14} color="#64748B" />
                  <Text style={styles.metricItemText}>{prepTimeText}</Text>
                </View>

                {distanceText && (
                  <>
                    <View style={styles.metricDotSeparator} />
                    <View style={styles.metricItem}>
                      <Ionicons name="location-outline" size={14} color="#64748B" />
                      <Text style={styles.metricItemText}>{distanceText}</Text>
                    </View>
                  </>
                )}
              </View>

              <View style={styles.todayTimingsRow}>
                <Ionicons name="calendar-outline" size={13} color="#94A3B8" />
                <Text style={styles.todayTimingsText}>Today: {hoursDisplay.timeLabel}</Text>
              </View>
            </Animated.View>

            {/* STICKY/ROUNDED SEARCH BAR */}
            <View style={styles.searchContainer}>
              <View style={styles.searchInner}>
                <Ionicons name="search" size={18} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search products in store..."
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')} hitSlop={6}>
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </Pressable>
                )}
              </View>
            </View>

            {/* CATEGORY CHIPS */}
            {activeCategories.length > 0 && (
              <View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoriesList}
                >
                  <Pressable
                    onPress={() => handleCategorySelect(null)}
                    style={({ pressed }) => [
                      styles.chip,
                      selectedCategory === null ? styles.chipSelected : styles.chipInactive,
                      pressed && styles.chipPressed,
                    ]}
                  >
                    <Text style={[styles.chipText, selectedCategory === null && styles.chipTextSelected]}>
                      All Items
                    </Text>
                  </Pressable>

                  {activeCategories.map((cat) => {
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() => handleCategorySelect(cat.id)}
                        style={({ pressed }) => [
                          styles.chip,
                          isSelected ? styles.chipSelected : styles.chipInactive,
                          pressed && styles.chipPressed,
                        ]}
                      >
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {cat.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="basket-outline" size={44} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>No items found</Text>
            <Text style={styles.emptySubText}>
              Try searching for something else or pick another category.
            </Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const alreadyInCart = cartItems.some((c) => String(c.id) === String(item.id));
          return (
            <StaggeredProductCard
              item={item}
              index={index}
              isStoreClosed={isStoreClosed}
              alreadyInCart={alreadyInCart}
              onAddToCart={handleAddToCart}
            />
          );
        }}
      />

      {/* FLOATING CART BAR */}
      {cartItems.length > 0 && (
        <Animated.View
          style={[
            styles.floatingCartContainer,
            {
              transform: [{ translateY: cartSlideAnim }, { scale: cartBounceAnim }],
            },
          ]}
        >
          <Pressable
            onPress={() => {
              if (!isStoreClosed) {
                router.push('/cart');
              }
            }}
            disabled={isStoreClosed}
            style={({ pressed }) => [
              styles.floatingCartButton,
              isStoreClosed && styles.floatingCartDisabled,
              pressed && { opacity: 0.92 },
            ]}
          >
            <View style={styles.floatingCartLeft}>
              <View style={styles.cartIconWrapper}>
                <Ionicons name="bag" size={18} color={isStoreClosed ? '#94A3B8' : '#22CC71'} />
                <View style={styles.cartCountBadge}>
                  <Text style={styles.cartCountText}>{totalCartQuantity}</Text>
                </View>
              </View>
              <View>
                <Text style={styles.cartPriceText}>₹{totalCartPrice}</Text>
                <Text style={styles.cartSubText}>
                  {isStoreClosed ? 'Closed for ordering' : 'View cart & checkout'}
                </Text>
              </View>
            </View>

            <View style={styles.floatingCartRight}>
              <Text style={styles.viewCartText}>{isStoreClosed ? 'Closed' : 'View Cart'}</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
            </View>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  topSectionContainer: {
    backgroundColor: '#FAFAFA',
    marginBottom: 8,
  },

  // Carousel Container
  carouselContainer: {
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  bannerItemContainer: {
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerGradientOverlay: {
    ...StyleSheet.absoluteFill,
  },
  placeholderBannerContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
  },
  placeholderBannerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#FFFFFF33',
    marginBottom: 10,
  },
  placeholderBannerIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  placeholderBannerText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },

  // Header Actions
  bannerHeaderActions: {
    position: 'absolute',
    top: 44,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  bannerRightActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFFEE',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },

  // Pagination
  paginationContainer: {
    position: 'absolute',
    bottom: 28,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  paginationDot: {
    height: 6,
    borderRadius: 3,
  },
  paginationDotActive: {
    width: 18,
    backgroundColor: '#22CC71',
  },
  paginationDotInactive: {
    width: 6,
    backgroundColor: '#FFFFFF80',
  },

  // Profile Glass Card
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginHorizontal: 16,
    marginTop: -20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  avatarWrapper: {
    marginTop: -28,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#22CC71',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  storeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  storeName: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0D0D0D',
    letterSpacing: -0.3,
  },
  verifiedBadge: {
    marginLeft: 6,
  },
  storeTagline: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  closedWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    marginTop: 10,
  },
  closedWarningText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  busyWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    marginTop: 10,
  },
  busyWarningText: {
    color: '#9A3412',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  metricsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricItemText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  metricDotSeparator: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 10,
  },
  todayTimingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  todayTimingsText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },

  // Search Container
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#0D0D0D',
  },

  // Category Chips
  categoriesList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipSelected: {
    backgroundColor: '#22CC71',
    borderColor: '#22CC71',
  },
  chipInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  chipPressed: {
    opacity: 0.8,
  },
  chipText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 13,
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Products Grid
  productsList: {
    paddingBottom: 110,
  },
  rowWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 14,
    width: CARD_WIDTH,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  cardInnerPressable: {
    width: '100%',
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1.15,
    backgroundColor: '#F8FAFC',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stockDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  stockBadgeIn: {
    backgroundColor: '#E8FBF0',
  },
  stockBadgeLow: {
    backgroundColor: '#FFEDD5',
  },
  stockBadgeOut: {
    backgroundColor: '#FEE2E2',
  },
  stockStatusText: {
    fontSize: 9,
    fontWeight: '700',
  },
  discountBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#22CC71',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  cardContent: {
    padding: 10,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0D0D0D',
    lineHeight: 17,
    minHeight: 34,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 6,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D0D0D',
  },
  productMRP: {
    fontSize: 11,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  actionRow: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  addToCartButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#22CC71',
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderRadius: 10,
  },
  addToCartButtonText: {
    color: '#22CC71',
    fontSize: 12,
    fontWeight: '800',
  },
  outOfStockBtn: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  outOfStockBtnText: {
    color: '#94A3B8',
  },
  alreadyInCartBtn: {
    backgroundColor: '#22CC71',
    borderColor: '#22CC71',
  },
  alreadyInCartBtnText: {
    color: '#FFFFFF',
  },

  // Floating Cart Bar
  floatingCartContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    shadowColor: '#22CC71',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  floatingCartButton: {
    backgroundColor: '#22CC71',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 54,
  },
  floatingCartDisabled: {
    backgroundColor: '#94A3B8',
  },
  floatingCartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cartIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#0D0D0D',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartCountText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  cartPriceText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  cartSubText: {
    color: '#E8FBF0',
    fontSize: 10,
    fontWeight: '500',
  },
  floatingCartRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewCartText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Empty State
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0D0D0D',
  },
  emptySubText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },

  // Skeleton Loaders
  skeletonBanner: {
    width: '100%',
    height: BANNER_HEIGHT,
  },
  skeletonAvatar: {
    width: 58,
    height: 58,
    borderRadius: 16,
    marginTop: -20,
  },
  skeletonBadge: {
    width: 60,
    height: 20,
    borderRadius: 10,
  },
  skeletonTitle: {
    width: '60%',
    height: 20,
    borderRadius: 4,
    marginTop: 12,
  },
  skeletonSubTitle: {
    width: '40%',
    height: 14,
    borderRadius: 4,
    marginTop: 8,
  },
  skeletonMetrics: {
    width: '100%',
    height: 24,
    borderRadius: 6,
    marginTop: 12,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    gap: 12,
    justifyContent: 'space-between',
  },
  skeletonCard: {
    width: CARD_WIDTH,
    height: 220,
    borderRadius: 16,
  },
});