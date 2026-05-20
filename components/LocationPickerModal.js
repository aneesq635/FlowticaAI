import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Platform,
    Dimensions,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { X, Search, MapPin, Check, Navigation } from 'lucide-react-native';
import { LocationService } from '../services/location';

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
    const [addressPreview, setAddressPreview] = useState(initialLocation?.address || '');
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        if (initialLocation?.latitude && initialLocation?.longitude) {
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
        setSearchQuery(suggestion.description);

        const data = await LocationService.getPlaceDetails(suggestion.place_id);
        setLoading(false);

        if (data) {
            const newRegion = {
                latitude: data.latitude,
                longitude: data.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            };
            setRegion(newRegion);
            setMarkerCoords({ latitude: data.latitude, longitude: data.longitude });
            setAddressPreview(data.address);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        setShowSuggestions(false);
        const data = await LocationService.geocode(searchQuery);
        setLoading(false);
        if (data) {
            const newRegion = {
                latitude: data.latitude,
                longitude: data.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            };
            setRegion(newRegion);
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
        updateLocationFromCoords(coords);
    };

    const updateLocationFromCoords = async (coords) => {
        setMarkerCoords(coords);
        setLoading(true);
        const data = await LocationService.reverseGeocode(coords.latitude, coords.longitude);
        setLoading(false);
        if (data) {
            setAddressPreview(data.address);
        }
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

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <X size={24} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Select Location</Text>
                    <TouchableOpacity
                        onPress={handleConfirm}
                        disabled={!markerCoords}
                        style={[styles.confirmButton, !markerCoords && styles.disabledButton]}
                    >
                        <Check size={24} color={markerCoords ? "#2563eb" : "#94a3b8"} />
                    </TouchableOpacity>
                </View>

                {/* Search Bar & Autocomplete Suggestions */}
                <View className="z-50">
                    <View style={styles.searchContainer}>
                        <Search size={20} color="#64748b" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search area, landmark or street..."
                            value={searchQuery}
                            onChangeText={(text) => {
                                setSearchQuery(text);
                                setShowSuggestions(true);
                            }}
                            onSubmitEditing={handleSearch}
                        />
                        {loading && <ActivityIndicator size="small" color="#2563eb" />}
                    </View>

                    {showSuggestions && suggestions.length > 0 && (
                        <View style={styles.suggestionsContainer}>
                            {suggestions.map((item) => (
                                <TouchableOpacity
                                    key={item.place_id}
                                    style={styles.suggestionItem}
                                    onPress={() => handleSelectSuggestion(item)}
                                >
                                    <MapPin size={16} color="#94a3b8" />
                                    <Text style={styles.suggestionText} numberOfLines={1}>
                                        {item.description}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* Map */}
                <View style={styles.mapContainer}>
                    <MapView
                        style={styles.map}
                        region={region}
                        onRegionChangeComplete={setRegion}
                        onPress={handleMapPress}
                    >
                        {markerCoords && (
                            <Marker
                                coordinate={markerCoords}
                                draggable
                                onDragEnd={handleMarkerDragEnd}
                            >
                                <View style={styles.markerContainer}>
                                    <MapPin size={36} color="#ef4444" fill="#ef4444" />
                                </View>
                            </Marker>
                        )}
                    </MapView>

                    {/* Current Selection Bubble */}
                    {addressPreview ? (
                        <View style={styles.addressBubble}>
                            <MapPin size={16} color="#2563eb" />
                            <View className="flex-1 ml-3">
                                <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Current Selection</Text>
                                <Text style={styles.addressText} numberOfLines={2}>
                                    {addressPreview}
                                </Text>
                            </View>
                        </View>
                    ) : null}
                </View>

                {/* Footer Action */}
                <TouchableOpacity
                    style={[styles.footerButton, !markerCoords && styles.disabledFooterButton]}
                    onPress={handleConfirm}
                    disabled={!markerCoords}
                >
                    <Text style={styles.footerButtonText}>Confirm This Location</Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#0f172a',
    },
    closeButton: {
        padding: 8,
    },
    confirmButton: {
        padding: 8,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        margin: 16,
        paddingHorizontal: 12,
        height: 48,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: '#0f172a',
    },
    mapContainer: {
        flex: 1,
        position: 'relative',
    },
    map: {
        ...StyleSheet.absoluteFillObject,
    },
    markerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    addressBubble: {
        position: 'absolute',
        bottom: 24,
        left: 24,
        right: 24,
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    addressText: {
        flex: 1,
        marginLeft: 12,
        fontSize: 14,
        color: '#334155',
        lineHeight: 20,
    },
    footerButton: {
        margin: 16,
        height: 52,
        backgroundColor: '#0f172a',
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Platform.OS === 'ios' ? 34 : 16,
    },
    footerButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    disabledButton: {
        opacity: 0.3,
    },
    disabledFooterButton: {
        backgroundColor: '#94a3b8',
    },
    suggestionsContainer: {
        position: 'absolute',
        top: 80,
        left: 16,
        right: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        maxHeight: 250,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    suggestionText: {
        marginLeft: 12,
        fontSize: 14,
        color: '#334155',
    }
});

export default LocationPickerModal;
