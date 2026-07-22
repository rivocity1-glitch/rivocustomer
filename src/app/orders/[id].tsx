// src/app/orders/[id].tsx
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { notificationService } from '../../services/notificationService';

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product: {
    name: string;
  } | null;
}

interface OrderDetails {
  id: string;
  order_number: string;
  customer_id: string;
  subtotal: number;
  delivery_fee: number;
  platform_fee: number;
  total_amount: number;
  payment_status: string;
  order_status: string;
  created_at: string;
  delivery_code: string | null;
  vendor_id: string;
  rider_id: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  vendors: {
    shop_name: string;
    phone?: string;
  } | null;
  customer_addresses: {
    address_line1: string;
    address_line2: string;
    landmark: string;
    city: string;
    state: string;
    pin_code: string;
  } | null;
  order_items: OrderItem[];
  riders?: {
    rider_name: string;
    phone: string;
    rating?: number;
    vehicle_type?: string;
    vehicle_number?: string;
  } | null;
}

interface TrackingMilestone {
  id: string;
  order_id: string;
  status: string;
  created_at: string;
}

const CANCELLATION_REASONS = [
  "Ordered by mistake",
  "Found a better price",
  "Delivery taking too long",
  "Changed my mind",
  "Wrong delivery address",
  "Other"
] as const;

