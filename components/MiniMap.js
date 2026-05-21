import React from 'react';
import { View, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Navigation } from 'lucide-react-native';

const MiniMap = ({ latitude, longitude, address, height = 150 }) => {
    if (!latitude || !longitude) return null;


    return (
        <View style={[styles.container, { height }]}>
            <MapView
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={{
                    latitude: parseFloat(latitude),
                    longitude: parseFloat(longitude),
                    latitudeDelta: 0.012, // Slightly wider for context
                    longitudeDelta: 0.012,
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
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: '#f1f5f9',
        overflow: 'hidden',
    },
    map: {
        flex: 1,
    }
});

export default MiniMap;
