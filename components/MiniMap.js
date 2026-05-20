import React from 'react';
import { View, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Navigation } from 'lucide-react-native';

const MiniMap = ({ latitude, longitude, address, height = 150 }) => {
    if (!latitude || !longitude) return null;

    const openInGoogleMaps = () => {
        const url = Platform.select({
            ios: `comgooglemaps://?q=${latitude},${longitude}`,
            android: `geo:${latitude},${longitude}?q=${latitude},${longitude}`,
        });

        Linking.canOpenURL(url).then((supported) => {
            if (supported) {
                Linking.openURL(url);
            } else {
                // Fallback to web link
                Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
            }
        });
    };

    return (
        <View style={[styles.container, { height }]}>
            <MapView
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={{
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                }}
                scrollEnabled={false}
                zoomEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
            >
                <Marker
                    coordinate={{
                        latitude: parseFloat(latitude),
                        longitude: parseFloat(longitude)
                    }}
                />
            </MapView>

            <TouchableOpacity style={styles.navButton} onPress={openInGoogleMaps}>
                <Navigation size={20} color="#fff" />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 12,
        backgroundColor: '#f1f5f9',
        position: 'relative',
    },
    map: {
        flex: 1,
    },
    navButton: {
        position: 'absolute',
        right: 12,
        bottom: 12,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#2563eb',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    }
});

export default MiniMap;
