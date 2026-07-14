import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

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
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  payment_status: string;
  order_status: string;
  created_at: string;
  vendors: {
    shop_name: string;
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
}

interface TrackingMilestone {
  id: string;
  order_id: string;
  status: string;
  created_at: string;
}

const { width } = Dimensions.get('window');

export default function OrderTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [timeline, setTimeline] = useState<TrackingMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Animations System
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const skeletonAnim = useRef(new Animated.Value(0.3)).current;

  // Pulse animation for active delivery milestones or status nodes
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
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

      // 1. Fetch deep integrated order layout data[cite: 17]
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          subtotal,
          delivery_fee,
          total_amount,
          payment_status,
          order_status,
          created_at,
          vendors ( shop_name ),
          customer_addresses ( address_line1, address_line2, landmark, city, state, pin_code ),
          order_items (
            id,
            quantity,
            unit_price,
            total_price,
            product:products ( name )
          )
        `)
        .eq('id', id)
        .maybeSingle();

      if (orderError) throw orderError;
      setOrder(orderData as unknown as OrderDetails);

      // 2. Fetch tracking milestones[cite: 17]
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

    // Set up Realtime listener targeting current order changes[cite: 17]
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
          console.log('Realtime order status stream update payload received:', payload);
          if (payload.new) {
            // Hot swap structural mutations into existing localized memory configurations[cite: 17]
            setOrder((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                order_status: payload.new.order_status ?? prev.order_status,
                payment_status: payload.new.payment_status ?? prev.payment_status,
              };
            });
            
            // Re-fetch milestones to sync up the physical database updates seamlessly[cite: 17]
            const fetchMilestonesSilently = async () => {
              const { data } = await supabase
                .from('order_tracking')
                .select('id, order_id, status, created_at')
                .eq('order_id', id)
                .order('created_at', { ascending: true });
              if (data) setTimeline(data);
            };
            fetchMilestonesSilently();
          }
        }
      )
      .subscribe();

    // Cleanup subscription pipeline stack reference mappings on component teardown[cite: 17]
    return () => {
      supabase.removeChannel(orderSubscription);
    };
  }, [id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrderAndTrackingDetails();
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
    });
    const time = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return `${dayAndYear}, ${time}`;
  };

  // Generate a computed timeline layout if tracking data is empty[cite: 17]
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

  // Premium Shimmer Skeleton Loading view logic
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

  const isCancelled = order.order_status.toLowerCase() === 'cancelled';
  const isDelivered = order.order_status.toLowerCase() === 'delivered';

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Top Navigation Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButtonIcon, pressed && styles.pressedMicro]}>
          <Text style={styles.backButtonTextSymbol}>←</Text>
        </Pressable>
        <View>
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
          {/* LARGE HERO STATUS CARD */}
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

            {/* Delivery Progress Line Accent */}
            {!isCancelled && !isDelivered && (
              <View style={styles.progressLineContainer}>
                <View style={styles.progressBarBackground}>
                  <View style={[styles.progressBarFill, { width: order.order_status.toLowerCase() === 'out_for_delivery' ? '85%' : order.order_status.toLowerCase() === 'packed' ? '60%' : '35%' }]} />
                </View>
                <Text style={styles.progressMicroNotice}>⚡ Rivo priority fulfillment channel active</Text>
              </View>
            )}
          </View>

          {/* PREMIUM MAP ROUTE PLACEHOLDER */}
          {!isCancelled && !isDelivered && (
            <View style={styles.mapPlaceholderCard}>
              <View style={styles.mapGraphicBackground}>
                {/* SVG Route Simulation Accent Dots */}
                <View style={[styles.mapRouteDottedPath, { width: '60%', top: '50%', left: '20%' }]} />
                <View style={styles.mapRiderMarkerBubble}>
                  <Text style={styles.mapMarkerIcon}>🛵</Text>
                </View>
                <View style={styles.mapCustomerMarkerBubble}>
                  <Text style={styles.mapMarkerIcon}>🏠</Text>
                </View>
              </View>
              <View style={styles.mapCaptionBlock}>
                <Text style={styles.mapCaptionMain}>Ecosystem Fleet Delivery Blueprint</Text>
                <Text style={styles.mapCaptionSub}>Live courier navigation updates refresh coordinates continuously</Text>
              </View>
            </View>
          )}

          {/* RIDER PANE CARD */}
          {!isCancelled && (
            <View style={styles.premiumEcosystemCard}>
              <View style={styles.cardHeaderFlex}>
                <View style={styles.avatarCirclePlaceholder}>
                  <Text style={styles.avatarEmojiSymbol}>🚴</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardPreHeading}>Rivo Fleet Delivery Pilot</Text>
                  <Text style={styles.cardMainHeading}>{isDelivered ? 'Fulfillment Executive' : 'Assigning Courier Executive...'}</Text>
                  <Text style={styles.cardMetaSubText}>⭐ 4.9 Rating • Hero Eco Vehicle</Text>
                </View>
              </View>
              <View style={styles.cardActionButtonsRow}>
                <Pressable style={({ pressed }) => [styles.communicationBtn, pressed && styles.microInteraction]}>
                  <Text style={styles.communicationBtnText}>📞 Call Pilot</Text>
                </Pressable>
                <TouchableOpacity style={[styles.communicationBtn, styles.chatBtnActionAccent]} activeOpacity={0.7}>
                  <Text style={styles.chatBtnText}>💬 Chat Instant</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* MERCHANT STORE CARD */}
          <View style={styles.premiumCard}>
            <View style={styles.merchantHeaderBlock}>
              <View style={styles.merchantIconWrapper}>
                <Text style={styles.merchantIconSymbol}>🏪</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.merchantCardPreTitle}>Fulfilling Hub Partner</Text>
                <Text style={styles.merchantCardName}>{order.vendors?.shop_name || 'Rivo Elite Hub'}</Text>
              </View>
              <TouchableOpacity style={styles.merchantCallInlineButton} activeOpacity={0.6}>
                <Text style={styles.merchantCallInlineText}>📞 Contact Store</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* MODERN VERTICAL TRACKING TIMELINE */}
          <View style={styles.premiumCard}>
            <Text style={styles.sectionHeader}>Tracking Lifecycle Timeline</Text>
            <View style={{ paddingLeft: 2, marginTop: 12 }}>
              {computedTimeline.map((milestone, index) => {
                const isLast = index === computedTimeline.length - 1;
                const isCompleted = milestone.created_at !== '';
                const currentStatusStr = order.order_status.toLowerCase();
                const isCurrent = milestone.status?.toLowerCase() === currentStatusStr || (currentStatusStr === 'packed' && milestone.status?.toLowerCase() === 'preparing');

                return (
                  <View key={milestone.id} style={{ flexDirection: 'row', minHeight: 68 }}>
                    {/* Left Timeline Node Line Handle System */}
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

                    {/* Right Milestone Content context values */}
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

          {/* SHIPPING DESTINATION ADDRESS CARD */}
          <View style={styles.premiumCard}>
            <Text style={styles.sectionHeader}>Delivery Destination Address</Text>
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
              <Text style={styles.addressSubtext}>No specified location bounds available.</Text>
            )}
          </View>

          {/* ORDER SUMMARY PREMIUM CONTAINER */}
          <View style={styles.premiumCard}>
            <Text style={styles.sectionHeader}>Items Summary Checkout</Text>
            <View style={styles.itemsBlockWrapper}>
              {order.order_items.map((item, index) => (
                <View key={item.id || index} style={styles.itemRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {item.product?.name || 'Essential Product Variant Item'}
                    </Text>
                    <Text style={styles.itemQuantity}>Qty mapping parameters: {item.quantity} × ₹{item.unit_price}</Text>
                  </View>
                  <Text style={styles.itemTotal}>₹{item.total_price}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* CHARGES BILL SUMMARY BREAKDOWN */}
          <View style={styles.premiumCard}>
            <View style={styles.billHeaderFlexRow}>
              <Text style={styles.sectionHeader}>Bill Details Invoice</Text>
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
              <Text style={styles.billValue}>₹3</Text>
            </View>
            
            <Text style={styles.taxNoticeDisclaimerText}>Prices shown inclusive of all retail domestic GST taxation nodes.</Text>

            <View style={styles.thickCardDivider} />

            <View style={[styles.billRow, styles.grandTotalRow]}>
              <Text style={styles.grandTotalLabel}>Grand Total Amount</Text>
              <Text style={styles.grandTotalValue}>₹{order.total_amount}</Text>
            </View>
          </View>

          {/* HELP SECTION BUTTON PANE */}
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
    marginTop: 16,
  },
  communicationBtn: {
    flex: 1,
    backgroundColor: '#F7F8FA',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EAEFF3',
  },
  communicationBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D0D0D',
  },
  chatBtnActionAccent: {
    backgroundColor: '#22CC7110',
    borderColor: '#22CC7130',
  },
  chatBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#22CC71',
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
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: '#EAEFF3',
  },
  merchantCallInlineText: {
    fontSize: 11,
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
});