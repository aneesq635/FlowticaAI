import "../global.css";
import { Slot } from "expo-router";
import { AuthProvider, useAuth } from "../components/AuthContext.js";
import { View, useWindowDimensions, ActivityIndicator, Text, ScrollView, TouchableOpacity } from "react-native";
import { Provider, useSelector, useDispatch } from "react-redux";
import { useEffect, useState } from "react";
import store from "../store";
import socketService from "../services/socket";
import Header from "../components/Header.js";
import Sidebar from "../components/Sidebar";
import { useColorScheme, cssInterop } from "nativewind";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setTheme } from "../store/orchestrationSlice";

import { MotiView } from "moti";

// Global Interop for React 19 / Fabric Compatibility
cssInterop(View, { className: 'style' });
cssInterop(Text, { className: 'style' });
cssInterop(ScrollView, { className: 'style' });
cssInterop(TouchableOpacity, { className: 'style' });
cssInterop(MotiView, { className: 'style' });

export default function RootLayout() {
  useEffect(() => {
    socketService.connect();
    return () => socketService.disconnect();
  }, []);

  return (
    <Provider store={store}>
      <AuthProvider>
        <ThemeSyncWrapper>
          <LayoutContent />
        </ThemeSyncWrapper>
      </AuthProvider>
    </Provider>
  );
}

function ThemeSyncWrapper({ children }) {
  const dispatch = useDispatch();
  const reduxTheme = useSelector(state => state.orchestration.theme);
  const { setColorScheme, colorScheme } = useColorScheme();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = await AsyncStorage.getItem("theme");
      if (savedTheme) {
        dispatch(setTheme(savedTheme));
        setColorScheme(savedTheme);
      } else {
        setColorScheme(reduxTheme);
      }
      setIsReady(true);
    };
    loadTheme();
  }, []);

  useEffect(() => {
    if (isReady) {
      setColorScheme(reduxTheme);
      AsyncStorage.setItem("theme", reduxTheme);
    }
  }, [reduxTheme, isReady]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#020617', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  return children;
}

function LayoutContent() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const reduxTheme = useSelector(state => state.orchestration.theme);
  const isDesktop = width > 768;

  // Background color based on theme
  const bgClass = reduxTheme === 'dark' ? 'bg-slate-950' : 'bg-slate-50';

  return (
    <View className={`flex-1 ${bgClass}`}>
      <Header />
      <View style={{ flexDirection: 'row', flex: 1 }}>
        {user && isDesktop && <Sidebar />}
        <View style={{ flex: 1 }}>
          <Slot />
        </View>
      </View>
    </View>
  );
}
