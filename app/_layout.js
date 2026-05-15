import "../global.css";
import { Slot } from "expo-router";
import { AuthProvider } from "../components/AuthContext.js";
import { View } from "react-native";
import Header from "../components/Header.js"; // If you want header globally

export default function RootLayout() {
  return (
    <AuthProvider>
      <View className="flex-1 bg-white">
        <Header />
        <Slot />
      </View>
    </AuthProvider>
  );
}
