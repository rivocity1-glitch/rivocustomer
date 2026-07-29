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
        // Step 4: Using order.vendor_id fetch vendor information from vendor_profiles safely
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
          // Step 7: For every order item, resolve product details & name with robust fallbacks
          const resolvedItems = await Promise.all(
            itemsData.map(async (item) => {
              let fetchedProductName = null;
              let fetchedHsn = null;
              let fetchedGst = null;

              if (item.product_id) {
                try {
                  const { data: productData } = await supabase
                    .from('products')
                    .select('*')
                    .eq('id', item.product_id)
                    .maybeSingle();
                  
                  if (productData) {
                    fetchedProductName =
                      productData.name ||
                      productData.title ||
                      productData.product_name ||
                      null;
                    fetchedHsn = productData.hsn_code || productData.hsn || null;
                    fetchedGst = productData.gst_rate ?? productData.gst ?? null;
                  }
                } catch {
                  // Fallback to item stored fields if products query is restricted or fails
                }
              }

              // Comprehensive fallback logic for product name
              const resolvedName =
                fetchedProductName ||
                item.product_name ||
                item.item_name ||
                item.product_title ||
                item.name ||
                item.title ||
                'Unknown Product';

              return {
                ...item,
                product_name: resolvedName,
                hsn_code: fetchedHsn || item.hsn_code || item.hsn || null,
                gst_rate: fetchedGst ?? item.gst_rate ?? item.gst ?? 0,
              };
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
      return new Date(dateString).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return null;
    }
  };

  const formatAmount = (value: any) => {
    if (value === undefined || value === null) return '₹0.00';
    const num = Number(value);
    return isNaN(num) ? '₹0.00' : `₹${num.toFixed(2)}`;
  };

  const formatText = (text: string | null | undefined) => {
    if (!text) return null;
    const lower = text.toLowerCase().trim();
    if (lower === 'cod') return 'Cash on Delivery';
    if (lower === 'paid') return 'Paid';
    if (lower === 'pending') return 'Pending';
    if (lower === 'failed') return 'Failed';

    return text
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Safe evaluation of vendor data
  const shopName = vendorProfile?.shop_name || vendorProfile?.name || null;
  const ownerName = vendorProfile?.owner_name || vendorProfile?.contact_name || null;
  const shopAddress = vendorProfile?.address || vendorProfile?.shop_address || vendorProfile?.location || null;
  const shopPhone = vendorProfile?.phone || vendorProfile?.phone_number || vendorProfile?.contact_phone || null;
  const shopGstin = vendorProfile?.gstin || vendorProfile?.gst_number || vendorProfile?.gst_no || null;
  const shopEmail = vendorProfile?.email || vendorProfile?.business_email || null;

  // Safe evaluation of address properties
  const customerName = address?.name || address?.customer_name || null;
  const customerPhone = address?.phone || address?.phone_number || null;
  const addressLine1 = address?.address_line1 || address?.address || null;
  const addressLine2 = address?.address_line2 || null;
  const landmark = address?.landmark || null;
  const city = address?.city || null;
  const state = address?.state || null;
  const pincode = address?.postal_code || address?.pincode || address?.zip_code || null;
  const customerGstin = address?.gstin || address?.gst_number || order?.customer_gstin || null;

  const fullAddress = [addressLine1, addressLine2, landmark, city, state, pincode].filter(Boolean).join(', ');

  // Per-item & Total GST calculations
  let totalTaxableAmount = 0;
  let totalGstAmount = 0;
  let totalProductInclusiveAmount = 0;
  let hasAnyGst = false;

  const processedItems = itemsWithProducts.map((item) => {
    const qty = Number(item.quantity ?? 1);
    const unitPrice = Number(item.unit_price ?? 0);
    const inclusivePrice = item.total_price !== undefined && item.total_price !== null 
      ? Number(item.total_price) 
      : unitPrice * qty;
    const gstRate = Number(item.gst_rate ?? 0);

    let taxableAmount = inclusivePrice;
    let gstAmount = 0;
    let cgst = 0;
    let sgst = 0;

    if (gstRate > 0) {
      hasAnyGst = true;
      taxableAmount = inclusivePrice / (1 + gstRate / 100);
      gstAmount = inclusivePrice - taxableAmount;
      cgst = gstAmount / 2;
      sgst = gstAmount / 2;
    }

    totalTaxableAmount += taxableAmount;
    totalGstAmount += gstAmount;
    totalProductInclusiveAmount += inclusivePrice;

    return {
      ...item,
      qty,
      unitPrice,
      inclusivePrice,
      gstRate,
      taxableAmount,
      gstAmount,
      cgst,
      sgst,
    };
  });

  const totalCgst = totalGstAmount / 2;
  const totalSgst = totalGstAmount / 2;

  // Discounts and Additional Charges
  const couponDiscountVal = order?.coupon_discount ? Number(order.coupon_discount) : 0;
  const offerDiscountVal = order?.offer_discount ? Number(order.offer_discount) : 0;
  const genericDiscountVal = order?.discount ? Number(order.discount) : 0;

  const deliveryFeeVal = order?.delivery_fee !== undefined && order?.delivery_fee !== null ? Number(order.delivery_fee) : null;
  const platformFeeVal = order?.platform_fee !== undefined && order?.platform_fee !== null ? Number(order.platform_fee) : null;
  const grandTotalVal = order?.total_amount !== undefined && order?.total_amount !== null ? Number(order.total_amount) : null;

  const calculatedSavings = couponDiscountVal + offerDiscountVal + genericDiscountVal;
  const hasSavings = calculatedSavings > 0;

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="small" color="#0F172A" />
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
        
        {/* INVOICE HEADER */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.brandText}>Rivo City</Text>
              <Text style={styles.invoiceTitle}>Marketplace Tax Invoice</Text>
            </View>
            {invoice.status && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{formatText(invoice.status)?.toUpperCase()}</Text>
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
            {order?.order_number && (
              <View style={styles.metaColumn}>
                <Text style={styles.metaLabel}>Order Number</Text>
                <Text style={styles.metaValue}>{order.order_number}</Text>
              </View>
            )}
            {formatDate(invoice.created_at) && (
              <View style={styles.metaColumn}>
                <Text style={styles.metaLabel}>Invoice Date</Text>
                <Text style={styles.metaValue}>{formatDate(invoice.created_at)}</Text>
              </View>
            )}
            {order?.order_status && (
              <View style={styles.metaColumn}>
                <Text style={styles.metaLabel}>Order Status</Text>
                <Text style={styles.metaValue}>{formatText(order.order_status)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* VENDOR & CUSTOMER SECTION */}
        <View style={styles.addressSectionGrid}>
          {/* Sold By */}
          {(shopName || ownerName || shopAddress || shopPhone || shopGstin || shopEmail) && (
            <View style={styles.card}>
              <Text style={styles.sectionHeading}>Sold By</Text>
              {shopName && <Text style={styles.storeNameText}>{shopName}</Text>}
              {ownerName && <Text style={styles.addressDetailText}>{ownerName}</Text>}
              {shopAddress && <Text style={styles.addressDetailText}>{shopAddress}</Text>}
              {shopPhone && <Text style={styles.addressDetailText}>Phone: {shopPhone}</Text>}
              {shopGstin && <Text style={styles.addressDetailText}>GSTIN: {shopGstin}</Text>}
              {shopEmail && <Text style={styles.addressDetailText}>Email: {shopEmail}</Text>}
            </View>
          )}

          {/* Bill To */}
          <View style={styles.card}>
            <Text style={styles.sectionHeading}>Bill To</Text>
            {customerName && <Text style={styles.storeNameText}>{customerName}</Text>}
            {customerPhone && <Text style={styles.addressDetailText}>Phone: {customerPhone}</Text>}
            {fullAddress ? <Text style={styles.addressDetailText}>{fullAddress}</Text> : null}
            {customerGstin && <Text style={styles.addressDetailText}>GSTIN: {customerGstin}</Text>}
          </View>
        </View>

        {/* ORDER INFORMATION */}
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
            {order?.payment_method && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Payment Method</Text>
                <Text style={styles.infoValue}>{formatText(order.payment_method)}</Text>
              </View>
            )}
            {order?.payment_status && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Payment Status</Text>
                <Text style={styles.infoValue}>{formatText(order.payment_status)}</Text>
              </View>
            )}
            {invoice?.status && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Invoice Status</Text>
                <Text style={styles.infoValue}>{formatText(invoice.status)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ITEMS TABLE */}
        <View style={styles.card}>
          <Text style={styles.sectionHeading}>Items</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.th, { flex: 2.2 }]}>Product</Text>
            <Text style={[styles.th, { flex: 0.6, textAlign: 'center' }]}>Qty</Text>
            <Text style={[styles.th, { flex: 1.1, textAlign: 'right' }]}>Unit Price</Text>
            <Text style={[styles.th, { flex: 1.1, textAlign: 'right' }]}>Total</Text>
          </View>

          {processedItems.map((item, idx) => (
            <View key={item.id || idx} style={styles.tableRow}>
              <View style={{ flex: 2.2, paddingRight: 6 }}>
                <Text style={styles.productName}>{item.product_name}</Text>
                {item.hsn_code ? (
                  <Text style={styles.itemSubDetail}>HSN: {item.hsn_code}</Text>
                ) : null}
                
                {item.gstRate > 0 ? (
                  <>
                    <Text style={styles.itemGstBreakdownText}>
                      GST Included ({item.gstRate}%)
                    </Text>
                    <Text style={styles.itemGstBreakdownText}>
                      Taxable Value {formatAmount(item.taxableAmount)}
                    </Text>
                    <Text style={styles.itemGstBreakdownText}>
                      GST {formatAmount(item.gstAmount)}
                    </Text>
                    <Text style={styles.itemGstBreakdownText}>
                      CGST {formatAmount(item.cgst)} | SGST {formatAmount(item.sgst)}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.itemGstBreakdownText}>GST Exempt</Text>
                )}
              </View>
              <Text style={[styles.td, { flex: 0.6, textAlign: 'center', color: '#475569' }]}>
                {item.qty}
              </Text>
              <Text style={[styles.td, { flex: 1.1, textAlign: 'right', color: '#475569' }]}>
                {formatAmount(item.unitPrice)}
              </Text>
              <Text style={[styles.td, { flex: 1.1, textAlign: 'right', fontWeight: '600', color: '#0F172A' }]}>
                {formatAmount(item.inclusivePrice)}
              </Text>
            </View>
          ))}

          {/* SUMMARY INLINE */}
          <View style={styles.summaryContainer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Product Total (Inclusive GST)</Text>
              <Text style={styles.summaryValue}>{formatAmount(totalProductInclusiveAmount)}</Text>
            </View>

            {hasAnyGst && (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Less GST Included</Text>
                  <Text style={styles.summaryValue}>{formatAmount(totalGstAmount)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Taxable Value</Text>
                  <Text style={styles.summaryValue}>{formatAmount(totalTaxableAmount)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>CGST</Text>
                  <Text style={styles.summaryValue}>{formatAmount(totalCgst)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>SGST</Text>
                  <Text style={styles.summaryValue}>{formatAmount(totalSgst)}</Text>
                </View>
              </>
            )}

            {couponDiscountVal > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Coupon Discount</Text>
                <Text style={[styles.summaryValue, styles.discountText]}>-{formatAmount(couponDiscountVal)}</Text>
              </View>
            )}
            {offerDiscountVal > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Offer Discount</Text>
                <Text style={[styles.summaryValue, styles.discountText]}>-{formatAmount(offerDiscountVal)}</Text>
              </View>
            )}
            {deliveryFeeVal !== null && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Fee</Text>
                <Text style={styles.summaryValue}>{formatAmount(deliveryFeeVal)}</Text>
              </View>
            )}
            {platformFeeVal !== null && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Platform Fee</Text>
                <Text style={styles.summaryValue}>{formatAmount(platformFeeVal)}</Text>
              </View>
            )}
            
            <View style={styles.divider} />

            {grandTotalVal !== null && (
              <View style={styles.grandTotalHighlight}>
                <Text style={styles.grandTotalLabel}>Amount Payable</Text>
                <Text style={styles.grandTotalValue}>{formatAmount(grandTotalVal)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* SAVINGS CARD */}
        {hasSavings && (
          <View style={styles.savingsCard}>
            <Text style={styles.savingsTitle}>You Saved</Text>
            {couponDiscountVal > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.savingsLabel}>Coupon Discount</Text>
                <Text style={styles.savingsValue}>{formatAmount(couponDiscountVal)}</Text>
              </View>
            )}
            {offerDiscountVal > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.savingsLabel}>Offer Discount</Text>
                <Text style={styles.savingsValue}>{formatAmount(offerDiscountVal)}</Text>
              </View>
            )}
            <View style={styles.savingsTotalRow}>
              <Text style={styles.savingsTotalLabel}>Total Savings</Text>
              <Text style={styles.savingsTotalValue}>{formatAmount(calculatedSavings)}</Text>
            </View>
          </View>
        )}

        {/* PAYMENT DETAILS */}
        <View style={styles.card}>
          <Text style={styles.sectionHeading}>Payment Details</Text>
          <View style={styles.infoGrid}>
            {order?.payment_method && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Payment Method</Text>
                <Text style={styles.infoValue}>{formatText(order.payment_method)}</Text>
              </View>
            )}
            {order?.payment_status && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Payment Status</Text>
                <Text style={styles.infoValue}>{formatText(order.payment_status)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* FOOTER */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerHeading}>Thank you for shopping with Rivo City.</Text>
          <Text style={styles.footerText}>
            This invoice is generated by Rivo City Marketplace on behalf of the selling vendor.
          </Text>
          <Text style={styles.footerText}>
            Prices are inclusive of applicable GST unless otherwise stated.
          </Text>
          <Text style={styles.footerText}>
            For support, contact the selling vendor through the Rivo City app.
          </Text>
          <Text style={styles.footerNote}>
            This is a computer-generated tax invoice and does not require a signature.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  headerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  brandText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  invoiceTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    letterSpacing: 0.5,
  },
  headerMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
    marginTop: 8,
  },
  metaColumn: {
    width: '50%',
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  addressSectionGrid: {
    marginBottom: 0,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 6,
  },
  storeNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  addressDetailText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
    marginTop: 2,
  },
  infoGrid: {
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
    marginBottom: 8,
  },
  th: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    alignItems: 'flex-start',
  },
  td: {
    fontSize: 13,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  itemSubDetail: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  itemGstBreakdownText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  summaryContainer: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#475569',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#0F172A',
  },
  discountText: {
    color: '#16A34A',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  grandTotalHighlight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  grandTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  savingsCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  savingsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  savingsLabel: {
    fontSize: 13,
    color: '#15803D',
  },
  savingsValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#15803D',
  },
  savingsTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#DCFCE7',
    marginTop: 8,
    paddingTop: 8,
  },
  savingsTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
  },
  savingsTotalValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#166534',
  },
  footerContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  footerHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
    textAlign: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  footerNote: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});