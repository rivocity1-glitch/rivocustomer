import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const categories = ['App experience', 'Stores', 'Orders', 'Delivery', 'Payments', 'Other'];

export default function FeedbackScreen() {
  const router = useRouter();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState('App experience');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadCustomer() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace('/login');
          return;
        }

        const { data, error } = await supabase
          .from('customers')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Customer profile could not be found.');
        if (mounted) setCustomerId(data.id);
      } catch (error: any) {
        console.error('Customer feedback profile load failed:', error);
        Alert.alert('Unable to load feedback', error?.message || 'Please try again later.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadCustomer();
    return () => {
      mounted = false;
    };
  }, [router]);

  async function submitFeedback() {
    if (!customerId || submitting) return;

    if (rating < 1) {
      Alert.alert('Rating required', 'Please select a rating from 1 to 5.');
      return;
    }

    if (message.trim().length < 3) {
      Alert.alert('Feedback required', 'Please tell us a little about your experience.');
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase.from('customer_feedback').insert({
        customer_id: customerId,
        rating,
        message: message.trim(),
        category,
        status: 'unread',
      });

      if (error) throw error;

      Alert.alert('Thank you', 'Your feedback has been sent to the Rivo team.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
      setRating(0);
      setMessage('');
    } catch (error: any) {
      console.error('Customer feedback submission failed:', error);
      Alert.alert('Unable to send feedback', error?.message || 'Please try again later.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconButton} hitSlop={8}>
          <Ionicons name="arrow-back" size={21} color="#0D0D0D" />
        </Pressable>
        <Text style={styles.headerTitle}>Send Feedback</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#16A34A" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="star-outline" size={24} color="#16A34A" />
            </View>
            <Text style={styles.heroTitle}>How was your Rivo experience?</Text>
            <Text style={styles.heroText}>
              Your feedback helps us improve the app and service for everyone.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Your rating</Text>
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setRating(value)}
                  hitSlop={6}
                  style={styles.starButton}
                  accessibilityRole="button"
                  accessibilityLabel={`${value} star${value === 1 ? '' : 's'}`}
                >
                  <Ionicons
                    name={value <= rating ? 'star' : 'star-outline'}
                    size={34}
                    color={value <= rating ? '#F59E0B' : '#CBD5E1'}
                  />
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, styles.categoryLabel]}>Category</Text>
            <View style={styles.categoryWrap}>
              {categories.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setCategory(item)}
                  style={[styles.category, item === category && styles.categoryActive]}
                >
                  <Text style={[styles.categoryText, item === category && styles.categoryTextActive]}>
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.label, styles.messageLabel]}>Your feedback</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Tell us what you liked or what we can improve..."
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
              maxLength={1000}
              style={styles.textarea}
            />
            <Text style={styles.counter}>{message.length}/1000</Text>

            <Pressable
              onPress={submitFeedback}
              disabled={submitting}
              style={[styles.submitButton, submitting && styles.disabled]}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="send-outline" size={18} color="#FFFFFF" />
              )}
              <Text style={styles.submitText}>{submitting ? 'Sending...' : 'Send Feedback'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
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
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0D0D0D' },
  headerSpacer: { width: 38 },
  content: { padding: 16, paddingBottom: 48 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  heroTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900' },
  heroText: { color: '#CBD5E1', fontSize: 13, lineHeight: 19, marginTop: 6 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  label: { fontSize: 14, fontWeight: '800', color: '#0D0D0D' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  starButton: { marginRight: 6 },
  categoryLabel: { marginTop: 22, marginBottom: 10 },
  categoryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  category: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  categoryActive: { backgroundColor: '#F0FDF4', borderColor: '#16A34A' },
  categoryText: { color: '#64748B', fontSize: 12, fontWeight: '700' },
  categoryTextActive: { color: '#15803D' },
  messageLabel: { marginTop: 22, marginBottom: 10 },
  textarea: {
    minHeight: 150,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingTop: 13,
    color: '#0D0D0D',
    backgroundColor: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  counter: { alignSelf: 'flex-end', color: '#94A3B8', fontSize: 11, marginTop: 5 },
  submitButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#16A34A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  submitText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.6 },
});
