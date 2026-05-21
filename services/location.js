import * as Location from 'expo-location';
import api from './api';

export const LocationService = {
    /**
     * Requests foreground location permissions.
     * Returns the permission status ("granted", "denied", "not_requested").
     */
    async requestPermission() {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            return status;
        } catch (error) {
            console.error('[LOCATION SERVICE] Permission error:', error);
            return 'denied';
        }
    },

    /**
     * Gets current device coordinates.
     */
    async getCurrentPosition() {
        try {
            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
            return {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };
        } catch (error) {
            console.error('[LOCATION SERVICE] Position error:', error);
            return null;
        }
    },

    /**
     * Converts address string to structured location_data using backend.
     */
    async geocode(address) {
        try {
            const response = await api.aiPost('/api/location/geocode', { address });
            if (response.success && response.location_data) {
                return response.location_data;
            }
            return null;
        } catch (error) {
            console.error('[LOCATION SERVICE] Geocode error:', error);
            return null;
        }
    },

    /**
     * Converts coordinates to structured location_data using backend.
     */
    async reverseGeocode(latitude, longitude) {
        try {
            const response = await api.aiPost('/api/location/reverse-geocode', { latitude, longitude });
            if (response.success && response.location_data) {
                return response.location_data;
            }
            return null;
        } catch (error) {
            console.error('[LOCATION SERVICE] Reverse geocode error:', error);
            return null;
        }
    },

    /**
     * Gets place suggestions from Google Places API via backend.
     */
    async autocomplete(input) {
        try {
            const response = await api.aiPost('/api/location/autocomplete', { input });
            if (response.success && response.predictions) {
                return response.predictions;
            }
            return [];
        } catch (error) {
            console.error('[LOCATION SERVICE] Autocomplete error:', error);
            return [];
        }
    },

    /**
     * Gets structured location_data for a specific place_id.
     */
    async getPlaceDetails(placeId) {
        try {
            const response = await api.aiPost('/api/location/details', { place_id: placeId });
            if (response.success) {
                return response.location_data;
            }
            return null;
        } catch (error) {
            console.error('[LOCATION SERVICE] Place details error:', error);
            return null;
        }
    }
};
