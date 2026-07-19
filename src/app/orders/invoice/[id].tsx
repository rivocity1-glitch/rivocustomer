import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../../lib/supabase';

export default function InvoiceScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Data states
  const [invoice, setInvoice] = useState<any | null>(null);
  const [order, setOrder] = useState<any | null>(null);
  const [vendorProfile, setVendorProfile] = useState<any | null>(null);
  const [address, setAddress] = useState<any | null>(null);
  const [itemsWithProducts, setItemsWithProducts] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!id) {
        setError('Missing order ID parameter');
        setLoading(false);
        return;
      }

      // Step 2: Query invoices where order_id = current order id
      const { data: invoiceData, error: invoiceErr } = await supabase
        .from('invoices')
        .select('*')
        .eq('order_id', id)
        .maybeSingle();

      if (invoiceErr) throw invoiceErr;

      if (!invoiceData) {
        setInvoice(null);
        setLoading(false);
        return;
      }
      setInvoice(invoiceData);

      // Step 3: Using the returned invoice, query orders using invoice.order_id
      const { data: orderData, error: orderErr } = await supabase
        .from('orders')
        .select('*')
        .eq('id', invoiceData.order_id)
        .maybeSingle();

      if (orderErr) throw orderErr;
      setOrder(orderData);

      if (orderData) {
        // Step 4: Using order.vendor_id fetch vendor information from vendor_profiles safely using existing records
        if (orderData.vendor_id) {
          const { data: profileData } = await supabase
            .from('vendor_profiles')
            .select('*')
            .eq('id', orderData.vendor_id)
            .maybeSingle();
          
          setVendorProfile(profileData);
        }

        // Step 5: Using order.customer_address_id fetch customer address
        if (orderData.customer_address_id) {
          const { data: addressData, error: addressErr } = await supabase
            .from('customer_addresses')
            .select('*')
            .eq('id', orderData.customer_address_id)
            .maybeSingle();
          
          if (!addressErr) {
            setAddress(addressData);
          }
        }

        // Step 6: Query order_items where order_id = order.id
        const { data: itemsData, error: itemsErr } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', orderData.id);

        if (itemsErr) throw itemsErr;

        if (itemsData && itemsData.length > 0) {
          // Step 7: For every order item, query products using product_id to obtain product.name
          const resolvedItems = await Promise.all(
            itemsData.map(async (item) => {
              if (item.product_id) {
                const { data: productData } = await supabase
                  .from('products')
                  .select('name')
                  .eq('id', item.product_id)
                  .maybeSingle();
                
                return {
                  ...item,
                  product_name: productData?.name || null,
                };
              }
              return { ...item, product_name: null };
            })
          );
          setItemsWithProducts(resolvedItems);
        } else {
          setItemsWithProducts([]);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching invoice data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return null;
    }
  };

  const formatAmount = (value: any) => {
    if (value === undefined || value === null) return null;
    const num = Number(value);
    return isNaN(num) ? null : num.toFixed(2);
  };

  // Safe evaluation of vendor data strictly from what exists in vendor_profiles
  const shopName = vendorProfile?.shop_name || vendorProfile?.name || null;
  const ownerName = vendorProfile?.owner_name || vendorProfile?.contact_name || null;
  const shopAddress = vendorProfile?.address || vendorProfile?.shop_address || vendorProfile?.location || null;
  const shopPhone = vendorProfile?.phone || vendorProfile?.phone_number || vendorProfile?.contact_phone || null;

  // Safe evaluation of address properties strictly from what exists in customer_addresses
  const customerName = address?.name || address?.customer_name || null;
  const customerPhone = address?.phone || address?.phone_number || null;
  const addressLine1 = address?.address_line1 || address?.address || null;
  const addressLine2 = address?.address_line2 || null;
  const landmark = address?.landmark || null;
  const city = address?.city || null;
  const state = address?.state || null;
  const pincode = address?.postal_code || address?.pincode || address?.zip_code || null;

  // Safe calculations for dynamic fields based on structural prices without fallback placeholders
  const subtotal = order?.subtotal ? Number(order.subtotal) : 0;
  const deliveryFee = order?.delivery_fee ? Number(order.delivery_fee) : 0;
  const totalAmount = order?.total_amount ? Number(order.total_amount) : 0;
  
  // Platform fee computed purely from existing math if discrepancy matches positive balance
  const calculatedPlatformFee = totalAmount > 0 ? (totalAmount - (subtotal + deliveryFee)) : 0;
  const platformFeeDisplay = calculatedPlatformFee > 0 ? calculatedPlatformFee.toFixed(2) : null;
  
  // Safe evaluation of missing fields (discount / platform_fee fields if structural columns appear)
  const orderDiscount = order?.discount ? Number(order.discount) : null;
  const platformFeeField = order?.platform_fee ? Number(order.platform_fee) : null;
  const finalPlatformFee = platformFeeField !== null ? formatAmount(platformFeeField) : platformFeeDisplay;
  const finalDiscount = orderDiscount !== null ? formatAmount(orderDiscount) : null;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="small" color="#000000" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={fetchData}>
          <Text style={styles.primaryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!invoice) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.infoText}>No Invoice Found</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
          <Text style={styles.primaryButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* TOP BRAND HEADER CARD */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.brandText}>RIVO</Text>
              <Text style={styles.invoiceTitle}>Tax Invoice</Text>
            </View>
            {invoice.status && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{invoice.status.toUpperCase()}</Text>
              </View>
            )}
          </View>
          
          <View style={styles.headerMetaGrid}>
            {invoice.invoice_number && (
              <View style={styles.metaColumn}>
                <Text style={styles.metaLabel}>Invoice Number</Text>
                <Text style={styles.metaValue}>{invoice.invoice_number}</Text>
              </View>
            )}
            {formatDate(invoice.created_at) && (
              <View style={styles.metaColumn}>
                <Text style={styles.metaLabel}>Invoice Date</Text>
                <Text style={styles.metaValue}>{formatDate(invoice.created_at)}</Text>
              </View>
            )}
            {order?.order_number && (
              <View style={styles.metaColumn}>
                <Text style={styles.metaLabel}>Order Number</Text>
                <Text style={styles.metaValue}>{order.order_number}</Text>
              </View>
            )}
            {order?.order_status && (
              <View style={styles.metaColumn}>
                <Text style={styles.metaLabel}>Order Status</Text>
                <Text style={styles.metaValue}>{order.order_status}</Text>
              </View>
            )}
          </View>
        </View>

        {/* VENDOR & CUSTOMER SECTION */}
        <View style={styles.addressSectionGrid}>
          {/* Vendor Details */}
          {(shopName || ownerName || shopAddress || shopPhone) && (
            <View style={styles.addressCard}>
              <Text style={styles.sectionHeading}>Sold By</Text>
              {shopName && <Text style={styles.storeNameText}>{shopName}</Text>}
              {ownerName && <Text style={styles.addressDetailText}>{ownerName}</Text>}
              {shopAddress && <Text style={styles.addressDetailText}>{shopAddress}</Text>}
              {shopPhone && <Text style={styles.addressDetailText}>Phone: {shopPhone}</Text>}
            </View>
          )}

          {/* Customer Details */}
          <View style={styles.addressCard}>
            <Text style={styles.sectionHeading}>Bill To</Text>
            {customerName && <Text style={styles.storeNameText}>{customerName}</Text>}
            {customerPhone && <Text style={styles.addressDetailText}>Phone: {customerPhone}</Text>}
            {(addressLine1 || addressLine2 || landmark || city || state || pincode) && (
              <Text style={styles.addressDetailText}>
                {[addressLine1, addressLine2, landmark, city, state, pincode].filter(Boolean).join(', ')}
              </Text>
            )}
          </View>
        </View>

        {/* ORDER INFORMATION TIMELINE */}
        <View style={styles.card}>
          <Text style={styles.sectionHeading}>Order Information</Text>
          <View style={styles.infoGrid}>
            {order?.order_number && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Order Number</Text>
                <Text style={styles.infoValue}>{order.order_number}</Text>
              </View>
            )}
            {formatDate(order?.created_at) && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Order Date</Text>
                <Text style={styles.infoValue}>{formatDate(order.created_at)}</Text>
              </View>
            )}
            {formatDate(order?.delivered_at) && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Delivered Date</Text>
                <Text style={styles.infoValue}>{formatDate(order.delivered_at)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ITEMS TABLE */}
        <View style={styles.card}>
          <Text style={styles.sectionHeading}>Items</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 2.5 }]}>Product</Text>
            <Text style={[styles.th, { flex: 0.6, textAlign: 'center' }]}>Qty</Text>
            <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Price</Text>
            <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>Total</Text>
          </View>

          {itemsWithProducts.map((item, idx) => (
            <View key={item.id || idx} style={styles.tableRow}>
              <Text style={[styles.td, { flex: 2.5, fontWeight: '500', color: '#111111' }]}>
                {item.product_name || 'Product Item'}
              </Text>
              <Text style={[styles.td, { flex: 0.6, textAlign: 'center', color: '#666666' }]}>
                {item.quantity ?? 1}
              </Text>
              <Text style={[styles.td, { flex: 1.2, textAlign: 'right', color: '#444444' }]}>
                {formatAmount(item.unit_price) || '0.00'}
              </Text>
              <Text style={[styles.td, { flex: 1.2, textAlign: 'right', fontWeight: '600', color: '#111111' }]}>
                {formatAmount(item.total_price) || '0.00'}
              </Text>
            </View>
          ))}

          {/* SUMMARY INLINE */}
          <View style={styles.summaryContainer}>
            {formatAmount(order?.subtotal) && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>{formatAmount(order.subtotal)}</Text>
              </View>
            )}
            {formatAmount(order?.delivery_fee) && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                <Text style={styles.summaryValue}>{formatAmount(order.delivery_fee)}</Text>
              </View>
            )}
            {finalPlatformFee && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Platform Fee</Text>
                <Text style={styles.summaryValue}>{finalPlatformFee}</Text>
              </View>
            )}
            {finalDiscount && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Discount</Text>
                <Text style={[styles.summaryValue, { color: '#10b981' }]}>-{finalDiscount}</Text>
              </View>
            )}
            {formatAmount(order?.total_amount) && (
              <View style={[styles.summaryRow, styles.grandTotalRow]}>
                <Text style={styles.grandTotalLabel}>Grand Total</Text>
                <Text style={styles.grandTotalValue}>{formatAmount(order.total_amount)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* PAYMENT METADATA CARD */}
        <View style={styles.card}>
          <Text style={styles.sectionHeading}>Payment Details</Text>
          <View style={styles.infoGrid}>
            {order?.payment_method && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Payment Method</Text>
                <Text style={styles.infoValue}>{order.payment_method}</Text>
              </View>
            )}
            {order?.payment_status && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Payment Status</Text>
                <Text style={styles.infoValue}>{order.payment_status}</Text>
              </View>
            )}
            {invoice.status && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Invoice Status</Text>
                <Text style={styles.infoValue}>{invoice.status}</Text>
              </View>
            )}
          </View>
        </View>

        {/* FOOTER */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerTextBold}>Thank you for choosing Rivo.</Text>
          <Text style={styles.footerText}>For support contact your vendor through the Rivo app.</Text>
          <Text style={styles.footerTextLight}>This is a computer generated invoice.</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 20,
  },
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  brandText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 1.5,
  },
  invoiceTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6c757d',
    textTransform: 'uppercase',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  badge: {
    backgroundColor: '#e6f4ea',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#137333',
    letterSpacing: 0.5,
  },
  headerMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  metaColumn: {
    width: '50%',
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  metaLabel: {
    fontSize: 11,
    color: '#868e96',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#212529',
  },
  addressSectionGrid: {
    marginBottom: 4,
  },
  addressCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#495057',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f3f5',
    paddingBottom: 6,
  },
  storeNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
    marginBottom: 4,
  },
  addressDetailText: {
    fontSize: 13,
    color: '#495057',
    lineHeight: 18,
    marginTop: 2,
  },
  infoGrid: {
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6c757d',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#212529',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#dee2e6',
    paddingBottom: 8,
    marginBottom: 8,
  },
  th: {
    fontSize: 11,
    fontWeight: '700',
    color: '#868e96',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
    alignItems: 'center',
  },
  td: {
    fontSize: 13,
  },
  summaryContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    paddingTop: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#495057',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#212529',
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
    marginTop: 10,
    paddingTop: 10,
    alignItems: 'center',
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  grandTotalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000000',
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  footerTextBold: {
    fontSize: 13,
    fontWeight: '700',
    color: '#495057',
    marginBottom: 4,
  },
  footerText: {
    fontSize: 12,
    color: '#6c757d',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 6,
  },
  footerTextLight: {
    fontSize: 11,
    color: '#adb5bd',
    fontStyle: 'italic',
  },
  errorText: {
    fontSize: 15,
    color: '#dc3545',
    textAlign: 'center',
    marginBottom: 16,
  },
  infoText: {
    fontSize: 15,
    color: '#6c757d',
    textAlign: 'center',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#000000',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});