const { width } = Dimensions.get('window');

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [timeline, setTimeline] = useState<TrackingMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Cancellation State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedCancelReason, setSelectedCancelReason] = useState<string>('');

  // Animations System
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const skeletonAnim = useRef(new Animated.Value(0.3)).current;

  // Pulse animation for active delivery milestones or status nodes
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Skeleton screen loading loop simulation
  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(skeletonAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          Animated.timing(skeletonAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [loading]);

  const fetchOrderAndTrackingDetails = async () => {
    try {
      if (!id) return;

      // 1. Fetch deep integrated order layout data with corrected rider metrics schema columns
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          customer_id,
          subtotal,
          delivery_fee,
          platform_fee,
          total_amount,
          payment_status,
          order_status,
          created_at,
          delivery_code,
          vendor_id,
          rider_id,
          cancelled_by,
          cancel_reason,
          cancelled_at,
          vendors ( shop_name, phone ),
          customer_addresses ( address_line1, address_line2, landmark, city, state, pin_code ),
          order_items (
            id,
            quantity,
            unit_price,
            total_price,
            product:products ( name )
          ),
          assigned_rider:riders!orders_rider_fk (
            rider_name,
            phone,
            rating,
            vehicle_type,
            vehicle_number
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (orderError) throw orderError;
      setOrder(orderData as unknown as OrderDetails);

      // 2. Fetch tracking milestones
      const { data: trackingData, error: trackingError } = await supabase
        .from('order_tracking')
        .select('id, order_id, status, created_at')
        .eq('order_id', id)
        .order('created_at', { ascending: true });

      if (trackingError) throw trackingError;
      setTimeline(trackingData || []);

      // Trigger smooth entry fade in
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();

    } catch (error) {
      console.error('Error fetching order metadata matrices:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrderAndTrackingDetails();

    if (!id) return;

    // Set up Realtime listener targeting current order changes
    const orderSubscription = supabase
      .channel(`order-status-channel-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          console.log('Realtime order status stream payload update:', payload);
          if (payload.new) {
            fetchOrderAndTrackingDetails();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orderSubscription);
    };
  }, [id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrderAndTrackingDetails();
  };

  const handleCopyOtp = async (code: string) => {
    await Clipboard.setStringAsync(code);
    Alert.alert("Success", "OTP copied successfully.");
  };

  const handleCallRider = () => {
    if (order?.riders?.phone) {
      Linking.openURL(`tel:${order.riders.phone}`);
    } else {
      Alert.alert("Notice", "Rider contact unavailable.");
    }
  };

  const handleCallStore = () => {
    if (order?.vendors?.phone) {
      Linking.openURL(`tel:${order.vendors.phone}`);
    } else {
      Alert.alert("Notice", "Store phone number unavailable.");
    }
  };

  const handleOpenCancelModal = () => {
    setSelectedCancelReason('');
    setShowCancelModal(true);
  };

  const handleConfirmCancel = () => {
    if (!selectedCancelReason) {
      Alert.alert("Selection Required", "Please select a reason for cancelling your order.");
      return;
    }

    Alert.alert(
      "Cancel this order?",
      "This action cannot be undone.",
      [
        { text: "Keep Order", style: "cancel" },
        { 
          text: "Cancel Order", 
          style: "destructive",
          onPress: executeCancellation 
        }
      ]
    );
  };

  const executeCancellation = async () => {
    if (!id || !order || isCancelling) return;
    try {
      setIsCancelling(true);
      setShowCancelModal(false);
      
      const timestamp = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          order_status: 'cancelled',
          cancelled_by: 'customer',
          cancel_reason: selectedCancelReason,
          cancelled_at: timestamp
        })
        .eq('id', id);

      if (updateError) throw updateError;

      await supabase
        .from('order_tracking')
        .insert({
          order_id: id,
          status: 'cancelled'
        });

      // Send Order Cancellation Notification
      try {
        await notificationService.notifyCustomerOrderCancelled(
          order.customer_id,
          order.order_number,
          id,
          selectedCancelReason
        );
      } catch (notifErr) {
        console.error('Failed to send cancellation notification:', notifErr);
      }

      Alert.alert("Success", "Order cancelled successfully.");
      fetchOrderAndTrackingDetails();
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not cancel order at this stage.");
    } finally {
      setIsCancelling(false);
    }
  };

  const formatStatus = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'Order Placed',
      accepted: 'Accepted by Store',
      preparing: 'Preparing Essentials',
      packed: 'Packed & Sealed',
      out_for_delivery: 'Out For Delivery',
      delivered: 'Delivered Safely',
      cancelled: 'Order Cancelled',
    };
    return statusMap[status.toLowerCase()] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getStatusIcon = (status: string) => {
    const iconMap: Record<string, string> = {
      pending: '📝',
      accepted: '✅',
      preparing: '🍳',
      packed: '📦',
      out_for_delivery: '🛵',
      delivered: '🎉',
      cancelled: '✕',
    };
    return iconMap[status.toLowerCase()] || '🛍️';
  };

  const formatTimestamp = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const dayAndYear = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const time = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return `${dayAndYear}\n${time}`;
  };

  const computedTimeline = useMemo(() => {
    if (timeline.length > 0) return timeline;
    if (!order) return [];

    const fallbackStatuses = ['pending', 'accepted', 'preparing', 'out_for_delivery', 'delivered'];
    const currentStatus = order.order_status.toLowerCase();
    
    let activeIndex = fallbackStatuses.indexOf(currentStatus);
    if (currentStatus === 'packed') activeIndex = 2; 
    if (currentStatus === 'cancelled') return [{ id: 'stub-c', order_id: order.id, status: 'cancelled', created_at: order.created_at }];

    return fallbackStatuses.map((status, index) => {
      if (index <= activeIndex) {
        return {
          id: `stub-${status}`,
          order_id: order.id,
          status: status,
          created_at: order.created_at, 
        };
      }
      return {
        id: `stub-${status}`,
        order_id: order.id,
        status: status,
        created_at: '', 
      };
    });
  }, [timeline, order]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.skeletonCircleButton} />
          <View style={{ gap: 6 }}>
            <View style={styles.skeletonTitleLine} />
            <View style={styles.skeletonSubTitleLine} />
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.skeletonHeroCard, { opacity: skeletonAnim }]} />
          <Animated.View style={[styles.skeletonMapCard, { opacity: skeletonAnim }]} />
          <Animated.View style={[styles.skeletonInfoCard, { opacity: skeletonAnim }]} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButtonIcon}>
            <Text style={styles.backButtonTextSymbol}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Order Details</Text>
        </View>
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundText}>Order record details could not be found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentStatusStr = order.order_status.toLowerCase();
  const isCancelled = currentStatusStr === 'cancelled';
  const isDelivered = currentStatusStr === 'delivered';
  
  const showOtpLayout = !isDelivered && !isCancelled;
  const isCancellationAllowed = ['pending', 'accepted', 'preparing', 'packed'].includes(currentStatusStr);
  const showLiveMap = currentStatusStr === 'out_for_delivery';

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Navigation Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButtonIcon, pressed && styles.pressedMicro]}>
          <Text style={styles.backButtonTextSymbol}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Track Order</Text>
          <Text style={styles.headerSubtitle}>ID reference: #{order.order_number}</Text>
        </View>
      </View>

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22CC71" />
          }
        >
          {/* HERO STATUS CARD */}
          <View style={styles.heroStatusCard}>
            <View style={styles.heroMainRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <View style={styles.badgeRowContainer}>
                  <View style={[styles.statusLiveBadge, isCancelled && { backgroundColor: '#EF444415' }]}>
                    <Text style={[styles.statusLiveBadgeText, isCancelled && { color: '#EF4444' }]}>
                      {isDelivered ? '● COMPLETED' : isCancelled ? '● CANCELLED' : '● LIVE TRACKING'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.heroStatusHeading}>
                  {formatStatus(order.order_status)}
                </Text>
              </View>
              <Animated.View style={[styles.animatedStatusIconWrapper, !isCancelled && !isDelivered && { transform: [{ scale: pulseAnim }] }]}>
                <Text style={styles.statusEmojiGraphic}>{getStatusIcon(order.order_status)}</Text>
              </Animated.View>
            </View>

            <View style={styles.etaContainerBlock}>
              <Text style={styles.etaLabelText}>{isDelivered ? 'Arrival Time' : isCancelled ? 'Status Message' : 'Estimated Delivery Time'}</Text>
              <Text style={styles.etaTimeText}>{isDelivered ? 'Arrived Safely' : isCancelled ? 'Order Terminal' : 'Within 10-15 Mins'}</Text>
            </View>

            {!isCancelled && !isDelivered && (
              <View style={styles.progressLineContainer}>
                <View style={styles.progressBarBackground}>
                  <View style={[styles.progressBarFill, { width: currentStatusStr === 'out_for_delivery' ? '85%' : currentStatusStr === 'packed' ? '60%' : '35%' }]} />
                </View>
                <Text style={styles.progressMicroNotice}>⚡ Rivo priority fulfillment channel active</Text>
              </View>
            )}
          </View>

          {/* CANCELLED ORDER CARD */}
          {isCancelled && (
            <View style={[styles.premiumCard, styles.cancelledInfoCard]}>
              <Text style={styles.cancelledCardHeaderTitle}>Order Cancelled</Text>
              <View style={styles.cancelledDivider} />

              <View style={styles.cancelledDetailRow}>
                <Text style={styles.cancelledDetailLabel}>Cancelled By</Text>
                <Text style={styles.cancelledDetailValue}>
                  {order.cancelled_by ? order.cancelled_by.charAt(0).toUpperCase() + order.cancelled_by.slice(1) : '—'}
                </Text>
              </View>

              <View style={styles.cancelledDetailRow}>
                <Text style={styles.cancelledDetailLabel}>Reason</Text>
                <Text style={styles.cancelledDetailValue}>
                  {order.cancel_reason || '—'}
                </Text>
              </View>

              <View style={styles.cancelledDetailRow}>
                <Text style={styles.cancelledDetailLabel}>Cancelled At</Text>
                <Text style={[styles.cancelledDetailValue, { textAlign: 'right' }]}>
                  {order.cancelled_at ? formatTimestamp(order.cancelled_at) : '—'}
                </Text>
              </View>
            </View>
          )}

          {/* DELIVERY OTP CARD */}
          {showOtpLayout ? (
            <View style={styles.premiumCard}>
              <Text style={styles.otpCardTitle}>Delivery OTP</Text>
              <Text style={styles.otpCardSubtitle}>Share this OTP with the rider ONLY after receiving your complete order.</Text>
              
              <View style={styles.otpContainer}>
                <Text style={styles.otpText}>
                  {order.delivery_code ? order.delivery_code : "Generating OTP..."}
                </Text>
              </View>

              {!!order.delivery_code && (
                <TouchableOpacity 
                  style={styles.copyOtpButton} 
                  activeOpacity={0.7}
                  onPress={() => handleCopyOtp(order.delivery_code || '')}
                >
                  <Text style={styles.copyOtpButtonText}>Copy OTP</Text>
                </TouchableOpacity>
              )}
              
              <Text style={styles.otpCardWarning}>Never share this OTP before receiving your complete order.</Text>
            </View>
          ) : isDelivered ? (
            <View style={[styles.premiumCard, styles.verifiedGreenCard]}>
              <Text style={styles.verifiedGreenTitle}>✅ Delivery Verified</Text>
              <Text style={styles.verifiedGreenSubtitle}>Your delivery was successfully verified.</Text>
            </View>
          ) : null}

          {/* MAP VIEW SECTION */}
          {showLiveMap ? (
            <View style={styles.mapPlaceholderCard}>
              <View style={styles.mapGraphicBackground}>
                <View style={[styles.mapRouteDottedPath, { width: '60%', top: '50%', left: '20%' }]} />
                <View style={styles.mapRiderMarkerBubble}>
                  <Text style={styles.mapMarkerIcon}>🛵</Text>
                </View>
                <View style={styles.mapCustomerMarkerBubble}>
                  <Text style={styles.mapMarkerIcon}>🏠</Text>
                </View>
              </View>
              <View style={styles.mapCaptionBlock}>
                <Text style={styles.mapCaptionMain}>Live Rider Tracking Active</Text>
                <Text style={styles.mapCaptionSub}>Rider is navigating towards your delivery location bounds</Text>
              </View>
            </View>
          ) : !isCancelled && !isDelivered ? (
            <View style={styles.premiumCard}>
              <Text style={styles.preparingMapTitle}>Your order is being prepared</Text>
              <Text style={styles.preparingMapSubtitle}>Live rider tracking will begin once your order is picked up.</Text>
            </View>
          ) : null}

          {/* DELIVERY PARTNER PANE */}
          {currentStatusStr === 'out_for_delivery' && order.rider_id !== null && (
            <View style={styles.premiumEcosystemCard}>
              <View style={styles.cardHeaderFlex}>
                <View style={styles.avatarCirclePlaceholder}>
                  <Text style={styles.avatarEmojiSymbol}>🚴</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardPreHeading}>Delivery Partner</Text>
                  <Text style={styles.cardMainHeading}>{order.riders?.rider_name}</Text>
                  <Text style={styles.cardMetaSubText}>
                    {order.riders?.rating == null ? '🟢 New Rider' : `⭐ ${order.riders.rating}`}
                  </Text>
                </View>
              </View>
              
              <View style={styles.cardActionButtonsRow}>
                <Pressable 
                  style={({ pressed }) => [styles.communicationBtn, styles.callRiderActiveBtn, pressed && styles.microInteraction]}
                  onPress={handleCallRider}
                >
                  <Text style={styles.callRiderActiveText}>📞 Call Rider</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* STORE CONTACT CARD */}
          <View style={styles.premiumCard}>
            <View style={styles.merchantHeaderBlock}>
              <View style={styles.merchantIconWrapper}>
                <Text style={styles.merchantIconSymbol}>🏪</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.merchantCardPreTitle}>Store</Text>
                <Text style={styles.merchantCardName}>{order.vendors?.shop_name || 'Rivo Store Hub'}</Text>
              </View>
              <TouchableOpacity 
                style={styles.merchantCallInlineButton} 
                activeOpacity={0.6}
                onPress={handleCallStore}
              >
                <Text style={styles.merchantCallInlineText}>📞 Contact Store</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ORDER TIMELINE */}
          <View style={styles.premiumCard}>
            <Text style={styles.sectionHeader}>Order Timeline</Text>
            <View style={{ paddingLeft: 2, marginTop: 12 }}>
              {computedTimeline.map((milestone, index) => {
                const isLast = index === computedTimeline.length - 1;
                const isCompleted = milestone.created_at !== '';
                const isCurrent = milestone.status?.toLowerCase() === currentStatusStr || (currentStatusStr === 'packed' && milestone.status?.toLowerCase() === 'preparing');

                return (
                  <View key={milestone.id} style={{ flexDirection: 'row', minHeight: 68 }}>
                    <View style={{ alignItems: 'center', marginRight: 16 }}>
                      <View
                        style={[
                          styles.timelineNode,
                          {
                            backgroundColor: isCurrent ? '#22CC71' : isCompleted ? '#22CC7115' : '#F7F8FA',
                            borderColor: isCurrent || isCompleted ? '#22CC71' : '#EAEFF3',
                          },
                        ]}
                      >
                        {isCompleted && (
                          <Text style={[styles.nodeCheckIcon, { color: isCurrent ? '#FFFFFF' : '#22CC71' }]}>✓</Text>
                        )}
                      </View>
                      {!isLast && (
                        <View style={[styles.timelineLine, { backgroundColor: isCompleted ? '#22CC71' : '#EAEFF3' }]} />
                      )}
                    </View>

                    <View style={{ flex: 1, paddingBottom: isLast ? 0 : 16, paddingTop: 1 }}>
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: '800',
                          color: isCurrent ? '#22CC71' : isCompleted ? '#0D0D0D' : '#94A3B8',
                        }}
                      >
                        {formatStatus(milestone.status)}
                      </Text>
                      {isCompleted ? (
                        <Text style={styles.timelineTimestampText}>
                          {formatTimestamp(milestone.created_at)}
                        </Text>
                      ) : (
                        <Text style={styles.timelinePendingSubText}>Awaiting pipeline stage sequence</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* DELIVERY ADDRESS CARD */}
          <View style={styles.premiumCard}>
            <Text style={styles.sectionHeader}>Delivery Address</Text>
            {order.customer_addresses ? (
              <View style={styles.addressBlock}>
                <Text style={styles.addressText}>{order.customer_addresses.address_line1}</Text>
                {!!order.customer_addresses.address_line2 && (
                  <Text style={styles.addressText}>{order.customer_addresses.address_line2}</Text>
                )}
                {!!order.customer_addresses.landmark && (
                  <View style={styles.landmarkWrapperBox}>
                    <Text style={styles.addressSubtext}>📍 Landmark reference: {order.customer_addresses.landmark}</Text>
                  </View>
                )}
                <Text style={styles.addressCityBlockText}>
                  {order.customer_addresses.city}, {order.customer_addresses.state} - {order.customer_addresses.pin_code}
                </Text>
              </View>
            ) : (
              <Text style={styles.addressSubtext}>No delivery coordinates recorded.</Text>
            )}
          </View>

          {/* ORDER ITEMS SUMMARY */}
          <View style={styles.premiumCard}>
            <Text style={styles.sectionHeader}>Items Summary Checkout</Text>
            <View style={styles.itemsBlockWrapper}>
              {order.order_items.map((item, index) => (
                <View key={item.id || index} style={styles.itemRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {item.product?.name || 'Essential Product Variant Item'}
                    </Text>
                    <Text style={styles.itemQuantity}>Qty: {item.quantity} × ₹{item.unit_price}</Text>
                  </View>
                  <Text style={styles.itemTotal}>₹{item.total_price}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* BILL SUMMARY */}
          <View style={styles.premiumCard}>
            <View style={styles.billHeaderFlexRow}>
              <Text style={styles.sectionHeader}>Bill Summary</Text>
              <View style={styles.paymentMethodLabelBadge}>
                <Text style={styles.paymentMethodTextValue}>{order.payment_status?.toUpperCase() || 'PENDING'}</Text>
              </View>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Cart Items Subtotal</Text>
              <Text style={styles.billValue}>₹{order.subtotal}</Text>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Delivery Logistics Fee</Text>
              <Text style={styles.billValue}>₹{order.delivery_fee}</Text>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Platform Gateway Fee</Text>
              <Text style={styles.billValue}>₹{order.platform_fee}</Text>
            </View>
            
            <Text style={styles.taxNoticeDisclaimerText}>Prices shown inclusive of all retail domestic GST taxation nodes.</Text>

            <View style={styles.thickCardDivider} />

            <View style={[styles.billRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Grand Total Amount</Text>
              <Text style={styles.grandTotalValue}>₹{order.total_amount}</Text>
            </View>
          </View>

          {/* VIEW INVOICE BUTTON (CONDITIONALLY RENDERED BELOW BILL SUMMARY CARD) */}
          {order.order_status === "delivered" && (
            <TouchableOpacity 
              style={[styles.viewInvoiceButton]} 
              activeOpacity={0.8}
              onPress={() => router.push(`/orders/invoice/${order.id}`)}
            >
              <Text style={styles.viewInvoiceButtonText}>View Invoice</Text>
            </TouchableOpacity>
          )}

          {/* CANCEL ORDER SECTION BUTTON */}
          {isCancellationAllowed && (
            <TouchableOpacity 
              style={[styles.cancelOrderOutlineButton, isCancelling && styles.disabledButton]} 
              activeOpacity={0.7}
              onPress={handleOpenCancelModal}
              disabled={isCancelling}
            >
              <Text style={styles.cancelOrderOutlineButtonText}>
                {isCancelling ? "Processing..." : "Cancel Order"}
              </Text>
            </TouchableOpacity>
          )}

          {/* HELP ACTIONS SECTION */}
          <View style={styles.helpSectionCard}>
            <Text style={styles.helpTitleHeading}>Need assistance with this order?</Text>
            <Text style={styles.helpSubParagraph}>Our customer delight response desk is active 24/7 to resolve issues instantly.</Text>
            <View style={styles.helpActionsMatrixRow}>
              <Pressable style={({ pressed }) => [styles.helpSecondaryBtn, pressed && styles.microInteraction]}>
                <Text style={styles.helpSecondaryBtnText}>Report Issue</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.helpPrimaryBtn, pressed && styles.microInteraction]}>
                <Text style={styles.helpPrimaryBtnText}>Contact Support Desk</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </Animated.View>

      {/* CANCELLATION MODAL */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => !isCancelling && setShowCancelModal(false)} />
          <View style={styles.modalSheetContainer}>
            <View style={styles.modalHandleBar} />
            <Text style={styles.modalTitle}>Cancel Order</Text>
            <Text style={styles.modalSubtitle}>Please select a reason for cancelling your order:</Text>

            <View style={styles.reasonsListContainer}>
              {CANCELLATION_REASONS.map((reason) => {
                const isSelected = selectedCancelReason === reason;
                return (
                  <TouchableOpacity
                    key={reason}
                    activeOpacity={0.7}
                    disabled={isCancelling}
                    style={[
                      styles.reasonOptionCard,
                      isSelected && styles.reasonOptionCardSelected
                    ]}
                    onPress={() => setSelectedCancelReason(reason)}
                  >
                    <Text style={[styles.reasonOptionText, isSelected && styles.reasonOptionTextSelected]}>
                      {reason}
                    </Text>
                    <View style={[styles.radioButton, isSelected && styles.radioButtonSelected]}>
                      {isSelected && <Text style={styles.radioCheckIcon}>✓</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                activeOpacity={0.7}
                disabled={isCancelling}
                onPress={() => setShowCancelModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>Keep Order</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalContinueButton,
                  (!selectedCancelReason || isCancelling) && styles.modalContinueButtonDisabled
                ]}
                activeOpacity={0.8}
                onPress={handleConfirmCancel}
                disabled={!selectedCancelReason || isCancelling}
              >
                <Text style={styles.modalContinueButtonText}>
                  {isCancelling ? "Processing..." : "Continue"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEFF3',
    backgroundColor: '#FFFFFF',
    gap: 14,
  },
  backButtonIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EAEFF3',
  },
  backButtonTextSymbol: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0D0D0D',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0D0D0D',
    letterSpacing: -0.6,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 50,
  },
  heroStatusCard: {
    backgroundColor: '#0D0D0D',
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  heroMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeRowContainer: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  statusLiveBadge: {
    backgroundColor: '#22CC7118',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusLiveBadgeText: {
    color: '#22CC71',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  heroStatusHeading: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  animatedStatusIconWrapper: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#FFFFFF12',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF15',
  },
  statusEmojiGraphic: {
    fontSize: 24,
  },
  etaContainerBlock: {
    marginTop: 18,
    backgroundColor: '#FFFFFF08',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFFFFF05',
  },
  etaLabelText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  etaTimeText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#A8E63A',
    marginTop: 2,
  },
  progressLineContainer: {
    marginTop: 16,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: '#FFFFFF15',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#22CC71',
    borderRadius: 3,
  },
  progressMicroNotice: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 6,
  },
  cancelledInfoCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  cancelledCardHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#991B1B',
  },
  cancelledDivider: {
    height: 1,
    backgroundColor: '#FECACA',
    marginVertical: 12,
  },
  cancelledDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cancelledDetailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7F1D1D',
  },
  cancelledDetailValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991B1B',
    flexShrink: 1,
    marginLeft: 12,
  },
  mapPlaceholderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAEFF3',
    overflow: 'hidden',
    marginBottom: 14,
    shadowColor: '#0D0D0D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 1,
  },
  mapGraphicBackground: {
    height: 150,
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  mapRouteDottedPath: {
    position: 'absolute',
    height: 4,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#22CC71',
    borderRadius: 1,
    opacity: 0.4,
  },
  mapRiderMarkerBubble: {
    position: 'absolute',
    top: '35%',
    left: '30%',
    backgroundColor: '#22CC71',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#22CC71',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  mapCustomerMarkerBubble: {
    position: 'absolute',
    top: '55%',
    right: '25%',
    backgroundColor: '#0D0D0D',
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  mapMarkerIcon: {
    fontSize: 14,
  },
  mapCaptionBlock: {
    padding: 14,
    backgroundColor: '#FFFFFF',
  },
  mapCaptionMain: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D0D0D',
  },
  mapCaptionSub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 15,
  },
  premiumEcosystemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EAEFF3',
    marginBottom: 14,
    shadowColor: '#0D0D0D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeaderFlex: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCirclePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#22CC7112',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#22CC7125',
  },
  avatarEmojiSymbol: {
    fontSize: 20,
  },
  cardPreHeading: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cardMainHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D0D0D',
    marginTop: 1,
  },
  cardMetaSubText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 2,
  },
  cardActionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  communicationBtn: {
    flex: 1,
    backgroundColor: '#F7F8FA',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EAEFF3',
  },
  callRiderActiveBtn: {
    backgroundColor: '#22CC71',
    borderColor: '#22CC71',
  },
  callRiderActiveText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  premiumCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EAEFF3',
    shadowColor: '#0D0D0D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  merchantHeaderBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  merchantIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EAEFF3',
  },
  merchantIconSymbol: {
    fontSize: 18,
  },
  merchantCardPreTitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  merchantCardName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D0D0D',
    marginTop: 1,
  },
  merchantCallInlineButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: '#EAEFF3',
  },
  merchantCallInlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0D0D0D',
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  timelineNode: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  nodeCheckIcon: {
    fontSize: 10,
    fontWeight: '900',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
  },
  timelineTimestampText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '600',
  },
  timelinePendingSubText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  addressBlock: {
    backgroundColor: '#F7F8FA',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAEFF3',
  },
  addressText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D0D0D',
    lineHeight: 18,
  },
  landmarkWrapperBox: {
    marginTop: 4,
  },
  addressSubtext: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  addressCityBlockText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },
  itemsBlockWrapper: {
    backgroundColor: '#F7F8FA',
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAEFF3',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEFF3',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D0D0D',
    lineHeight: 18,
  },
  itemQuantity: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 3,
    fontWeight: '600',
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D0D0D',
  },
  billHeaderFlexRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  paymentMethodLabelBadge: {
    backgroundColor: '#22CC7115',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  paymentMethodTextValue: {
    fontSize: 10,
    fontWeight: '900',
    color: '#22CC71',
    letterSpacing: 0.5,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  billLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  billValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D0D0D',
  },
  taxNoticeDisclaimerText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
    marginTop: 6,
  },
  thickCardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 12,
  },
  grandTotalRow: {
    alignItems: 'center',
  },
  grandTotalLabel: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0D0D0D',
  },
  grandTotalValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#22CC71',
  },
  viewInvoiceButton: {
    width: '100%',
    backgroundColor: '#22CC71',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  viewInvoiceButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  helpSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EAEFF3',
    marginTop: 6,
  },
  helpTitleHeading: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0D0D0D',
  },
  helpSubParagraph: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 16,
  },
  helpActionsMatrixRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  helpSecondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#EF444430',
    backgroundColor: '#EF444408',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpSecondaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#EF4444',
  },
  helpPrimaryBtn: {
    flex: 1.3,
    backgroundColor: '#0D0D0D',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpPrimaryBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  notFoundText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
  },
  skeletonCircleButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EAEFF3',
  },
  skeletonTitleLine: {
    width: 120,
    height: 18,
    backgroundColor: '#EAEFF3',
    borderRadius: 4,
  },
  skeletonSubTitleLine: {
    width: 160,
    height: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
  },
  skeletonHeroCard: {
    height: 140,
    backgroundColor: '#EAEFF3',
    borderRadius: 20,
    marginBottom: 14,
  },
  skeletonMapCard: {
    height: 200,
    backgroundColor: '#EAEFF3',
    borderRadius: 22,
    marginBottom: 14,
  },
  skeletonInfoCard: {
    height: 100,
    backgroundColor: '#EAEFF3',
    borderRadius: 20,
    marginBottom: 14,
  },
  pressedMicro: {
    transform: [{ scale: 0.95 }],
    opacity: 0.85,
  },
  microInteraction: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  otpCardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B',
    textAlign: 'center',
  },
  otpCardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
    fontWeight: '500',
  },
  otpContainer: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignSelf: 'center',
    marginTop: 14,
    minWidth: 160,
    alignItems: 'center',
  },
  otpText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#10B981',
    letterSpacing: 4,
  },
  copyOtpButton: {
    alignSelf: 'center',
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  copyOtpButtonText: {
    color: '#10B981',
    fontWeight: '800',
    fontSize: 13,
  },
  otpCardWarning: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '600',
  },
  verifiedGreenCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    alignItems: 'center',
    paddingVertical: 18,
  },
  verifiedGreenTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#065F46',
  },
  verifiedGreenSubtitle: {
    fontSize: 13,
    color: '#047857',
    marginTop: 4,
    fontWeight: '500',
  },
  preparingMapTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1E293B',
  },
  preparingMapSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 16,
    fontWeight: '500',
  },
  cancelOrderOutlineButton: {
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  cancelOrderOutlineButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#EF4444',
  },
  disabledButton: {
    opacity: 0.6,
  },
  // Modal & Cancellation Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  modalSheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    maxHeight: '80%',
  },
  modalHandleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#EAEFF3',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0D0D0D',
    letterSpacing: -0.4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 16,
    fontWeight: '500',
  },
  reasonsListContainer: {
    gap: 10,
    marginVertical: 8,
  },
  reasonOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F7F8FA',
    borderWidth: 1.5,
    borderColor: '#EAEFF3',
  },
  reasonOptionCardSelected: {
    backgroundColor: '#22CC710D',
    borderColor: '#22CC71',
  },
  reasonOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  reasonOptionTextSelected: {
    color: '#0D0D0D',
    fontWeight: '700',
  },
  radioButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  radioButtonSelected: {
    backgroundColor: '#22CC71',
    borderColor: '#22CC71',
  },
  radioCheckIcon: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EAEFF3',
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  modalContinueButton: {
    flex: 1.2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContinueButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  modalContinueButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});