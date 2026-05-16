import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';

export default function ProviderLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="provider" />
    </Stack>
  );
}