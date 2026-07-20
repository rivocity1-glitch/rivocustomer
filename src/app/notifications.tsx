import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Animated,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { supabase } from '../lib/supabase';

// --- Types & Interfaces ---
export type NotificationType =
  | 'order_placed'
  | 'order_accepted'
  | 'order_preparing'
  | 'out_for_delivery'
  | 'order_delivered'
  | 'order_cancelled'
  | 'promo_offer'
  | 'announcement'
  | 'system_update';

export interface Notification {
  id: string;
  recipient_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  type: NotificationType;
  recipient_type: 'customer';
  reference_id: string | null;
  metadata: Record<string, any> | null;
}

// --- Configuration Maps ---
const typeConfigs: Record<
  NotificationType | 'unknown',
  { icon: string; category: 'Orders' | 'Promos' | 'Announcements' | 'System' }
> = {
  order_placed: { icon: '🛒', category: 'Orders' },
  order_accepted: { icon: '👨‍🍳', category: 'Orders' },
  order_preparing: { icon: '🍲', category: 'Orders' },
  out_for_delivery: { icon: '🛵', category: 'Orders' },
  order_delivered: { icon: '😋', category: 'Orders' },
  order_cancelled: { icon: '❌', category: 'Orders' },
  promo_offer: { icon: '🎉', category: 'Promos' },
  announcement: { icon: '📢', category: 'Announcements' },
  system_update: { icon: '⚙️', category: 'System' },
  unknown: { icon: '🔔', category: 'System' },
};

const categoryColors = {
  Orders: { bg: '#E3F2FD', text: '#0D47A1' },
  Promos: { bg: '#E8F5E9', text: '#1B5E20' },
  Announcements: { bg: '#F3E5F5', text: '#4A148C' },
  System: { bg: '#ECEFF1', text: '#263238' },
};

// --- Utility Helpers ---
function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getGroupSection(dateString: string): 'Today' | 'Yesterday' | 'Earlier' {
  const now = new Date();
  const date = new Date(dateString);
  if (date.toDateString() === now.toDateString()) return 'Today';

  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return 'Earlier';
}

// --- Skeleton Component ---
const SkeletonCard = () => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(animatedValue, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.8],
  });

  return (
    <View style={styles.skeletonCard}>
      <View style={styles.cardHeader}>
        <Animated.View style={[styles.skeletonIcon, { opacity }]} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Animated.View style={[styles.skeletonText, { width: '60%', height: 16, opacity }]} />
          <Animated.View style={[styles.skeletonText, { width: '40%', height: 12, marginTop: 6, opacity }]} />
        </View>
      </View>
      <Animated.View style={[styles.skeletonText, { width: '90%', height: 14, marginTop: 12, opacity }]} />
    </View>
  );
};

