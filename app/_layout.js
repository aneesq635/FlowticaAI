import "../global.css";
import { Slot, usePathname, useRouter } from "expo-router";
import { AuthProvider, useAuth } from "../components/AuthContext.js";
import { View, ActivityIndicator, useWindowDimensions } from "react-native";
import { Provider, useSelector, useDispatch } from "react-redux";
import { useEffect, useState } from "react";
import store from "../store";
import socketService from "../services/socket";
import { useColorScheme } from "nativewind";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setTheme } from "../store/orchestrationSlice";
import { UserProvider, useDbUser } from '../components/UserContext';
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import BottomNav from "../components/BottomNav";

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
        <UserProvider>
          <ThemeSyncWrapper>
            <Slot />
          </ThemeSyncWrapper>
        </UserProvider>
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

  return <GlobalLayoutWrapper>{children}</GlobalLayoutWrapper>;
}

function GlobalLayoutWrapper({ children }) {
  const { user, loading } = useAuth();
  const { dbUser } = useDbUser();
  const pathname = usePathname();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const reduxTheme = useSelector(state => state.orchestration.theme);
  const bgClass = reduxTheme === 'dark' ? 'bg-slate-950' : 'bg-slate-50';

  const protectedRoutes = ['/conversations', '/provider', '/booked-jobs', '/booked-services', '/orchestrator'];

  useEffect(() => {
    if (!loading) {
      if (!user && protectedRoutes.includes(pathname)) {
        router.replace('/auth');
      }
    }
  }, [user, loading, pathname]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: reduxTheme === 'dark' ? '#020617' : '#f8fafc', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  return (
    <View className={`flex-1 ${bgClass}`}>
      <Header />
      <View style={{ flexDirection: 'row', flex: 1 }}>
        {user && isDesktop && <Sidebar />}
        <View style={{ flex: 1, paddingBottom: 80 }}>
          {children}
        </View>
      </View>
      <BottomNav userType={dbUser?.user_type} />
    </View>
  );
}