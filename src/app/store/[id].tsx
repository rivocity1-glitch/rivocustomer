import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Dimensions, FlatList, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { addToCart, getCart, subscribeCart } from '../../lib/cart';
import { supabase } from '../../lib/supabase';

interface VendorData {
  avatar_url?: string | null;
  vendors?: {
    shop_name: string;
  } | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  category_id?: string;
  stock_status?: string;
  stock?: number;
}

interface CategoryRow {
  id: string;
  name: string;
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 44) / 2; 

export default function StoreScreen() {
  const { id } = useLocalSearchParams();
  const [vendor, setVendor] = useState<VendorData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState(getCart());
  const [loadingData, setLoadingData] = useState(true);

  const vendorId = Array.isArray(id) ? id[0] : id;

  useEffect(() => {
    if (vendorId) {
      loadInitialData();
    } else {
      setLoadingData(false);
    }
  }, [vendorId]);

  useEffect(() => {
    const unsubscribe = subscribeCart(() => {
      setCartItems([...getCart()]);
    });
    return unsubscribe;
  }, []);

  async function loadInitialData() {
    try {
      setLoadingData(true);
      await Promise.all([
        loadVendorData(),
        loadCategoriesAndProducts()
      ]);
    } catch (err) {
      console.error('Error in concurrent data fetch operations:', err);
    } finally {
      setLoadingData(false);
    }
  }

  async function loadVendorData() {
    // Look up via vendor_id to retrieve the proper associated metadata link
    const { data, error } = await supabase
      .from('vendor_profiles')
      .select('avatar_url, vendors(shop_name)')
      .eq('vendor_id', vendorId);

    if (!error && data && data.length > 0) {
      setVendor(data[0] as any);
    } else if (error) {
      console.error('loadVendorData Query Exception:', error.message);
    }
  }

  async function loadCategoriesAndProducts() {
    const { data: catData, error: catError } = await supabase
      .from('product_categories')
      .select('id, name');

    const map: Record<string, string> = {};
    if (!catError && catData) {
      (catData as CategoryRow[]).forEach((cat) => {
        map[cat.id] = cat.name;
      });
      setCategoryMap(map);
    }

    const { data: prodData, error: prodError } = await supabase
      .from('products')
      .select('*')
      .eq('vendor_id', vendorId)
      .eq('status', 'active');

    if (!prodError && prodData) {
      setProducts(prodData);
    }
  }

  const uniqueCategories = useMemo(() => {
    const unique = new Set<string>();
    products.forEach((p) => {
      if (p.category_id && categoryMap[p.category_id]) {
        unique.add(categoryMap[p.category_id]);
      }
    });
    return Array.from(unique);
  }, [products, categoryMap]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const productCategoryName = product.category_id ? categoryMap[product.category_id] : null;
      const matchesCategory = selectedCategory ? productCategoryName === selectedCategory : true;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory, categoryMap]);

  const getInitials = (name?: string) => {
    if (!name) return 'ST';
    return name
      .split(' ')
      .filter(Boolean)
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getFirstLetter = (name?: string) => {
    if (!name) return '?';
    return name.trim().charAt(0).toUpperCase();
  };

  const shopName = vendor?.vendors?.shop_name;

  const totalCartQuantity = useMemo(() => {
    return cartItems.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
  }, [cartItems]);

  const totalCartPrice = useMemo(() => {
    return cartItems.reduce((acc, curr) => acc + (curr.price * (curr.quantity || 0)), 0);
  }, [cartItems]);

  if (loadingData) {
    return (
      <View style={styles.container}>
        <View style={[styles.bannerWrapper, { backgroundColor: '#F1F5F9' }]}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </Pressable>
        </View>
        <View style={[styles.profileCard, { alignItems: 'center', justifyContent: 'center', minHeight: 120 }]}>
          <ActivityIndicator size="large" color="#22CC71" />
          <Text style={{ marginTop: 10, color: '#64748B', fontWeight: '600', fontSize: 13 }}>
            Connecting securely to store...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        key="2-columns"
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.rowWrapper}
        contentContainerStyle={styles.productsList}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.topSectionContainer}>
            {/* LARGE HERO STORE BANNER */}
            <View style={styles.bannerWrapper}>
              <Image 
                source={{ uri: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1000&auto=format&fit=crop' }} 
                style={styles.bannerImage}
              />
              <View style={styles.bannerOverlay} />
              
              <Pressable onPress={() => router.back()} style={styles.backButton}>
                <Text style={styles.backButtonText}>←</Text>
              </Pressable>
            </View>

            {/* STORE PROFILE METADATA BLOCK */}
            <View style={styles.profileCard}>
              <View style={styles.avatarRow}>
                {vendor?.avatar_url ? (
                  <Image source={{ uri: vendor.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>{getInitials(shopName || 'Store')}</Text>
                  </View>
                )}
                
                <View style={styles.badgeRow}>
                  <View style={styles.openBadge}>
                    <Text style={styles.openBadgeText}>● OPEN</Text>
                  </View>
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingBadgeText}>★ 4.8</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.storeName}>{shopName || 'Marketplace Store'}</Text>
              
              <View style={styles.storeMetricsRow}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricIcon}>⚡</Text>
                  <Text style={styles.metricText}>10-15 mins</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={styles.metricIcon}>📍</Text>
                  <Text style={styles.metricText}>1.8 km nearby</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <Text style={styles.metricIcon}>💰</Text>
                  <Text style={styles.metricText}>Offers Active</Text>
                </View>
              </View>
            </View>

            {/* SEARCH BAR */}
            <View style={styles.searchContainer}>
              <View style={styles.searchInner}>
                <Text style={styles.searchIcon}>🔍</Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder={`Search items in store...`}
                  placeholderTextColor="#94A3B8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>

            {/* CATEGORY FILTER CHIPS */}
            {uniqueCategories.length > 0 && (
              <View style={styles.categoriesStickyWrapper}>
                <FlatList
                  data={[null, ...uniqueCategories]}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(item, index) => index.toString()}
                  contentContainerStyle={styles.categoriesList}
                  renderItem={({ item }) => {
                    const isSelected = selectedCategory === item;
                    return (
                      <Pressable
                        onPress={() => setSelectedCategory(item)}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                      >
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {item === null ? 'All Items' : item}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📦</Text>
            <Text style={styles.emptyStateText}>No items matched this filter criteria.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const stockValue = item.stock !== undefined ? Number(item.stock) : 6;
          const isOutOfStock = stockValue === 0;
          const alreadyInCart = cartItems.some(
            (cartItem) => String(cartItem.id) === String(item.id)
          );

          let stockLabel = 'In Stock';
          let stockBg = '#22CC7112';
          let stockColor = '#22CC71';

          if (stockValue === 0) {
            stockLabel = 'Out of Stock';
            stockBg = '#EF444412';
            stockColor = '#EF4444';
          } else if (stockValue >= 1 && stockValue <= 5) {
            stockLabel = `${stockValue} Left`;
            stockBg = '#F9731612';
            stockColor = '#F97316';
          }

          let buttonText = 'ADD';
          if (isOutOfStock) {
            buttonText = 'SOLD OUT';
          } else if (alreadyInCart) {
            buttonText = 'VIEW CART';
          }

          const handleButtonPress = () => {
            if (isOutOfStock) return;
            if (alreadyInCart) {
              router.push('/cart');
            } else {
              addToCart(item);
            }
          };

          return (
            <Pressable
              style={styles.card}
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
                    <Text style={styles.productImagePlaceholderText}>{getFirstLetter(item.name)}</Text>
                  </View>
                )}

                <View style={[styles.stockBadge, { backgroundColor: stockBg }]}>
                  <Text style={[styles.stockStatus, { color: stockColor }]}>{stockLabel}</Text>
                </View>
              </View>

              <View style={styles.cardContent}>
                <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.productPrice}>₹{item.price}</Text>
                </View>
              </View>

              <View style={styles.actionRow}>
                <Pressable 
                  style={[
                    styles.addToCartButton, 
                    isOutOfStock && styles.outOfStockBtn,
                    alreadyInCart && styles.alreadyInCartBtn
                  ]} 
                  onPress={handleButtonPress}
                  disabled={isOutOfStock}
                >
                  <Text style={[
                    styles.addToCartButtonText,
                    isOutOfStock && styles.outOfStockBtnText,
                    alreadyInCart && styles.alreadyInCartBtnText
                  ]}>
                    {buttonText}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          );
        }}
      />

      {/* FLOATING CART SUMMARY */}
      {cartItems.length > 0 && (
        <View style={styles.floatingCartContainer}>
          <Pressable onPress={() => router.push('/cart')} style={styles.floatingCartButton}>
            <View style={styles.floatingCartLeft}>
              <View style={styles.cartCountBadge}>
                <Text style={styles.cartCountText}>{totalCartQuantity}</Text>
              </View>
              <View>
                <Text style={styles.cartPriceText}>₹{totalCartPrice}</Text>
                <Text style={styles.cartSubText}>Extra charges may apply</Text>
              </View>
            </View>
            <View style={styles.floatingCartRight}>
              <Text style={styles.viewCartText}>View Cart</Text>
              <Text style={styles.viewCartArrow}>➔</Text>
            </View>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topSectionContainer: {
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
  },
  bannerWrapper: {
    width: '100%',
    height: 150,
    position: 'relative',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  backButton: {
    position: 'absolute',
    top: 44,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  backButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0D0D0D',
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginHorizontal: 16,
    marginTop: -40,
    padding: 16,
    shadowColor: '#0D0D0D',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
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
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F7F8FA',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#22CC71',
  },
  avatarText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '900',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  openBadge: {
    backgroundColor: '#E8FBF0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  openBadgeText: {
    color: '#22CC71',
    fontSize: 10,
    fontWeight: '800',
  },
  ratingBadge: {
    backgroundColor: '#FFF8E7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ratingBadgeText: {
    color: '#FFB800',
    fontSize: 10,
    fontWeight: '800',
  },
  storeName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0D0D0D',
    letterSpacing: -0.5,
    marginTop: 10,
  },
  storeMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: '#F7F8FA',
    padding: 10,
    borderRadius: 14,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricIcon: {
    fontSize: 12,
  },
  metricText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  metricDivider: {
    width: 1,
    height: 12,
    backgroundColor: '#CBD5E1',
    marginHorizontal: 12,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F8FA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EAEFF3',
    paddingHorizontal: 14,
  },
  searchIcon: {
    fontSize: 15,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '500',
    color: '#0D0D0D',
  },
  categoriesStickyWrapper: {
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  categoriesList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: '#EAEFF3',
  },
  chipSelected: {
    backgroundColor: '#22CC71',
    borderColor: '#22CC71',
  },
  chipText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13,
  },
  chipTextSelected: {
    color: '#FFF',
  },
  productsList: {
    paddingBottom: 110,
  },
  rowWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    marginBottom: 16,
    width: CARD_WIDTH,
    minHeight: 280,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    justifyContent: 'space-between',
    shadowColor: '#0D0D0D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1.1,
    backgroundColor: '#F7F8FA',
    overflow: 'hidden',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImagePlaceholderText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#64748B',
  },
  stockBadge: {
    position: 'absolute',
    bottom: 6,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  stockStatus: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  cardContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D0D0D',
    lineHeight: 18,
    minHeight: 36,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0D0D0D',
  },
  actionRow: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  addToCartButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#22CC71',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderRadius: 12,
  },
  addToCartButtonText: {
    color: '#22CC71',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  outOfStockBtn: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  outOfStockBtnText: {
    color: '#94A3B8',
  },
  alreadyInCartBtn: {
    backgroundColor: '#A8E63A15',
    borderColor: '#A8E63A',
  },
  alreadyInCartBtnText: {
    color: '#22CC71',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    width: '100%',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 4,
  },
  emptyStateText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  floatingCartContainer: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    shadowColor: '#22CC71',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  floatingCartButton: {
    backgroundColor: '#22CC71',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  floatingCartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cartCountBadge: {
    backgroundColor: '#FFFFFF',
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartCountText: {
    color: '#22CC71',
    fontSize: 12,
    fontWeight: '900',
  },
  cartPriceText: {
    color: '#FFFFFF',
    fontSize: 16,
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
    fontSize: 15,
    fontWeight: '800',
  },
  viewCartArrow: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});