import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  ChevronRight,
  Clock,
  Info,
  Package,
  Tag,
  Trash2,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  NotificationRecord,
  NotificationService,
  getResolvedCustomerId,
} from "../services/notificationService";

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);

  const loadNotifications = useCallback(async (cId: string) => {
    try {
      const { data, error } = await NotificationService.getNotifications(cId, "customer");
      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error("Error loading notifications:", err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      setLoading(true);
      const resolvedId = await getResolvedCustomerId();
      if (isMounted && resolvedId) {
        setCustomerId(resolvedId);
        await loadNotifications(resolvedId);
      }
      if (isMounted) setLoading(false);
    }

    init();

    return () => {
      isMounted = false;
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!customerId) return;

    const unsubscribe = NotificationService.subscribe(customerId, "customer", () => {
      loadNotifications(customerId);
    });

    return () => {
      unsubscribe();
    };
  }, [customerId, loadNotifications]);

  const handleRefresh = async () => {
    setRefreshing(true);
    const resolvedId = customerId || (await getResolvedCustomerId());
    if (resolvedId) {
      if (!customerId) setCustomerId(resolvedId);
      await loadNotifications(resolvedId);
    }
    setRefreshing(false);
  };

  const handleMarkAllAsRead = async () => {
    const resolvedId = customerId || (await getResolvedCustomerId());
    if (!resolvedId) return;

    try {
      await NotificationService.markAllAsRead(resolvedId, "customer");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  const handleNotificationPress = async (notification: NotificationRecord) => {
    if (!notification.is_read) {
      try {
        await NotificationService.markAsRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
        );
      } catch (err) {
        console.error("Error marking as read:", err);
      }
    }

    if (notification.action_url && notification.action_url.startsWith("/")) {
      router.push(notification.action_url as any);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await NotificationService.softDelete(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  const getIconConfig = (type: string | null) => {
    switch (type) {
      case "order_status":
      case "order":
        return {
          icon: <Package size={20} color="#16A34A" />,
          bg: "#DCFCE7",
        };
      case "offer":
      case "promo":
        return {
          icon: <Tag size={20} color="#D97706" />,
          bg: "#FEF3C7",
        };
      default:
        return {
          icon: <Info size={20} color="#0284C7" />,
          bg: "#E0F2FE",
        };
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={22} color="#0F172A" />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {unreadCount} {unreadCount === 1 ? "new" : "new"}
                </Text>
              </View>
            )}
          </View>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={handleMarkAllAsRead}
            style={styles.markReadBtn}
            activeOpacity={0.7}
          >
            <CheckCheck size={14} color="#16A34A" />
            <Text style={styles.markReadText}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#16A34A" />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconContainer}>
            <Bell size={32} color="#94A3B8" />
          </View>
          <Text style={styles.emptyTitle}>No notifications yet</Text>
          <Text style={styles.emptySubtitle}>
            We'll notify you when there's an update on your order, promos, or account.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={["#16A34A"]}
              tintColor="#16A34A"
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const { icon, bg } = getIconConfig(item.type);

            return (
              <TouchableOpacity
                onPress={() => handleNotificationPress(item)}
                activeOpacity={0.85}
                style={[
                  styles.card,
                  !item.is_read && styles.unreadCardAccent,
                ]}
              >
                {/* Icon Squircle */}
                <View style={[styles.iconWrapper, { backgroundColor: bg }]}>
                  {icon}
                </View>

                {/* Main Body */}
                <View style={styles.cardContent}>
                  <View style={styles.cardHeaderRow}>
                    <Text
                      style={[
                        styles.notificationTitle,
                        !item.is_read && styles.unreadTextBold,
                      ]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>

                    <View style={styles.timeRow}>
                      <Clock size={11} color="#94A3B8" />
                      <Text style={styles.timeText}>
                        {formatTime(item.created_at)}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.notificationBody,
                      !item.is_read && styles.unreadBodyText,
                    ]}
                  >
                    {item.message}
                  </Text>

                  {/* Footer Action Bar */}
                  <View style={styles.cardFooter}>
                    {item.action_url ? (
                      <View style={styles.actionPrompt}>
                        <Text style={styles.actionPromptText}>View Details</Text>
                        <ChevronRight size={14} color="#16A34A" />
                      </View>
                    ) : (
                      <View />
                    )}

                    <TouchableOpacity
                      onPress={() => handleDelete(item.id)}
                      style={styles.deleteBtn}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Trash2 size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Unread Accent Dot */}
                {!item.is_read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  unreadBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#16A34A",
  },
  markReadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  markReadText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#16A34A",
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 6,
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...Platform.select({
      ios: {
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  unreadCardAccent: {
    backgroundColor: "#FCFDFE",
    borderColor: "#CBD5E1",
    borderLeftWidth: 4,
    borderLeftColor: "#16A34A",
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    flex: 1,
    marginRight: 8,
  },
  unreadTextBold: {
    fontWeight: "700",
    color: "#0F172A",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "500",
  },
  notificationBody: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 19,
    fontWeight: "400",
  },
  unreadBodyText: {
    color: "#334155",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  actionPrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  actionPromptText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#16A34A",
  },
  deleteBtn: {
    padding: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16A34A",
    position: "absolute",
    top: 18,
    right: 14,
  },
});