import "../global.css";
import { Slot } from "expo-router";
import { AuthProvider } from "../components/AuthContext.js";
import { View, ActivityIndicator } from "react-native";
import { Provider, useSelector, useDispatch } from "react-redux";
import { useEffect, useState } from "react";
import store from "../store";
import socketService from "../services/socket";
import { useColorScheme } from "nativewind";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setTheme } from "../store/orchestrationSlice";

import api from "../services/api";

export default function RootLayout() {
  useEffect(() => {
    // Run network diagnostics
    const testConnectivity = async () => {
      console.log("[DIAGNOSTIC] App mounting, testing connectivity to backend...");
      const health = await api.checkHealth();
      if (health.ok) {
        console.log("[DIAGNOSTIC] Success! Backend is reachable:", JSON.stringify(health.data));
        
        // Also perform an Echo diagnostic test to confirm POST request flow
        try {
          const echoResponse = await api.post('/api/echo', { test: "React Native Connection Active", client: "Expo Mobile Client" });
          console.log("[DIAGNOSTIC] Success! POST Echo test completed. Response:", JSON.stringify(echoResponse));
        } catch (echoErr) {
          console.error("[DIAGNOSTIC] Warning! POST Echo test failed:", echoErr);
        }
      } else {
        console.error("[DIAGNOSTIC] Error! Backend is UNREACHABLE. Error details:", health.error);
      }
    };
    
    testConnectivity();

    socketService.connect();
    return () => socketService.disconnect();
  }, []);

  return (
    <Provider store={store}>
      <AuthProvider>
        <ThemeSyncWrapper>
          <Slot />
        </ThemeSyncWrapper>
      </AuthProvider>
    </Provider>
  );
}

function ThemeSyncWrapper({ children }) {
  const dispatch = useDispatch();
  const reduxTheme = useSelector(state => state.orchestration.theme);
  const { setColorScheme } = useColorScheme();
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