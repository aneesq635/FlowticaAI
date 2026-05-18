import { Slot, useRouter } from "expo-router";
import { View, useWindowDimensions, ActivityIndicator } from "react-native";
import { useSelector } from "react-redux";
import { useAuth } from "../../components/AuthContext";
import Header from "../../components/Header";
import Sidebar from "../../components/Sidebar";
import { useEffect } from "react";

export default function AppLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const reduxTheme = useSelector(state => state.orchestration.theme);
  const isDesktop = width > 768;
  const bgClass = reduxTheme === 'dark' ? 'bg-slate-950' : 'bg-slate-50';

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [user, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: reduxTheme === 'dark' ? '#020617' : '#f8fafc', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#3b82f6" size="large" />
      </View>
    );
  }

  if (!user) {
    return null;
  }

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