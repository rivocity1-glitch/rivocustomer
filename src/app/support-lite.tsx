import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

type Ticket = {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'high' | 'medium' | 'low';
  issue_type: string | null;
  created_at: string;
};

const statusLabel: Record<Ticket['status'], string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function SupportLiteScreen() {
  const router = useRouter();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeForm, setActiveForm] = useState<'problem' | null>(null);
  const [problemTitle, setProblemTitle] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadTickets = useCallback(async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace('/login');
        return;
      }

      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('auth_user_id', user.id)
        .maybeSingle();

      if (customerError) throw customerError;
      if (!customer) {
        throw new Error('Customer profile could not be found.');
      }

      setCustomerId(customer.id);

      const { data, error } = await supabase
        .from('customer_support_tickets')
        .select('id,title,description,status,priority,issue_type,created_at')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTickets((data || []) as Ticket[]);
    } catch (error: any) {
      console.error('Support tickets load failed:', error);
      Alert.alert(
        'Unable to load support',
        error?.message || 'Please try again later.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  async function submitProblem() {
    if (!customerId || submitting) return;

    if (!problemTitle.trim()) {
      Alert.alert('Title required', 'Please enter a short problem title.');
      return;
    }

    if (problemDescription.trim().length < 5) {
      Alert.alert('Description required', 'Please describe the problem.');
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase
        .from('customer_support_tickets')
        .insert({
          customer_id: customerId,
          title: problemTitle.trim(),
          description: problemDescription.trim(),
          status: 'open',
          priority: 'medium',
          issue_type: 'problem',
          screenshot_url: null,
          unread_for_admin: true,
          unread_for_customer: false,
          last_message_at: null,
        });

      if (error) throw error;

      setProblemTitle('');
      setProblemDescription('');
      setActiveForm(null);
      await loadTickets(false);

      Alert.alert(
        'Problem reported',
        'Your report has been sent to the Rivo support team.'
      );
    } catch (error: any) {
      console.error('Problem report submission failed:', error);
      Alert.alert(
        'Unable to report problem',
        error?.message || 'Please try again later.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.iconButton}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={21} color="#0D0D0D" />
        </Pressable>

        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadTickets(false);
            }}
            tintColor="#16A34A"
          />
        }
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="headset-outline" size={24} color="#16A34A" />
          </View>

          <Text style={styles.heroTitle}>Rivo Support Center</Text>
          <Text style={styles.heroText}>
            Send feedback, report a problem, or contact the Rivo support team.
          </Text>
        </View>

        <View style={styles.actionGrid}>
          <Pressable
            onPress={() => router.push('/feedback' as any)}
            style={styles.actionCard}
          >
            <View style={styles.actionIcon}>
              <Ionicons name="star-outline" size={22} color="#16A34A" />
            </View>
            <Text style={styles.actionTitle}>Send Feedback</Text>
            <Text style={styles.actionText}>
              Rate your experience and help us improve Rivo.
            </Text>
          </Pressable>

          <Pressable
            onPress={() =>
              setActiveForm(
                activeForm === 'problem' ? null : 'problem'
              )
            }
            style={styles.actionCard}
          >
            <View style={[styles.actionIcon, styles.problemIcon]}>
              <Ionicons name="flag-outline" size={22} color="#DC2626" />
            </View>
            <Text style={styles.actionTitle}>Report a Problem</Text>
            <Text style={styles.actionText}>
              Tell us about something that went wrong.
            </Text>
          </Pressable>
        </View>

        {activeForm === 'problem' && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Report a Problem</Text>

            <TextInput
              value={problemTitle}
              onChangeText={setProblemTitle}
              placeholder="Problem title"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />

            <TextInput
              value={problemDescription}
              onChangeText={setProblemDescription}
              placeholder="Describe the problem..."
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
              style={[styles.input, styles.textarea]}
            />

            <View style={styles.formActions}>
              <Pressable
                onPress={() => setActiveForm(null)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={submitProblem}
                disabled={submitting}
                style={[styles.submitButton, submitting && styles.disabled]}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Ionicons
                    name="send-outline"
                    size={17}
                    color="#FFFFFF"
                  />
                )}
                <Text style={styles.submitText}>
                  {submitting ? 'Sending...' : 'Submit'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        <Pressable
          onPress={() => router.push('/legal/contact')}
          style={styles.contactCard}
        >
          <View style={styles.contactIcon}>
            <Ionicons name="mail-outline" size={20} color="#16A34A" />
          </View>

          <View style={styles.contactText}>
            <Text style={styles.contactLabel}>Contact Us</Text>
            <Text style={styles.contactValue}>support@rivocity.com</Text>
          </View>

          <Ionicons name="chevron-forward" size={19} color="#94A3B8" />
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Support Requests</Text>
          <Text style={styles.sectionCount}>{tickets.length}</Text>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color="#16A34A" />
          </View>
        ) : tickets.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="documents-outline"
              size={30}
              color="#CBD5E1"
            />
            <Text style={styles.emptyTitle}>No support requests</Text>
            <Text style={styles.emptyText}>
              Problem reports you submit will appear here.
            </Text>
          </View>
        ) : (
          tickets.map((ticket) => (
            <View key={ticket.id} style={styles.ticketCard}>
              <View style={styles.ticketTop}>
                <View style={styles.ticketTitleBlock}>
                  <Text
                    style={styles.ticketTitle}
                    numberOfLines={1}
                  >
                    {ticket.title}
                  </Text>
                  <Text style={styles.ticketMeta}>
                    {ticket.issue_type || 'Support'} ·{' '}
                    {formatDate(ticket.created_at)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    ticket.status === 'resolved'
                      ? styles.statusResolved
                      : ticket.status === 'closed'
                        ? styles.statusClosed
                        : styles.statusOpen,
                  ]}
                >
                  <Text style={styles.statusText}>
                    {statusLabel[ticket.status]}
                  </Text>
                </View>
              </View>

              <Text
                style={styles.ticketDescription}
                numberOfLines={3}
              >
                {ticket.description}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EAEFF3',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0D0D0D',
  },
  headerSpacer: {
    width: 38,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  hero: {
    backgroundColor: '#0D0D0D',
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
  },
  heroText: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  actionCard: {
    flex: 1,
    minHeight: 148,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  problemIcon: {
    backgroundColor: '#FEF2F2',
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0D0D0D',
  },
  actionText: {
    fontSize: 11,
    lineHeight: 16,
    color: '#64748B',
    marginTop: 5,
  },
  formCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 12,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0D0D0D',
    marginBottom: 12,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 13,
    paddingHorizontal: 13,
    color: '#0D0D0D',
    backgroundColor: '#FFFFFF',
    fontSize: 14,
    marginBottom: 10,
  },
  textarea: {
    minHeight: 120,
    paddingTop: 13,
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 9,
    marginTop: 2,
  },
  cancelButton: {
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  submitButton: {
    minHeight: 44,
    borderRadius: 13,
    paddingHorizontal: 17,
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.6,
  },
  contactCard: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 17,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactText: {
    flex: 1,
    marginLeft: 11,
  },
  contactLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D0D0D',
  },
  contactValue: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0D0D0D',
  },
  sectionCount: {
    minWidth: 28,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    color: '#15803D',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
  },
  loading: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  emptyCard: {
    minHeight: 150,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D0D0D',
    marginTop: 9,
  },
  emptyText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
  ticketCard: {
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  ticketTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  ticketTitleBlock: {
    flex: 1,
  },
  ticketTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D0D0D',
  },
  ticketMeta: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 3,
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  statusOpen: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  statusResolved: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  statusClosed: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  ticketDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
    marginTop: 9,
  },
});