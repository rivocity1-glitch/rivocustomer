import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { addToCart, getCart, subscribeCart } from '../../lib/cart';
import { supabase } from '../../lib/supabase';

// --- TYPES ---
interface BusinessHoursDay {
  open?: string; // "09:00"
  close?: string; // "22:00"
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
const CARD_WIDTH = (SCREEN_WIDTH - 44) / 2;
const BANNER_HEIGHT = 220;

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

// --- BUSINESS HOURS TIME PARSER ---
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

/**
 * Reads vendor_profiles.business_hours and vendor_profiles.store_status
 * strictly displaying today's schedule and the 5 backend determined status badges:
 * Open, Busy, Closing Soon, Closed, Temporarily Closed (manual override)
 */
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
      timeLabel = `${format12Hour(todaySchedule.open)} – ${format12Hour(todaySchedule.close)}`;

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

  // 1. Temporarily Closed (Manual Override)
  if (manualOverride && rawStatus === 'closed') {
    return {
      statusBadge: '🔴 Temporarily Closed',
      timeLabel,
      color: '#EF4444',
    };
  }

  // 2. Closed
  if (rawStatus === 'closed') {
    return {
      statusBadge: '🔴 Closed',
      timeLabel,
      color: '#EF4444',
    };
  }

  // 3. High Volume / Busy
  if (rawStatus === 'busy') {
    return {
      statusBadge: '🟠 Busy (High Volume)',
      timeLabel,
      color: '#F97316',
    };
  }

  // 4. Closing Soon
  if (isClosingSoon) {
    return {
      statusBadge: '🟠 Closing Soon',
      timeLabel,
      color: '#F97316',
    };
  }

  // 5. Open
  return {
    statusBadge: '🟢 Open Now',
    timeLabel,
    color: '#22CC71',
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

// --- VERTICAL SLIDESHOW BANNER CAROUSEL ---
const VerticalBannerSlideshow = React.memo(({ banners }: { banners: string[] }) => {
  const totalBanners = banners.length;

  // Single Banner Case: Static View
  if (totalBanners <= 1) {
    return (
      <View style={styles.carouselContainer}>
        <Image
          source={{ uri: banners[0] || 'https://via.placeholder.com/800x400/0F172A/FFFFFF?text=Store' }}
          style={styles.bannerImage}
          resizeMode="cover"
        />
        <View style={styles.bannerGradientOverlay} />
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={20} color="#0D0D0D" />
        </Pressable>
      </View>
    );
  }

  const [currentIndex, setCurrentIndex] = useState(0);
  const [imagesReady, setImagesReady] = useState(false);

  const animValue = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nextIndex = (currentIndex + 1) % totalBanners;

  // Preload Images First
  useEffect(() => {
    let isMounted = true;
    console.log('Banner Count:', banners.length);
    console.log('Banner URLs:', banners);

    setImagesReady(false);
    Promise.all(banners.map((url) => Image.prefetch(url)))
      .then(() => {
        if (isMounted) setImagesReady(true);
      })
      .catch((err) => {
        console.error('Error preloading banner images:', err);
        if (isMounted) setImagesReady(true);
      });

    return () => {
      isMounted = false;
    };
  }, [banners]);

  // Reset Slideshow when banners array changes dynamically
  useEffect(() => {
    setCurrentIndex(0);
    animValue.setValue(0);
    isAnimating.current = false;
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [banners, animValue]);

  // Infinite Autoplay Loop Sequence
  useEffect(() => {
    if (!imagesReady || totalBanners <= 1) return;

    timerRef.current = setTimeout(() => {
      if (isAnimating.current) return;
      isAnimating.current = true;

      animValue.setValue(0);
      Animated.timing(animValue, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setCurrentIndex((prev) => (prev + 1) % totalBanners);
          animValue.setValue(0);
          isAnimating.current = false;
        }
      });
    }, 3500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, imagesReady, totalBanners, animValue]);

  const currentTranslateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -BANNER_HEIGHT],
  });

