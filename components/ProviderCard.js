import React from 'react';
import { View, Text } from 'react-native';
import { Star, MapPin, CheckCircle } from 'lucide-react-native';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

export function ProviderCard({ provider, onSelect }) {
  return (
    <Card className="mb-4">
      <View className="flex-row justify-between items-start mb-3">
        <View>
          <Text className="text-lg font-bold text-black">{provider.name}</Text>
          <Text className="text-gray-500">{provider.specialization}</Text>
        </View>
        <View className="bg-gray-100 px-2 py-1 rounded-md flex-row items-center">
          <Star size={14} color="#000" fill="#000" />
          <Text className="text-black font-bold ml-1 text-xs">{provider.rating}</Text>
        </View>
      </View>

      <View className="flex-row items-center mb-3">
        <MapPin size={14} color="#6b7280" />
        <Text className="text-sm text-gray-500 ml-1">{provider.location} • Rs. {provider.pricing?.hourly_rate || provider.priceEst}</Text>
      </View>

      {/* Why selected logic */}
      <View className="bg-gray-50 p-3 rounded-xl mb-4 border border-gray-100">
        <Text className="text-xs font-semibold text-black mb-1 uppercase tracking-wider">AI Selection Reasoning</Text>
        <View className="flex-row items-center mt-1">
          <CheckCircle size={12} color="#000" />
          <Text className="text-xs text-gray-600 ml-1">{provider.reasoning || "Matched based on skills and location."}</Text>
        </View>
      </View>

      <Button title="Select Provider" onPress={() => onSelect(provider)} variant="primary" />
    </Card>
  );
}
