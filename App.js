import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator,
  TouchableOpacity, Linking, Modal, Pressable, Image, Switch
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import axios from 'axios';
import DropDownPicker from 'react-native-dropdown-picker';

const GOOGLE_API_KEY = "****";

export default function App() {
  const [location, setLocation] = useState(null);
  const [cuisine, setCuisine] = useState('');
  const [loading, setLoading] = useState(true);
  const [restaurants, setRestaurants] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [open, setOpen] = useState(false);
  const [vegOnly, setVegOnly] = useState(false);
  const scrollRef = useRef();

  const [items, setItems] = useState([
    { label: 'Italian', value: 'italian' },
    { label: 'Chinese', value: 'chinese' },
    { label: 'Indian', value: 'indian' },
    { label: 'Mexican', value: 'mexican' },
    { label: 'Japanese', value: 'japanese' },
    { label: 'Sweet Dish', value: 'dessert' },
    { label: 'Fast Food', value: 'Fast_food' }
  ]);

  const cuisineIconMap = {
    italian: '🍕',
    chinese: '🥡',
    indian: '🍛',
    mexican: '🌮',
    japanese: '🍣',
    dessert: '🍰',
    Fast_food: '🍟'
  };

  const getDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      0.5 - Math.cos(dLat) / 2 +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      (1 - Math.cos(dLon)) / 2;
    return R * 2 * Math.asin(Math.sqrt(a)) * 1000;
  };

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          alert('Permission to access location was denied');
          setLoading(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc.coords);
      } catch (error) {
        console.error("Error fetching location:", error);
        alert("An error occurred while fetching location.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (location && cuisine) {
      fetchNearbyRestaurants(location, cuisine);
    }
  }, [cuisine, vegOnly]);

  const fetchNearbyRestaurants = async (coords, keyword) => {
    setLoading(true);
    try {
      const radius = 2000;
      const keywordWithVeg = vegOnly ? `vegetarian ${keyword}` : keyword;
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${coords.latitude},${coords.longitude}&radius=${radius}&type=restaurant&keyword=${keywordWithVeg}&key=${GOOGLE_API_KEY}`;
      const { data } = await axios.get(url);
      const filtered = data.results
        .filter(r => r.rating >= 4.0)
        .map(r => ({
          name: r.name,
          rating: r.rating,
          address: r.vicinity,
          lat: r.geometry.location.lat,
          lng: r.geometry.location.lng,
          place_id: r.place_id,
          distance: getDistance(coords.latitude, coords.longitude, r.geometry.location.lat, r.geometry.location.lng),
          open_now: r.opening_hours?.open_now ?? null,
          icon: cuisineIconMap[keyword] || '🍽️',
        }))
        .sort((a, b) => a.distance - b.distance);

      setRestaurants(filtered);
    } catch (error) {
      console.error("Error fetching restaurants:", error);
    }
    setLoading(false);
  };

  const fetchRestaurantDetails = async (placeId) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_phone_number,price_level,website,geometry,photos&key=${GOOGLE_API_KEY}`;
      const { data } = await axios.get(url);
      setSelectedRestaurant(data.result);
      setModalVisible(true);
    } catch (e) {
      alert("Failed to fetch details");
    }
  };

  const handleSurpriseMe = () => {
    if (restaurants.length === 0) return;
    const index = Math.floor(Math.random() * restaurants.length);
    fetchRestaurantDetails(restaurants[index].place_id);
  };

  if (loading && !location) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#AD2201" />
        <Text>Fetching your location...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>CRAVE RADAR</Text>

      <View style={{ zIndex: 1000, marginHorizontal: 20, marginBottom: 10 }}>
        <DropDownPicker
          placeholder="Select Cuisine"
          open={open}
          value={cuisine}
          items={items}
          setOpen={setOpen}
          setValue={setCuisine}
          setItems={setItems}
          style={{ borderColor: '#ccc' }}
          dropDownContainerStyle={{ borderColor: '#ccc' }}
        />
      </View>

      <View style={styles.toggleContainer}>
        <Text style={{ fontWeight: '600' }}>Veg Only</Text>
        <Switch value={vegOnly} onValueChange={setVegOnly} />
      </View>

      <TouchableOpacity style={styles.surpriseButton} onPress={handleSurpriseMe}>
        <Text style={styles.buttonText}>🎲 Surprise Me</Text>
      </TouchableOpacity>

      {location && (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          <Marker coordinate={location} title="You are here" />
          {restaurants.map((res, index) => (
            <Marker
              key={index}
              coordinate={{ latitude: res.lat, longitude: res.lng }}
              title={res.name}
              description={`⭐ ${res.rating} — ${res.address}`}
            />
          ))}
        </MapView>
      )}

      <ScrollView contentContainerStyle={styles.cardContainer} ref={scrollRef}>
        {restaurants.map((res, idx) => (
          <TouchableOpacity key={idx} onPress={() => fetchRestaurantDetails(res.place_id)} style={styles.card}>
            <Text style={styles.name}>{res.icon} {res.name}</Text>
            {res.rating >= 4.5 && <Text style={styles.topPick}>🔥 Top Pick</Text>}
            <Text style={styles.detailText}>⭐ Rating: {res.rating}</Text>
            <Text style={styles.detailText}>📍 {res.address}</Text>
            <Text style={styles.detailText}>📏 {Math.round(res.distance)} meters away</Text>
            <Text style={styles.detailText}>{res.open_now === null ? '⏳ Hours unknown' : res.open_now ? '✅ Open Now' : '❌ Closed'}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalView}>
          {selectedRestaurant && (
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.modalTitle}>{selectedRestaurant.name}</Text>
              {selectedRestaurant.photos?.length > 0 && (
                <Image
                  source={{
                    uri: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${selectedRestaurant.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`
                  }}
                  style={{ width: 300, height: 200, borderRadius: 10, marginVertical: 10 }}
                />
              )}
              <Text>💰 Expensive: {'₹'.repeat(selectedRestaurant.price_level || 1)}</Text>
              <Text>📞 {selectedRestaurant.formatted_phone_number || 'N/A'}</Text>
              <Text style={{ color: '#AD2201', marginTop: 8 }}>{selectedRestaurant.website || 'No website available'}</Text>
              {selectedRestaurant.website && (
                <TouchableOpacity onPress={() => Linking.openURL(selectedRestaurant.website)}>
                  <Text style={styles.linkButton}>Visit Website</Text>
                </TouchableOpacity>
              )}
              {selectedRestaurant.formatted_phone_number && (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${selectedRestaurant.formatted_phone_number}`)}>
                  <Text style={styles.linkButton}>Call</Text>
                </TouchableOpacity>
              )}
              {selectedRestaurant.geometry && (
                <TouchableOpacity onPress={() =>
                  Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${selectedRestaurant.geometry.location.lat},${selectedRestaurant.geometry.location.lng}`)
                }>
                  <Text style={styles.linkButton}>🧭 Get Directions</Text>
                </TouchableOpacity>
              )}
              <Pressable style={styles.closeButton} onPress={() => setModalVisible(false)}>
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f2' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginVertical: 20, color: '#AD2201' },
  toggleContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 8, gap: 10 },
  map: { height: 250, marginHorizontal: 20, borderRadius: 10 },
  surpriseButton: {
    backgroundColor: '#AD2201',
    paddingVertical: 10,
    borderRadius: 30,
    marginHorizontal: 100,
    marginBottom: 10,
    alignItems: 'center'
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  cardContainer: { padding: 10, paddingBottom: 100 },
  card: {
    backgroundColor: '#fff',
    marginVertical: 10,
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 10,
    elevation: 3
  },
  name: { fontWeight: 'bold', fontSize: 16, marginBottom: 6, color: '#333' },
  topPick: { color: '#e74c3c', fontWeight: 'bold', marginBottom: 4 },
  detailText: { fontSize: 14, color: '#444', marginBottom: 2 },
  modalView: {
    margin: 20, backgroundColor: 'white', borderRadius: 20,
    padding: 30, alignItems: 'center', marginTop: 100,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  linkButton: {
    backgroundColor: '#AD2201', paddingVertical: 10, paddingHorizontal: 24,
    borderRadius: 30, marginTop: 12, textAlign: 'center',
    fontWeight: '600', fontSize: 16, color: '#fff', width: '80%',
  },
  closeButton: {
    backgroundColor: '#AD2201', paddingVertical: 10, paddingHorizontal: 24,
    borderRadius: 30, marginTop: 20, width: '80%', alignItems: 'center',
  },
  closeButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});