import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Platform,
    Dimensions,
    FlatList,
    Animated,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Modal from 'react-native-modal';
import { X, Search, MapPin, Check, Navigation, Target } from 'lucide-react-native';
import { LocationService } from '../services/location';
import { useColorScheme } from 'react-native';

const { width, height } = Dimensions.get('window');

const LocationPickerModal = ({ visible, onClose, onConfirm, initialLocation }) => {
    const [region, setRegion] = useState({
        latitude: initialLocation?.latitude || 33.6154,
        longitude: initialLocation?.longitude || 73.0100,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
    });
    const [markerCoords, setMarkerCoords] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [gettingLocation, setGettingLocation] = useState(false);
    const [addressPreview, setAddressPreview] = useState(initialLocation?.address || '');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const mapRef = useRef(null);
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';

    // Animation for marker
    const markerScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (visible && initialLocation?.latitude && initialLocation?.longitude) {
            const newRegion = {
                latitude: initialLocation.latitude,
                longitude: initialLocation.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            };
            setRegion(newRegion);
            setMarkerCoords({
                latitude: initialLocation.latitude,
                longitude: initialLocation.longitude,
            });
            setAddressPreview(initialLocation.address || '');
        }
    }, [initialLocation, visible]);

    // Handle debounced search for autocomplete
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (searchQuery.length > 2 && showSuggestions) {
                const results = await LocationService.autocomplete(searchQuery);
                setSuggestions(results);
            } else {
                setSuggestions([]);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, showSuggestions]);

    const handleSelectSuggestion = async (suggestion) => {
        setLoading(true);
        setShowSuggestions(false);
        setSuggestions([]);
        setSearchQuery(suggestion.description);

        const data = await LocationService.getPlaceDetails(suggestion.place_id);
        setLoading(false);

        if (data) {
            animateToRegion({
                latitude: data.latitude,
                longitude: data.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            });
            setMarkerCoords({ latitude: data.latitude, longitude: data.longitude });
            setAddressPreview(data.address);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        setShowSuggestions(false);
        setSuggestions([]);
        const data = await LocationService.geocode(searchQuery);
        setLoading(false);
        if (data) {
            animateToRegion({
                latitude: data.latitude,
                longitude: data.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            });
            setMarkerCoords({ latitude: data.latitude, longitude: data.longitude });
            setAddressPreview(data.address);
        }
    };

    const handleMapPress = async (e) => {
        const coords = e.nativeEvent.coordinate;
        updateLocationFromCoords(coords);
    };

    const handleMarkerDragEnd = async (e) => {
        const coords = e.nativeEvent.coordinate;
        updateLocationFromCoords(coords, false);
    };

    const updateLocationFromCoords = async (coords, moveMap = true) => {
        setMarkerCoords(coords);
        if (moveMap) {
            animateToRegion({
                ...region,
                latitude: coords.latitude,
                longitude: coords.longitude,
            });
        }
        setLoading(true);
        const data = await LocationService.reverseGeocode(coords.latitude, coords.longitude);
        setLoading(false);
        if (data) {
            setAddressPreview(data.address);
            setSearchQuery(data.address);
        }
    };

    const handleGetCurrentLocation = async () => {
        setGettingLocation(true);
        const status = await LocationService.requestPermission();
        if (status !== 'granted') {
            setGettingLocation(false);
            return;
        }

        const position = await LocationService.getCurrentPosition();
        if (position) {
            animateToRegion({
                latitude: position.latitude,
                longitude: position.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            });
            updateLocationFromCoords(position, false);
        }
        setGettingLocation(false);
    };

    const animateToRegion = (newRegion) => {
        setRegion(newRegion);
        mapRef.current?.animateToRegion(newRegion, 1000);
    };

    const handleConfirm = () => {
        if (!markerCoords) return;
        onConfirm({
            address: addressPreview,
            latitude: markerCoords.latitude,
            longitude: markerCoords.longitude,
        });
        onClose();
    };

    const animateMarker = () => {
        markerScale.setValue(1);
        Animated.sequence([
            Animated.timing(markerScale, {
                toValue: 1.2,
                duration: 150,
                useNativeDriver: true,
            }),
            Animated.timing(markerScale, {
                toValue: 1,
                duration: 150,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const suggestionsVisible = showSuggestions && suggestions.length > 0;

    return (
        <Modal
            isVisible={visible}
            onBackdropPress={onClose}
            style={{ margin: 0, justifyContent: 'flex-end' }}
            avoidKeyboard
            backdropOpacity={0.5}
            animationIn="slideInUp"
            animationOut="slideOutDown"
        >
            <View className={`rounded-t-[40px] ${isDark ? 'bg-slate-900' : 'bg-white'}`} style={{ height: height * 0.85 }}>
                {/* Drag Handle */}
                <View className={`w-12 h-1.5 rounded-full self-center my-4 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

                {/* Header */}
                <View className="flex-row items-center justify-between px-6 pb-4">
                    <TouchableOpacity
                        onPress={onClose}
                        className={`p-2 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}
                    >
                        <X size={20} color={isDark ? '#f1f5f9' : '#0f172a'} />
                    </TouchableOpacity>

                    <View>
                        <Text className={`text-xl font-black text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            Pin Location
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={handleConfirm}
                        disabled={!markerCoords || loading}
                        className={`px-4 py-2 rounded-2xl ${markerCoords && !loading
                            ? 'bg-slate-900 dark:bg-white'
                            : 'bg-slate-200 dark:bg-slate-800 opacity-50'
                            }`}
                    >
                        <Text className={`font-bold text-sm ${isDark ? 'text-slate-900' : 'text-white'}`}>
                            Confirm
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View className="px-6 mb-4">
                    <View className={`flex-row items-center px-4 h-12 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'
                        }`}>
                        <Search size={18} color={isDark ? '#64748b' : '#94a3b8'} style={{ marginRight: 8 }} />
                        <TextInput
                            className={`flex-1 text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}
                            placeholder="Find a place..."
                            placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                            value={searchQuery}
                            onChangeText={(text) => {
                                setSearchQuery(text);
                                setShowSuggestions(true);
                            }}
                            onSubmitEditing={handleSearch}
                            returnKeyType="search"
                        />
                        {loading && <ActivityIndicator size="small" color="#6366f1" />}
                    </View>
                </View>

                <View className="flex-1 relative">
                    {/* Suggestions Overlay */}
                    {suggestionsVisible && (
                        <View className={`absolute top-0 left-6 right-6 z-50 rounded-2xl border overflow-hidden shadow-2xl ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                            }`} style={{ maxHeight: 250 }}>
                            <FlatList
                                data={suggestions}
                                keyExtractor={(item) => item.place_id}
                                keyboardShouldPersistTaps="always"
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        onPress={() => handleSelectSuggestion(item)}
                                        className={`flex-row items-center px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-50'
                                            }`}
                                    >
                                        <MapPin size={16} color="#6366f1" />
                                        <Text className={`ml-3 text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`} numberOfLines={2}>
                                            {item.description}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    )}

                    <MapView
                        ref={mapRef}
                        style={StyleSheet.absoluteFillObject}
                        initialRegion={region}
                        onRegionChangeComplete={(r) => {
                            setRegion(r);
                            if (!markerCoords) animateMarker();
                        }}
                        onPress={handleMapPress}
                    >
                        {markerCoords && (
                            <Marker
                                coordinate={markerCoords}
                                draggable
                                onDragEnd={handleMarkerDragEnd}
                                onPress={animateMarker}
                            >
                                <Animated.View style={{ transform: [{ scale: markerScale }] }}>
                                    <View style={styles.markerContainer}>
                                        <View style={[styles.markerInner, { backgroundColor: '#ef4444' }]}>
                                            <MapPin size={18} color="white" fill="white" />
                                        </View>
                                        <View style={[styles.markerPoint, { backgroundColor: '#ef4444' }]} />
                                    </View>
                                </Animated.View>
                            </Marker>
                        )}
                    </MapView>

                    {/* Current Location Button */}
                    <TouchableOpacity
                        onPress={handleGetCurrentLocation}
                        className={`absolute top-4 right-6 w-14 h-14 rounded-2xl items-center justify-center shadow-xl ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white'
                            }`}
                        style={{ elevation: 5 }}
                    >
                        {gettingLocation ? (
                            <ActivityIndicator size="small" color="#3b82f6" />
                        ) : (
                            <View className="items-center justify-center">
                                <View className="w-8 h-8 rounded-full bg-blue-500/20 absolute" />
                                <View className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Address Card */}
                    <View className="absolute bottom-10 left-6 right-6">
                        <View className={`p-4 rounded-3xl shadow-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
                            }`}>
                            <View className="flex-row items-center mb-2">
                                <View className={`p-1.5 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                                    <MapPin size={14} color="#6366f1" />
                                </View>
                                <Text className={`ml-2 text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Selected Address
                                </Text>
                            </View>
                            <Text className={`text-sm font-bold leading-5 ${isDark ? 'text-slate-200' : 'text-slate-800'}`} numberOfLines={2}>
                                {addressPreview || 'Tap on map or search above...'}
                            </Text>

                            <TouchableOpacity
                                onPress={handleConfirm}
                                disabled={!markerCoords || loading}
                                className={`mt-4 h-12 rounded-2xl items-center justify-center ${markerCoords && !loading ? 'bg-slate-900 dark:bg-white' : 'bg-slate-200 dark:bg-slate-800'
                                    }`}
                            >
                                <Text className={`font-black uppercase tracking-widest text-xs ${isDark ? 'text-slate-900' : 'text-white'}`}>
                                    Set This Location
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    markerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 20,
    },
    markerInner: {
        padding: 8,
        borderRadius: 20,
        borderWidth: 3,
        borderColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 8,
    },
    markerPoint: {
        width: 4,
        height: 12,
        marginTop: -1,
        borderRadius: 2,
    }
});

export default LocationPickerModal;
