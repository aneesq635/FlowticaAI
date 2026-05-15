import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';

export default function Home() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
        Flowtica AI
      </Text>

      <TouchableOpacity
        onPress={() => router.push('/auth/login')}
        style={{
          marginTop: 20,
          backgroundColor: 'black',
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 10,
        }}
      >
        <Text style={{ color: 'white' }}>Login</Text>
      </TouchableOpacity>
    </View>
  );
}