import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addToCart, cart } from '../../lib/cart';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');

function parseProductImages(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string' && !!item);
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string' && !!item);
  } catch {}
  return [value];
}

export default function ProductScreen() {
  const { id } = useLocalSearchParams();
  const [product, setProduct] = useState<any>(null);
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);
  const [isInCart, setIsInCart] = useState<boolean>(false);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    loadProduct();
  }, [id]);

  useEffect(() => {
    if (product) checkCartStatus();
  }, [product]);

  async function loadProduct() {
    const productId = Array.isArray(id) ? id[0] : id;
    const { data, error } = await supabase.from('products').select('*').eq('id', productId);
    if (!error && data && data.length > 0) {
      const currentProduct = data[0];
      setProduct(currentProduct);
      setImageIndex(0);
      if (currentProduct.vendor_id) {
        const { data: relatedData, error: relatedError } = await supabase
          .from('products').select('*').eq('vendor_id', currentProduct.vendor_id)
          .eq('status', 'active').neq('id', productId).limit(10);
        if (!relatedError && relatedData) setRelatedProducts(relatedData);
      }
    }
  }

  function checkCartStatus() {
    try {
      const productId = Array.isArray(id) ? id[0] : id;
      setIsInCart(cart.some((item: any) => String(item.id) === String(productId)));
    } catch (e) {
      console.error('Error checking cart status:', e);
    }
  }

  if (!product) return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#22CC71" />
      <Text style={styles.loadingText}>Loading details...</Text>
    </View>
  );

  const sellingPrice = Number(product.price ?? 0);
  const actualMrp = Number(product.mrp ?? sellingPrice);
  const totalSavings = Math.max(0, actualMrp - sellingPrice);
  const daysLeft = product.expiry_date
    ? Math.ceil((new Date(product.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const images = parseProductImages(product.image_url);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.navHeader}>
          <Pressable onPress={() => router.back()} style={styles.backIconButton}><Text style={styles.backIconText}>←</Text></Pressable>
          <Text style={styles.navTitle} numberOfLines={1}>{product.name}</Text>
        </View>

        <View style={styles.imageContainer}>
          {images.length > 0 ? (
            <>
              <ScrollView
                horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={event => setImageIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
                style={styles.imageGalleryScroll}
              >
                {images.map((imageUrl, index) => (
                  <View key={`${imageUrl}-${index}`} style={styles.imageSlide}>
                    <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="contain" />
                  </View>
                ))}
              </ScrollView>
              {images.length > 1 && (
                <View style={styles.imageDotsRow}>
                  {images.map((_, index) => (
                    <View key={index} style={[styles.imageDot, index === imageIndex && styles.imageDotActive]} />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.fallbackGraphic}><Text style={styles.fallbackLetter}>{product.name?.charAt(0).toUpperCase() || 'P'}</Text></View>
          )}
        </View>

        <View style={styles.metaMainCard}>
          <View style={styles.badgeLineRow}>
            <View style={[styles.stockStatusBadgeContainer, { backgroundColor: product.stock === 0 ? '#EF444415' : product.stock <= 5 ? '#F9731615' : '#22CC7115' }]}>
              <Text style={[styles.stockStatusBadgeText, { color: product.stock === 0 ? '#EF4444' : product.stock <= 5 ? '#F97316' : '#22CC71' }]}>
                {product.stock === 0 ? '• Out of Stock' : product.stock <= 5 ? `• Only ${product.stock} Left` : '• In Stock'}
              </Text>
            </View>
            <View style={styles.deliverySpeedBadge}><Text style={styles.deliverySpeedText}>⚡ 10 MINS</Text></View>
          </View>
          <Text style={styles.productTitleText}>{product.name}</Text>
          <Text style={styles.quantityMetricLabel}>Per Unit Pricing Weight</Text>
          <View style={styles.pricingLayoutBlock}>
            <View style={styles.priceContainerRow}><Text style={styles.currentPriceLabel}>₹{sellingPrice}</Text><Text style={styles.mrpLabel}>MRP ₹{actualMrp}</Text></View>
            <View style={styles.savingsBoxTag}><Text style={styles.savingsBoxText}>{totalSavings > 0 ? `Save ₹${totalSavings}` : 'Best Price'}</Text></View>
          </View>
        </View>

        {product.expiry_date && (
          <View style={styles.expiryAlertCard}><View style={styles.expiryLeftBlock}><Text style={styles.expiryCalendarIcon}>📅</Text><View><Text style={styles.expiryTitleLabel}>Expiry Timeline Information</Text><Text style={styles.expiryDetailText}>Best Before: {product.expiry_date}</Text></View></View>{daysLeft !== null && <View style={styles.daysCounterBadge}><Text style={styles.daysCounterText}>{daysLeft} days left</Text></View>}</View>
        )}

        <View style={styles.contentDataSectionCard}><Text style={styles.sectionHeadingText}>Product Details</Text><Text style={styles.bodyDescriptionParagraph}>{product.description || 'No specific description available.'}</Text></View>
        <View style={styles.contentDataSectionCard}>
          <Text style={styles.sectionHeadingText}>Product Information</Text>
          <View style={styles.infoGridRow}><Text style={styles.infoGridLabel}>Item ID Code</Text><Text style={styles.infoGridValue}>#RIV-{product.id?.slice(0, 8).toUpperCase()}</Text></View>
          <View style={styles.infoGridSeparator} />
          <View style={styles.infoGridRow}><Text style={styles.infoGridLabel}>Storage Condition</Text><Text style={styles.infoGridValue}>Cool and dry place</Text></View>
          <View style={styles.infoGridSeparator} />
          <View style={styles.infoGridRow}><Text style={styles.infoGridLabel}>Disclaimer</Text><Text style={styles.infoGridValueFallback}>Every effort is made to maintain accuracy.</Text></View>
        </View>

        {relatedProducts.length > 0 && <View style={styles.relatedProductsWrapper}><Text style={styles.sectionHeadingText}>More from this store</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedScrollContent}>{relatedProducts.map(item => <Pressable key={item.id} onPress={() => router.push(`/product/${item.id}`)} style={styles.placeholderRelatedCard}><View style={styles.placeholderMiniImage}>{parseProductImages(item.image_url)[0] ? <Image source={{ uri: parseProductImages(item.image_url)[0] }} style={styles.relatedProductMiniImage} resizeMode="contain" /> : <Text style={styles.placeholderBoxIcon}>📦</Text>}</View><Text style={styles.placeholderCardTitle} numberOfLines={1}>{item.name}</Text><Text style={styles.placeholderCardPrice}>₹{item.price}</Text></Pressable>)}</ScrollView></View>}
      </ScrollView>

      <View style={styles.stickyActionFooterBar}><View style={styles.footerPricingDisplayArea}><Text style={styles.footerTotalPriceText}>₹{sellingPrice}</Text><Text style={styles.footerMutedSubtitle}>Inclusive of standard retail taxes</Text></View><Pressable disabled={product.stock === 0} onPress={() => { if (!isInCart) addToCart(product); router.replace('/cart'); }} style={[styles.primaryActionButton, product.stock === 0 ? styles.disabledStateButton : styles.activeStateButton]}><Text style={styles.primaryActionButtonTextLabel}>{product.stock === 0 ? 'Out Of Stock' : isInCart ? 'View Cart' : 'Add To Cart'}</Text></Pressable></View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' }, loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }, loadingText: { marginTop: 12, color: '#64748B', fontWeight: '600', fontSize: 14 }, scrollContent: { paddingBottom: 130 },
  navHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 54, paddingBottom: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#F1F5F9', gap: 14 }, backIconButton: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#EAEFF3' }, backIconText: { fontSize: 18, fontWeight: '700', color: '#0D0D0D' }, navTitle: { flex: 1, fontSize: 16, fontWeight: '800', color: '#0D0D0D', letterSpacing: -0.3 },
  imageContainer: { width, height: 300, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center', position: 'relative', borderBottomWidth: 1, borderColor: '#F1F5F9' }, imageGalleryScroll: { width: '100%', height: '100%' }, imageSlide: { width, height: 300, alignItems: 'center', justifyContent: 'center' }, productImage: { width: '85%', height: '85%' }, imageDotsRow: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }, imageDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#CBD5E1' }, imageDotActive: { width: 18, backgroundColor: '#22CC71' },
  fallbackGraphic: { width: 120, height: 120, borderRadius: 40, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' }, fallbackLetter: { fontSize: 48, fontWeight: '900', color: '#64748B' },
  metaMainCard: { backgroundColor: '#FFFFFF', padding: 20, borderBottomWidth: 8, borderColor: '#F7F8FA' }, badgeLineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }, stockStatusBadgeContainer: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }, stockStatusBadgeText: { fontSize: 12, fontWeight: '800' }, deliverySpeedBadge: { backgroundColor: '#22CC7110', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }, deliverySpeedText: { fontSize: 11, fontWeight: '900', color: '#22CC71', letterSpacing: 0.2 }, productTitleText: { fontSize: 22, fontWeight: '900', color: '#0D0D0D', lineHeight: 28, letterSpacing: -0.5 }, quantityMetricLabel: { fontSize: 14, color: '#64748B', marginTop: 4, fontWeight: '500' }, pricingLayoutBlock: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, backgroundColor: '#F7F8FA', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#EAEFF3' }, priceContainerRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 }, currentPriceLabel: { fontSize: 24, fontWeight: '900', color: '#0D0D0D' }, mrpLabel: { fontSize: 14, color: '#94A3B8', textDecorationLine: 'line-through', fontWeight: '600' }, savingsBoxTag: { backgroundColor: '#22CC71', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }, savingsBoxText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  expiryAlertCard: { backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 8, borderColor: '#F7F8FA' }, expiryLeftBlock: { flexDirection: 'row', alignItems: 'center', gap: 12 }, expiryCalendarIcon: { fontSize: 22 }, expiryTitleLabel: { fontSize: 13, fontWeight: '800', color: '#0D0D0D' }, expiryDetailText: { fontSize: 12, color: '#64748B', marginTop: 1, fontWeight: '500' }, daysCounterBadge: { backgroundColor: '#F9731610', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }, daysCounterText: { fontSize: 11, fontWeight: '700', color: '#F97316' }, contentDataSectionCard: { backgroundColor: '#FFFFFF', padding: 20, borderBottomWidth: 8, borderColor: '#F7F8FA' }, sectionHeadingText: { fontSize: 16, fontWeight: '900', color: '#0D0D0D', letterSpacing: -0.2, marginBottom: 12 }, bodyDescriptionParagraph: { fontSize: 14, color: '#475569', lineHeight: 22, fontWeight: '500' }, infoGridRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }, infoGridLabel: { fontSize: 13, color: '#64748B', fontWeight: '500' }, infoGridValue: { fontSize: 13, color: '#0D0D0D', fontWeight: '700' }, infoGridValueFallback: { fontSize: 12, color: '#94A3B8', fontWeight: '500', maxWidth: '60%', textAlign: 'right' }, infoGridSeparator: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 10 }, relatedProductsWrapper: { backgroundColor: '#FFFFFF', paddingTop: 20, paddingBottom: 40 }, relatedScrollContent: { paddingHorizontal: 20, gap: 12, marginTop: 4 }, placeholderRelatedCard: { width: 160, backgroundColor: '#F7F8FA', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#EAEFF3' }, placeholderMiniImage: { width: '100%', height: 90, borderRadius: 10, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }, relatedProductMiniImage: { width: '90%', height: '90%' }, placeholderBoxIcon: { fontSize: 20 }, placeholderCardTitle: { fontSize: 12, fontWeight: '700', color: '#0D0D0D' }, placeholderCardPrice: { fontSize: 13, fontWeight: '900', color: '#22CC71', marginTop: 4 }, stickyActionFooterBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderColor: '#F1F5F9', paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 15 }, footerPricingDisplayArea: { flexDirection: 'column' }, footerTotalPriceText: { fontSize: 22, fontWeight: '900', color: '#0D0D0D' }, footerMutedSubtitle: { fontSize: 11, color: '#94A3B8', fontWeight: '500', marginTop: 2 }, primaryActionButton: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', minWidth: 160 }, activeStateButton: { backgroundColor: '#22CC71' }, disabledStateButton: { backgroundColor: '#94A3B8' }, primaryActionButtonTextLabel: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 }
});