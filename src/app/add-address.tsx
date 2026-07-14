import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function AddAddressScreen() {
  const router = useRouter();
  
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [landmark, setLandmark] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [addressType, setAddressType] = useState('home'); // Fixed: Defaulting to lowercase for exact database alignment
  
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  const handleUseCurrentLocation = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access location was denied.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const currentLat = location.coords.latitude;
      const currentLng = location.coords.longitude;
      
      setLatitude(currentLat);
      setLongitude(currentLng);

      const geocode = await Location.reverseGeocodeAsync({
        latitude: currentLat,
        longitude: currentLng,
      });

      if (geocode && geocode.length > 0) {
        const place = geocode[0];
        setCity(place.city || '');
        setState(place.region || '');
        setPinCode(place.postalCode || '');
        setLandmark(place.street || place.district || '');
      }

      Alert.alert('Success', 'Location details fetched successfully!');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to fetch current location.');
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async () => {
    if (!addressLine1 || !city || !state || !pinCode) {
      Alert.alert('Validation Error', 'Please fill in all mandatory fields (Line 1, City, State, Pin Code).');
      return;
    }

    try {
      setLoading(true);

      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error('User not authenticated');

      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (customerError || !customer) throw new Error('Customer record not found');

      const { count, error: countError } = await supabase
        .from('customer_addresses')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', customer.id);

      if (countError) throw countError;
      const isDefault = count === 0;

      const { error: insertError } = await supabase
        .from('customer_addresses')
        .insert({
          customer_id: customer.id,
          address_line1: addressLine1.trim(),
          address_line2: addressLine2.trim() || null,
          city: city.trim(),
          state: state.trim(),
          pin_code: pinCode.trim(),
          landmark: landmark.trim() || null,
          latitude,
          longitude,
          address_type: addressType, // Sends lowercase 'home' or 'work' directly to match addresses.tsx lookup filters
          is_default: isDefault,
        });

      if (insertError) throw insertError;
      router.replace('/addresses');
    } catch (error: any) {
      console.error(error);
      Alert.alert('Save Failed', error.message || 'Something went wrong while saving.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.mainWrapper}>
      {/* TOP NAVIGATION BAR */}
      <View style={styles.topNavBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButtonIcon}>
          <Text style={styles.backButtonTextSymbol}>←</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Add Delivery Address</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        
        {/* CUSTOM DELIGHT DELIVERY COVERAGE NOTICE */}
        <View style={styles.deliveryCoverageBannerCard}>
          <View style={styles.coverageIconWrapper}>
            <Text style={styles.coverageIcon}>🚀</Text>
          </View>
          <View style={styles.coverageTextContainer}>
            <Text style={styles.coverageTitleText}>Rivo Instant Coverage Zone</Text>
            <Text style={styles.coverageSubText}>Orders from this address qualify for premium 10-15 minute delivery</Text>
          </View>
        </View>

        {/* ADDRESS TYPE CHIPS SELECTOR */}
        <Text style={styles.fieldSectionLabel}>Save Address As</Text>
        <View style={styles.typeSelectorRow}>
          <TouchableOpacity 
            style={[styles.typeOption, addressType === 'home' && styles.typeOptionActive]} 
            onPress={() => setAddressType('home')}
          >
            <Text style={[styles.typeOptionText, addressType === 'home' && styles.typeOptionTextActive]}>🏠 Home</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.typeOption, addressType === 'work' && styles.typeOptionActive]} 
            onPress={() => setAddressType('work')}
          >
            <Text style={[styles.typeOptionText, addressType === 'work' && styles.typeOptionTextActive]}>🏢 Work</Text>
          </TouchableOpacity>
        </View>

        {/* FORM INPUT CONTROLS CARD */}
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

        {/* PREMIUM LOCATION PINNING INTERFACE TRIGGER (MOVED TO BOTTOM SIDE) */}
        <TouchableOpacity style={styles.locationButton} onPress={handleUseCurrentLocation} disabled={locating}>
          {locating ? (
            <ActivityIndicator color="#22CC71" />
          ) : (
            <View style={styles.locationButtonContent}>
              <Text style={styles.locationIcon}>🎯</Text>
              <Text style={styles.locationButtonText}>Pin Current Location</Text>
            </View>
          )}
        </TouchableOpacity>

        {latitude && longitude && (
          <View style={styles.locationSuccessCard}>
            <Text style={styles.locationSuccessText}>
              ✓ GPS Anchor Synchronized: {latitude.toFixed(4)}, {longitude.toFixed(4)}
            </Text>
          </View>
        )}

        {/* PERSIST FORM SUBMIT TRIGGER BUTTON */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveButtonText}>Save Address Essentials</Text>}
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
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  contentContainer: {
    padding: 16,
  },
  locationButton: {
    borderWidth: 1,
    borderColor: '#22CC71',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22CC7108',
    marginBottom: 14,
    marginTop: 4,
  },
  locationButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationIcon: {
    fontSize: 16,
  },
  locationButtonText: {
    color: '#22CC71',
    fontSize: 15,
    fontWeight: '800',
  },
  locationSuccessCard: {
    backgroundColor: '#E8FBF0',
    padding: 10,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#22CC7120',
  },
  locationSuccessText: {
    textAlign: 'center',
    color: '#22CC71',
    fontSize: 12,
    fontWeight: '700',
  },
  deliveryCoverageBannerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F8FA',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EAEFF3',
    marginBottom: 20,
  },
  coverageIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#A8E63A20',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  coverageIcon: {
    fontSize: 18,
  },
  coverageTextContainer: {
    flex: 1,
  },
  coverageTitleText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D0D0D',
  },
  coverageSubText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 2,
    lineHeight: 15,
  },
  fieldSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  typeOption: {
    flex: 1,
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: '#EAEFF3',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeOptionActive: {
    backgroundColor: '#22CC7110',
    borderColor: '#22CC71',
  },
  typeOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  typeOptionTextActive: {
    color: '#22CC71',
    fontWeight: '800',
  },
  formGroupCard: {
    backgroundColor: '#F7F8FA',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EAEFF3',
    marginBottom: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0D0D0D',
    marginBottom: 6,
    marginTop: 10,
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
    marginTop: 12,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
});