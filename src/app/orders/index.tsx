import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { supabase } from '../../lib/supabase';

interface Order {
  id: string;
  order_number: string;
  total_amount: number;
  payment_status: string;
  order_status: string;
  created_at: string;
}

export default function OrdersScreen() {
  const router = useRouter();
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [pastOrders, setPastOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = async () => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error('User not authenticated');
      }

      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (customerError || !customer) {
        throw new Error('Customer profile not found');
      }

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total_amount,
          payment_status,
          order_status,
          created_at
        `)
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const ordersList = (data || []) as Order[];

      const activeStatuses = [
        'accepted',
        'preparing',
        'packed',
        'out_for_delivery'
      ];
      
      const active = ordersList.filter(
        order => activeStatuses.includes(order.order_status)
      );
      const past = ordersList.filter(
        order => !activeStatuses.includes(order.order_status)
      );

      setActiveOrders(active);
      setPastOrders(past);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getStatusStyles = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return { bg: '#22CC7115', text: '#22CC71' }; // Primary Green Rivo theme
      case 'out_for_delivery':
      case 'preparing':
      case 'accepted':
      case 'packed':
        return { bg: '#A8E63A20', text: '#7CB31D' }; // Secondary Lime theme
      case 'cancelled':
      case 'rejected':
        return { bg: '#EF444415', text: '#EF4444' }; // Red theme
      default:
        return { bg: '#F7F8FA', text: '#0D0D0D' }; // Surface / Dark theme
    }
  };

  const renderOrderCard = (order: Order) => {
    const badge = getStatusStyles(order.order_status);
    const isPaid = order.payment_status.toLowerCase() === 'paid';
    const isActive = [
      'accepted',
      'preparing',
      'packed',
      'out_for_delivery'
    ].includes(order.order_status.toLowerCase());

    return (
      <View key={order.id} style={styles.card}>
        {/* Top Meta info row */}
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.metaLabel}>Order Reference</Text>
            <Text style={styles.orderNumber}>#{order.order_number}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.text }]}>
              {formatStatus(order.order_status)}
            </Text>
          </View>
        </View>

        {/* Pricing and Date Matrix Row */}
        <View style={styles.matrixRow}>
          <View>
            <Text style={styles.matrixLabel}>Total Bill Amount</Text>
            <Text style={styles.totalAmount}>₹{order.total_amount}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.matrixLabel}>Placed On</Text>
            <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
          </View>
        </View>

        {/* Payment & Action Area Row */}
        <View style={styles.cardFooter}>
          <View style={styles.paymentStatusContainer}>
            <View style={[styles.statusDot, { backgroundColor: isPaid ? '#22CC71' : '#F59E0B' }]} />
            <Text style={[styles.paymentStatusText, { color: isPaid ? '#22CC71' : '#F59E0B' }]}>
              {order.payment_status.toUpperCase()}
            </Text>
          </View>

          <View style={styles.actionButtonsRow}>
            {isActive ? (
              <TouchableOpacity
                onPress={() =>
                  router.push({ pathname: '/orders/[id]', params: { id: order.id } })
                }
                style={styles.trackOrderButton}
                activeOpacity={0.8}
              >
                <Text style={styles.trackOrderButtonText}>Track Live ⚡</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() =>
                  router.push({ pathname: '/orders/[id]', params: { id: order.id } })
                }
                style={styles.repeatOrderButton}
                activeOpacity={0.8}
              >
                <Text style={styles.repeatOrderButtonText}>View & Repeat</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() =>
                router.push({ pathname: '/orders/[id]', params: { id: order.id } })
              }
              style={styles.viewDetailsButton}
              activeOpacity={0.6}
            >
              <Text style={styles.viewDetailsText}>➔</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>My Orders</Text>
        </View>
        {/* Premium Skeleton Loading Layout Placeholder */}
        <View style={{ paddingHorizontal: 20, gap: 16, marginTop: 12 }}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={[styles.card, { opacity: 0.6, borderColor: '#F1F5F9' }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                <View style={{ gap: 4 }}>
                  <View style={{ width: 80, height: 10, backgroundColor: '#E2E8F0', borderRadius: 4 }} />
                  <View style={{ width: 120, height: 16, backgroundColor: '#E2E8F0', borderRadius: 4 }} />
                </View>
                <View style={{ width: 80, height: 24, backgroundColor: '#E2E8F0', borderRadius: 12 }} />
              </View>
              <View style={{ height: 48, backgroundColor: '#F7F8FA', borderRadius: 12 }} />
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.headerTitle}>My Orders</Text>
        <Text style={styles.headerSubtitle}>Real-time quick commerce logs</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22CC71" />
        }
      >
        {/* Active Segment */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Active Orders</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{activeOrders.length}</Text>
            </View>
          </View>
          {activeOrders.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateIcon}>🛵</Text>
              <Text style={styles.emptyStateTitle}>No ongoing orders</Text>
              <Text style={styles.emptyStateSubtext}>Your packages will show up live here once placed.</Text>
            </View>
          ) : (
            activeOrders.map(renderOrderCard)
          )}
        </View>

        {/* Historical Segment */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Past Orders</Text>
            <View style={[styles.countBadge, { backgroundColor: '#F7F8FA' }]}>
              <Text style={[styles.countBadgeText, { color: '#64748B' }]}>{pastOrders.length}</Text>
            </View>
          </View>
          {pastOrders.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateIcon}>📦</Text>
              <Text style={styles.emptyStateTitle}>No order history</Text>
              <Text style={styles.emptyStateSubtext}>Looks like you haven't bought anything from Rivo stores yet.</Text>
            </View>
          ) : (
            pastOrders.map(renderOrderCard)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0D0D0D',
    letterSpacing: -0.6,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  section: {
    marginTop: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D0D0D',
    letterSpacing: 0.5,
  },
  countBadge: {
    backgroundColor: '#22CC7115',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#22CC71',
  },
  emptyStateContainer: {
    backgroundColor: '#F7F8FA',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EAEFF3',
    borderStyle: 'dashed',
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D0D0D',
  },
  emptyStateSubtext: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0D0D0D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.02,
    shadowRadius: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  metaLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0D0D0D',
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  matrixRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F7F8FA',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EAEFF3',
  },
  matrixLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0D0D0D',
    marginTop: 1,
  },
  orderDate: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginTop: 1,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  paymentStatusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackOrderButton: {
    backgroundColor: '#22CC71',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  trackOrderButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  repeatOrderButton: {
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: '#EAEFF3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  repeatOrderButtonText: {
    color: '#0D0D0D',
    fontWeight: '700',
    fontSize: 12,
  },
  viewDetailsButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EAEFF3',
  },
  viewDetailsText: {
    color: '#64748B',
    fontWeight: '800',
    fontSize: 12,
  },
});