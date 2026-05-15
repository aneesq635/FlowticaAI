import { Stack } from 'expo-router';
import Providers from '../components/Provider.js';

export default function RootLayout() {
  return (
    <Providers>
      <Stack screenOptions={{ headerShown: false }} />
    </Providers>
  );
}