  const currentOpacity = animValue.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [1, 0.3, 0],
  });

  const nextTranslateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [BANNER_HEIGHT, 0],
  });

  const nextOpacity = animValue.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 0.7, 1],
  });

  return (
    <View style={styles.carouselContainer}>
      {/* Active Exiting Banner */}
      <Animated.View
        style={[
          styles.bannerSlideAbsolute,
          {
            transform: [{ translateY: currentTranslateY }],
            opacity: currentOpacity,
          },
        ]}
      >
        <Image
          source={{ uri: banners[currentIndex] }}
          style={styles.bannerImage}
          resizeMode="cover"
        />
        <View style={styles.bannerGradientOverlay} />
      </Animated.View>

      {/* Incoming Target Banner */}
      <Animated.View
        style={[
          styles.bannerSlideAbsolute,
          {
            transform: [{ translateY: nextTranslateY }],
            opacity: nextOpacity,
          },
        ]}
      >
        <Image
          source={{ uri: banners[nextIndex] }}
          style={styles.bannerImage}
          resizeMode="cover"
        />
        <View style={styles.bannerGradientOverlay} />
      </Animated.View>

      {/* Back Button */}
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={20} color="#0D0D0D" />
      </Pressable>
    </View>
  );
});

// --- STAGGERED PRODUCT CARD WITH PRESS FEEDBACK & AVAILABILITY CONTROLS ---
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
  const translateYAnim = useRef(new Animated.Value(24)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  const stockVal = item.stock != null ? Number(item.stock) : 0;
  const isOutOfStock = stockVal === 0;
  const isLowStock = stockVal > 0 && stockVal <= 5;

  const showMRP = item.mrp && item.mrp > item.price;
  const discountPercent = showMRP
    ? Math.round(((item.mrp! - item.price) / item.mrp!) * 100)
    : 0;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        delay: Math.min(index * 60, 300),
        useNativeDriver: true,
      }),
      Animated.spring(translateYAnim, {
        toValue: 0,
        delay: Math.min(index * 60, 300),
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, translateYAnim, index]);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  const handleAddPress = () => {
    if (isOutOfStock || isStoreClosed) return;
    if (alreadyInCart) {
      router.push('/cart');
    } else {
      Animated.sequence([
        Animated.timing(buttonScale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
        Animated.spring(buttonScale, { toValue: 1, friction: 3, tension: 40, useNativeDriver: true }),
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
          transform: [{ translateY: translateYAnim }, { scale: pressScale }],
        },
      ]}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
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
              <Ionicons name="image-outline" size={32} color="#94A3B8" />
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
            <Ionicons
              name={isOutOfStock ? 'close-circle' : isLowStock ? 'alert-circle' : 'checkmark-circle'}
              size={10}
              color={isOutOfStock ? '#EF4444' : isLowStock ? '#F97316' : '#22CC71'}
            />
            <Text
              style={[
                styles.stockStatusText,
                {
                  color: isOutOfStock
                    ? '#EF4444'
                    : isLowStock
                    ? '#F97316'
                    : '#22CC71',
                },
              ]}
            >
              {isOutOfStock ? 'Out of Stock' : isLowStock ? `Only ${stockVal} left` : 'In Stock'}
            </Text>
          </View>

          {/* Discount Tag */}
          {showMRP && discountPercent > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{discountPercent}% OFF</Text>
            </View>
          )}
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
                ? 'VIEW CART'
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

  // Screen Entrance Animations
  const bannerTranslateY = useRef(new Animated.Value(-60)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const searchOpacity = useRef(new Animated.Value(0)).current;
  const categoriesTranslateX = useRef(new Animated.Value(-40)).current;
  const categoriesOpacity = useRef(new Animated.Value(0)).current;
  const productsListOpacity = useRef(new Animated.Value(1)).current;

  // Search Focus Expansion Animations
  const searchWidthAnim = useRef(new Animated.Value(1)).current;
  const searchBorderColor = useRef(new Animated.Value(0)).current;

  // Floating Cart Animations
  const cartSlideAnim = useRef(new Animated.Value(120)).current;
  const cartBounceAnim = useRef(new Animated.Value(1)).current;

  const prevCartCount = useRef(cartItems.length);

  // --- REALTIME SUPABASE SUBSCRIPTION ---
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

  useEffect(() => {
    const unsubscribe = subscribeCart(() => {
      const newCart = getCart();
      const newCount = newCart.length;

      setCartItems([...newCart]);

      if (prevCartCount.current === 0 && newCount > 0) {
        Animated.spring(cartSlideAnim, {
          toValue: 0,
          friction: 6,
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
          Animated.spring(cartBounceAnim, { toValue: 1.08, useNativeDriver: true, speed: 20 }),
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
        triggerEntranceAnimations();
      }
    }

    fetchData();
  }, [vendorId]);

  const triggerEntranceAnimations = () => {
    Animated.stagger(100, [
      Animated.timing(bannerTranslateY, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(searchOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(categoriesOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(categoriesTranslateX, {
          toValue: 0,
          friction: 6,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

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

    if (bannerList.length === 0) {
      bannerList.push('https://via.placeholder.com/800x400/0F172A/FFFFFF?text=Store');
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

    if (bannerList.length === 0) {
      bannerList.push('https://via.placeholder.com/800x400/0F172A/FFFFFF?text=Store');
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
      if (authError || !authData?.user) {
        console.error('User is not logged in or auth error occurred:', authError);
        return;
      }

      const user = authData.user;

      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (customerError || !customer) {
        console.error('Customer record is missing or query failed:', customerError);
        return;
      }

      const { data: addressData, error: addressError } = await supabase
        .from('customer_addresses')
        .select('latitude, longitude')
        .eq('customer_id', customer.id)
        .eq('is_default', true)
        .maybeSingle();

      if (addressError || !addressData) {
        console.error('Default customer address is missing or query failed:', addressError);
        return;
      }

      if (addressData.latitude == null || addressData.longitude == null) {
        console.error('Customer address latitude or longitude is null:', addressData);
        return;
      }

      setCustomerCoords({
        latitude: Number(addressData.latitude),
        longitude: Number(addressData.longitude),
      });
    } catch (err) {
      console.error('Unexpected error in fetchCustomerAddress:', err);
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
      return `${dist.toFixed(1)} km away`;
    }
    return 'Distance unavailable';
  }, [customerCoords, vendorProfile]);

  const deliveryRadiusText = useMemo(() => {
    if (vendorProfile?.delivery_radius_km != null) {
      return `${vendorProfile.delivery_radius_km} km radius`;
    }
    return null;
  }, [vendorProfile]);

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
    return 'Time unavailable';
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
      toValue: 0.2,
      duration: 100,
      useNativeDriver: true,
    }).start(() => {
      setSelectedCategory(catId);
      Animated.timing(productsListOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleSearchFocus = () => {
    Animated.parallel([
      Animated.spring(searchWidthAnim, { toValue: 1.02, useNativeDriver: true }),
      Animated.timing(searchBorderColor, { toValue: 1, duration: 200, useNativeDriver: false }),
    ]).start();
  };

  const handleSearchBlur = () => {
    Animated.parallel([
      Animated.spring(searchWidthAnim, { toValue: 1, useNativeDriver: true }),
      Animated.timing(searchBorderColor, { toValue: 0, duration: 200, useNativeDriver: false }),
    ]).start();
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

  const interpolatedBorderColor = searchBorderColor.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E2E8F0', '#22CC71'],
  });

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
            {/* HERO BANNER VERTICAL SLIDESHOW */}
            <Animated.View style={{ transform: [{ translateY: bannerTranslateY }] }}>
              <VerticalBannerSlideshow banners={banners} />
            </Animated.View>

            {/* STORE HEADER */}
            <Animated.View style={[styles.profileCard, { opacity: headerOpacity }]}>
              <View style={styles.avatarRow}>
                {vendorProfile?.avatar_url ? (
                  <Image source={{ uri: vendorProfile.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>{shopName.charAt(0).toUpperCase()}</Text>
                  </View>
                )}

                <View style={[styles.statusBadge, { backgroundColor: hoursDisplay.color + '1A' }]}>
                  <Text style={[styles.statusBadgeText, { color: hoursDisplay.color }]}>
                    {hoursDisplay.statusBadge}
                  </Text>
                </View>
              </View>

              <Text style={styles.storeName}>{shopName}</Text>

              {vendorProfile?.tagline ? (
                <Text style={styles.storeTagline}>{vendorProfile.tagline}</Text>
              ) : null}

              {/* STORE CLOSED BANNER */}
              {isStoreClosed && (
                <View style={styles.closedWarningBanner}>
                  <Ionicons name="information-circle" size={16} color="#EF4444" />
                  <Text style={styles.closedWarningText}>
                    Store is currently closed. Orders cannot be placed at this time.
                  </Text>
                </View>
              )}

              {/* STORE BUSY BANNER */}
              {isStoreBusy && (
                <View style={styles.busyWarningBanner}>
                  <Ionicons name="alert-circle" size={16} color="#F97316" />
                  <Text style={styles.busyWarningText}>
                    Store is experiencing high order volume. Deliveries might take longer.
                  </Text>
                </View>
              )}

              {/* DETAILED BUSINESS HOURS AND METRICS */}
              <View style={styles.metricsPillsGrid}>
                <View style={[styles.businessHoursPill, { borderColor: hoursDisplay.color + '33' }]}>
                  <Ionicons name="time-outline" size={16} color={hoursDisplay.color} />
                  <View style={{ flexShrink: 1 }}>
                    <Text style={styles.businessHoursDay}>Today's Hours</Text>
                    <Text style={styles.businessHoursTime}>{hoursDisplay.timeLabel}</Text>
                  </View>
                </View>

                <View style={styles.metricPill}>
                  <Ionicons name="location-outline" size={14} color="#22CC71" />
                  <Text style={styles.metricPillText}>{distanceText}</Text>
                </View>

                <View style={styles.metricPill}>
                  <Ionicons name="flash-outline" size={14} color="#22CC71" />
                  <Text style={styles.metricPillText}>{prepTimeText}</Text>
                </View>

                {vendorProfile?.minimum_order != null && (
                  <View style={styles.metricPill}>
                    <MaterialCommunityIcons name="shopping-outline" size={14} color="#22CC71" />
                    <Text style={styles.metricPillText}>Min order ₹{vendorProfile.minimum_order}</Text>
                  </View>
                )}

                {deliveryRadiusText && (
                  <View style={styles.metricPill}>
                    <Ionicons name="bicycle-outline" size={14} color="#22CC71" />
                    <Text style={styles.metricPillText}>{deliveryRadiusText}</Text>
                  </View>
                )}
              </View>
            </Animated.View>

            {/* SEARCH BAR */}
            <Animated.View
              style={[
                styles.searchContainer,
                { opacity: searchOpacity, transform: [{ scale: searchWidthAnim }] },
              ]}
            >
              <Animated.View style={[styles.searchInner, { borderColor: interpolatedBorderColor }]}>
                <Ionicons name="search" size={18} color="#94A3B8" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search products in store..."
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onFocus={handleSearchFocus}
                  onBlur={handleSearchBlur}
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </Pressable>
                )}
              </Animated.View>
            </Animated.View>

            {/* CATEGORY CHIPS */}
            {activeCategories.length > 0 && (
              <Animated.View
                style={{
                  opacity: categoriesOpacity,
                  transform: [{ translateX: categoriesTranslateX }],
                }}
              >
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoriesList}
                >
                  <Pressable
                    onPress={() => handleCategorySelect(null)}
                    style={[styles.chip, selectedCategory === null && styles.chipSelected]}
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
                        style={[styles.chip, isSelected && styles.chipSelected]}
                      >
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {cat.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </Animated.View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="basket-outline" size={48} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>No products available</Text>
            <Text style={styles.emptySubText}>
              This store hasn't added any products matching your criteria yet.
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

      {/* FLOATING CART SUMMARY */}
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
            style={[styles.floatingCartButton, isStoreClosed && styles.floatingCartDisabled]}
          >
            <View style={styles.floatingCartLeft}>
              <View style={styles.cartIconWrapper}>
                <Ionicons name="cart" size={20} color={isStoreClosed ? '#94A3B8' : '#22CC71'} />
                <View style={styles.cartCountBadge}>
                  <Text style={styles.cartCountText}>{totalCartQuantity}</Text>
                </View>
              </View>
              <View>
                <Text style={styles.cartPriceText}>₹{totalCartPrice}</Text>
                <Text style={styles.cartSubText}>
                  {isStoreClosed ? 'Checkout disabled while closed' : 'Extra charges may apply'}
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
    backgroundColor: '#FFFFFF',
  },
  topSectionContainer: {
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },

  // Carousel Container & Slides
  carouselContainer: {
    width: '100%',
    height: BANNER_HEIGHT,
    position: 'relative',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  bannerSlideAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: SCREEN_WIDTH,
    height: BANNER_HEIGHT,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerGradientOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  backButton: {
    position: 'absolute',
    top: 44,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 10,
  },

  // Store Profile
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    marginHorizontal: 16,
    marginTop: -32,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F7F8FA',
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
    fontWeight: '900',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  storeName: {
    fontSize: 21,
    fontWeight: '900',
    color: '#0D0D0D',
    marginTop: 10,
    letterSpacing: -0.3,
  },
  storeTagline: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },

  // Banners for Availability State
  closedWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 10,
  },
  closedWarningText: {
    color: '#991B1B',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  busyWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 10,
  },
  busyWarningText: {
    color: '#9A3412',
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },

  // Metrics Pills Grid
  metricsPillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  businessHoursPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    width: '100%',
  },
  businessHoursDay: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0D0D0D',
  },
  businessHoursTime: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  metricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    gap: 5,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  metricPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },

  // Search
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#0D0D0D',
  },

  // Categories
  categoriesList: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipSelected: {
    backgroundColor: '#22CC71',
    borderColor: '#22CC71',
  },
  chipText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 12,
  },
  chipTextSelected: {
    color: '#FFFFFF',
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
    marginBottom: 16,
    width: CARD_WIDTH,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    justifyContent: 'space-between',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
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
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stockBadgeIn: {
    backgroundColor: '#E8FBF0',
  },
  stockBadgeLow: {
    backgroundColor: '#FFF3E0',
  },
  stockBadgeOut: {
    backgroundColor: '#FEE2E2',
  },
  stockStatusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  discountBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
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
    fontWeight: '700',
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
    fontWeight: '900',
    color: '#0D0D0D',
  },
  productMRP: {
    fontSize: 11,
    color: '#94A3B8',
    textDecorationLine: 'line-through',
    fontWeight: '600',
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
    borderColor: '#CBD5E1',
  },
  outOfStockBtnText: {
    color: '#94A3B8',
  },
  alreadyInCartBtn: {
    backgroundColor: '#E8FBF0',
    borderColor: '#22CC71',
  },
  alreadyInCartBtnText: {
    color: '#22CC71',
  },

  // Floating Cart
  floatingCartContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    shadowColor: '#22CC71',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
  floatingCartButton: {
    backgroundColor: '#22CC71',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 56,
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
    width: 36,
    height: 36,
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
    backgroundColor: '#0F172A',
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
    fontWeight: '900',
  },
  cartPriceText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
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
    fontWeight: '800',
  },

  // Empty State
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F8FAFC',
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

  // Skeleton
  skeletonBanner: {
    width: '100%',
    height: BANNER_HEIGHT,
  },
  skeletonAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
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
    height: 32,
    borderRadius: 8,
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