// --- Main Component ---
export default function CustomerNotificationsScreen() {
  const router = useRouter();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [authUserId, setAuthUserId] = useState<string | null>(null);

  // Modal State
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [longPressedNotification, setLongPressedNotification] = useState<Notification | null>(null);

  // Fetch Notifications Logic using Auth User ID
  const fetchNotifications = async (showTriggerLoading = false) => {
    if (showTriggerLoading) setLoading(true);
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setAuthUserId(user.id);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_type', 'customer')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error('[CustomerNotifications] Fetch Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications(true);
  }, []);

  // Realtime Listener using Auth User ID
  useEffect(() => {
    if (!authUserId) return;

    const channelName = `realtime-customer-notifications-${authUserId}`;
    supabase.removeChannel(supabase.channel(channelName));

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_type=eq.customer`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          if (newNotif.recipient_id === authUserId) {
            setNotifications((prev) => [newNotif, ...prev]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_type=eq.customer`,
        },
        (payload) => {
          const updatedNotif = payload.new as Notification;
          if (updatedNotif.recipient_id === authUserId) {
            setNotifications((prev) =>
              prev.map((n) => (n.id === updatedNotif.id ? updatedNotif : n))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authUserId]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications(false);
  };

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  // Handle Tap & Navigation
  const handleNotificationTap = async (item: Notification) => {
    if (!item.is_read && authUserId) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );

      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', item.id)
        .eq('recipient_id', authUserId);

      if (error) {
        console.error('[CustomerNotifications] Read Update Error:', error.message);
      }
    }

    switch (item.type) {
      case 'order_placed':
      case 'order_accepted':
      case 'order_preparing':
      case 'out_for_delivery':
      case 'order_delivered':
      case 'order_cancelled':
        if (item.reference_id) {
          router.push(`/orders/${item.reference_id}` as any);
        } else {
          router.push('/orders' as any);
        }
        break;
      case 'promo_offer':
      case 'announcement':
      case 'system_update':
        setSelectedNotification(item);
        break;
      default:
        break;
    }
  };

  const handleMarkAsRead = async (id: string) => {
    if (!authUserId) return;

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setLongPressedNotification(null);

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('recipient_id', authUserId);

    if (error) {
      console.error('[CustomerNotifications] Read Update Error:', error.message);
    }
  };

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      const matchQuery = searchQuery.toLowerCase();
      return (
        n.title.toLowerCase().includes(matchQuery) ||
        n.message.toLowerCase().includes(matchQuery)
      );
    });
  }, [notifications, searchQuery]);

  const groupedNotifications = useMemo(() => {
    const groups: { Today: Notification[]; Yesterday: Notification[]; Earlier: Notification[] } = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };

    filteredNotifications.forEach((n) => {
      const targetGroup = getGroupSection(n.created_at);
      groups[targetGroup].push(n);
    });

    return groups;
  }, [filteredNotifications]);

  return (
    <View style={styles.container}>
      {/* Header View */}
      <View style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>🔔 Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.headerSubtitle}>
          Track orders, special promos, and store announcements.
        </Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search notifications"
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Content Scroller */}
      {loading ? (
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </ScrollView>
      ) : filteredNotifications.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#000" />}
        >
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptyDesc}>
            Updates about orders, offers, and announcements will appear here automatically.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#000" />}
        >
          {(['Today', 'Yesterday', 'Earlier'] as const).map((groupKey) => {
            const items = groupedNotifications[groupKey];
            if (items.length === 0) return null;

            return (
              <View key={groupKey} style={styles.sectionContainer}>
                <Text style={styles.sectionHeader}>{groupKey}</Text>
                {items.map((item) => {
                  const config = typeConfigs[item.type] || typeConfigs.unknown;
                  const colors = categoryColors[config.category];

                  return (
                    <TouchableOpacity
                      key={item.id}
                      activeOpacity={0.75}
                      onPress={() => handleNotificationTap(item)}
                      onLongPress={() => {
                        if (!item.is_read) setLongPressedNotification(item);
                      }}
                      style={[
                        styles.card,
                        !item.is_read && styles.unreadCardBorder,
                      ]}
                    >
                      <View style={styles.cardHeader}>
                        <View style={[styles.iconWrapper, { backgroundColor: colors.bg }]}>
                          <Text style={[styles.iconText, { color: colors.text }]}>{config.icon}</Text>
                        </View>
                        <View style={styles.titleWrapper}>
                          <Text
                            style={[styles.cardTitle, !item.is_read && styles.boldText]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          <Text style={styles.timeText}>
                            {formatRelativeTime(item.created_at)}
                          </Text>
                        </View>
                        {!item.is_read && <View style={styles.unreadDot} />}
                      </View>
                      <Text style={styles.cardMessage} numberOfLines={3}>
                        {item.message}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Long Press Modal */}
      <Modal
        visible={longPressedNotification !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setLongPressedNotification(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLongPressedNotification(null)}
        >
          <View style={styles.actionSheetContainer}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {longPressedNotification?.title}
            </Text>
            <TouchableOpacity
              style={styles.sheetButton}
              onPress={() => longPressedNotification && handleMarkAsRead(longPressedNotification.id)}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#2E7D32" />
              <Text style={styles.sheetButtonText}>Mark as Read</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetButton, styles.sheetCancelBtn]}
              onPress={() => setLongPressedNotification(null)}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Announcement/Detail Modal */}
      <Modal
        visible={selectedNotification !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedNotification(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>
                {selectedNotification?.type === 'promo_offer' ? '🎉 Special Offer' : '📢 Notification'}
              </Text>
              <TouchableOpacity onPress={() => setSelectedNotification(null)} style={styles.closeIconBtn}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitleText}>
                {selectedNotification?.title}
              </Text>
              <Text style={styles.modalDateText}>
                {selectedNotification?.created_at ? new Date(selectedNotification.created_at).toLocaleString('en-GB') : ''}
              </Text>
              <View style={styles.modalDivider} />
              <Text style={styles.modalMessageText}>
                {selectedNotification?.message}
              </Text>
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setSelectedNotification(null)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// --- Light Theme Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  headerContainer: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEAEA',
    backgroundColor: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: '#1A1A1A',
  },
  badgeContainer: {
    backgroundColor: '#E53935',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
    color: '#666666',
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    backgroundColor: '#EEEEEE',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
  },
  scrollContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionContainer: {
    marginTop: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
    color: '#666666',
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  unreadCardBorder: {
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D32',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 18,
  },
  titleWrapper: {
    flex: 1,
    marginLeft: 12,
    paddingRight: 8,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A1A',
  },
  boldText: {
    fontWeight: '700',
  },
  timeText: {
    fontSize: 11,
    marginTop: 2,
    color: '#666666',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2E7D32',
  },
  cardMessage: {
    fontSize: 13,
    lineHeight: 18,
    marginLeft: 48,
    color: '#666666',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1A1A1A',
  },
  emptyDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    color: '#666666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actionSheetContainer: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    backgroundColor: '#FFFFFF',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
    color: '#1A1A1A',
  },
  sheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 14,
    marginBottom: 12,
    backgroundColor: '#F5F5F5',
  },
  sheetButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2E7D32',
    marginLeft: 10,
  },
  sheetCancelBtn: {
    backgroundColor: 'transparent',
  },
  sheetCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  modalContent: {
    width: '100%',
    height: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  closeIconBtn: {
    padding: 4,
  },
  modalBody: {
    flex: 1,
  },
  modalTitleText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    marginBottom: 6,
    color: '#1A1A1A',
  },
  modalDateText: {
    fontSize: 12,
    marginBottom: 16,
    color: '#666666',
  },
  modalDivider: {
    height: 1,
    width: '100%',
    marginBottom: 16,
    backgroundColor: '#EEEEEE',
  },
  modalMessageText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#1A1A1A',
  },
  modalCloseButton: {
    backgroundColor: '#000000',
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  modalCloseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  skeletonCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  skeletonIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E0E0E0',
  },
  skeletonText: {
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
});