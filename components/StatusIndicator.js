import React from 'react';
import { View, Text } from 'react-native';

export function StatusIndicator({ status }) {
  const getStatusColor = () => {
    switch(status) {
      case 'active': return 'bg-black';
      case 'waiting': return 'bg-gray-400';
      default: return 'bg-gray-200';
    }
  };

  const getStatusText = () => {
    switch(status) {
      case 'active': return 'Running';
      case 'waiting': return 'Waiting';
      default: return 'Idle';
    }
  };

  return (
    <View className="flex-row items-center">
      <View className={`w-2 h-2 rounded-full mr-2 ${getStatusColor()}`} />
      <Text className="text-xs font-medium text-gray-600 uppercase tracking-wider">
        {getStatusText()}
      </Text>
    </View>
  );
}
