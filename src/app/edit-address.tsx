import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function EditAddressScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pinCode, setPinCode] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadAddress() {
      if (!id) {
        Alert.alert('Error', 'Address ID is missing.');
        router.back();
        return;
      }

      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('customer_addresses')
          .select('address_line1, address_line2, landmark, city, state, pin_code')
          .eq('id', id)
          .single();

        if (error) throw error;

        if (data) {
          setAddressLine1(data.address_line1 || '');
          setAddressLine2(data.address_line2 || '');
          setLandmark(data.landmark || '');
          setCity(data.city || '');
          setState(data.state || '');
          setPinCode(data.pin_code || '');
        }
      } catch (error: any) {
        console.error(error);
        Alert.alert('Error', 'Failed to load address details.');
        router.back();
      } finally {
        setLoading(false);
      }
    }

    loadAddress();
  }, [id]);

  const handleSave = async () => {
    if (!addressLine1 || !city || !state || !pinCode) {
      Alert.alert('Validation Error', 'Please complete the line 1, city, and pincode fields.');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('customer_addresses')
        .update({
          address_line1: addressLine1.trim(),
          address_line2: addressLine2.trim() || null,
          landmark: landmark.trim() || null,
          city: city.trim(),
          state: state.trim(),
          pin_code: pinCode.trim(),
        })
        .eq('id', id);

      if (error) throw error;
      router.replace('/addresses');
    } catch (error: any) {
      console.error(error);
      Alert.alert('Save Failed', error.message || 'Something went wrong while updating.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centeredLoading}>
        <ActivityIndicator size="large" color="#22CC71" />
      </View>
    );
  }

  return (
    <View style={styles.mainWrapper}>
      <View style={styles.topNavBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButtonIcon}>
          <Text style={styles.backButtonTextSymbol}>←</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Edit Destination Address</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.formGroupCard}>
          <Text style={styles.label}>Address Line 1 *</Text>
          <TextInput style={styles.input} value={addressLine1} onChangeText={setAddressLine1} placeholder="Flat, House no., Building" placeholderTextColor="#94A3B8" />

          <Text style={styles.label}>Address Line 2</Text>
          <TextInput style={styles.input} value={addressLine2} onChangeText={setAddressLine2} placeholder="Area, Street, Sector" placeholderTextColor="#94A3B8" />

          <Text style={styles.label}>Landmark / Directions</Text>
          <TextInput style={styles.input} value={landmark} onChangeText={setLandmark} placeholder="E.g. near Apollo hospital" placeholderTextColor="#94A3B8" />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>City *</Text>
              <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="City" placeholderTextColor="#94A3B8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>State *</Text>
              <TextInput style={styles.input} value={state} onChangeText={setState} placeholder="State" placeholderTextColor="#94A3B8" />
            </View>
          </View>

          <Text style={styles.label}>Pin Code *</Text>
          <TextInput style={styles.input} value={pinCode} onChangeText={setPinCode} placeholder="6-digit code" keyboardType="numeric" placeholderTextColor="#94A3B8" />
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveButtonText}>Update Destination Node</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
    gap: 14,
  },
  backButtonIcon: {
    width: 36,
    height: 36,
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
  navTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0D0D0D',
    letterSpacing: -0.5,
  },
  centeredLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    padding: 16,
  },
  formGroupCard: {
    backgroundColor: '#F7F8FA',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EAEFF3',
    marginBottom: 20,
    marginTop: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D0D0D',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#EAEFF3',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    fontWeight: '500',
    color: '#0D0D0D',
    backgroundColor: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
  },
  saveButton: {
    backgroundColor: '#22CC71',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#22CC71',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 40,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
});