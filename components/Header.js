import React, { useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "./AuthContext.js";
import { Sun, Moon, Bell, LayoutPanelLeft } from "lucide-react-native";
import { useDispatch, useSelector } from "react-redux";
import { toggleTheme, setUnreadCount, toggleEngine } from "../store/orchestrationSlice";
import socketService from "../services/socket";
import { useRouter, usePathname } from "expo-router";

export default function Header() {
  const dispatch = useDispatch();
  const pathname = usePathname();
  const { user } = useAuth();
  const { theme, unreadNotificationsCount: unreadCount, isEngineExpanded } = useSelector(state => state.orchestration);
  const isDark = theme === 'dark';

  let router = null;
  try { router = useRouter(); } catch (e) { /* nav not ready */ }

  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL 

  const navigate = useCallback((href) => {
    if (router) router.push(href);
  }, [router]);

  const fetchNotifications = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${backendUrl}/api/notifications/${user.id}`);
      const data = await res.json();
      if (data.success) {
        const unread = data.notifications.filter(n => n.status === 'unread').length;
        dispatch(setUnreadCount(unread));
      }
    } catch (e) {
      console.log("Failed to fetch notifications count", e);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();
      const socket = socketService?.socket;
      if (socket) {
        const handleNotif = (payload) => {
          if (payload.user_supabase_id === user.id) {
            fetchNotifications();
          }
        };
        socket.on('booking_notification', handleNotif);
        return () => socket.off('booking_notification', handleNotif);
      }
    }
  }, [user]);

  if (!router) return null;

  const isOrchestrator = pathname?.includes('orchestrator');

  return (
    <SafeAreaView
      edges={['top']}
      className={`w-full border-b ${isDark ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-100'} z-50`}
    >
      <View className="flex-row justify-between items-center h-16 px-5">

        {/* Logo Section */}
        <View style={styles.logoRow}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => navigate("/")}>
            <Text className={`font-black text-xl tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Flowtica{' '}
              <Text className={`font-extrabold text-slate-400`}>AI</Text>
            </Text>
          </TouchableOpacity>

          {/* Show Engine Toggle Integrated in Header to avoid overlap */}
          {isOrchestrator && (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => dispatch(toggleEngine())}
              style={[
                styles.engineToggle,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0'
                }
              ]}
            >
              <LayoutPanelLeft size={14} color={isDark ? '#94a3b8' : '#475569'} />
              <Text style={[styles.toggleText, { color: isDark ? '#cbd5e1' : '#1e293b' }]}>
                {isEngineExpanded ? 'HIDE ENGINE' : 'SHOW ENGINE'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Right: Theme + Bell */}
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => dispatch(toggleTheme())}
            className={`w-10 h-10 rounded-2xl items-center justify-center ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}
          >
            {isDark ? <Sun size={17} color="#f59e0b" /> : <Moon size={17} color="#818cf8" />}
          </TouchableOpacity>

          {user && (
            <TouchableOpacity
              onPress={() => navigate("/notifications")}
              className={`w-10 h-10 rounded-2xl items-center justify-center relative ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}
            >
              <Bell size={17} color={isDark ? '#e2e8f0' : '#1e293b'} />
              {unreadCount > 0 && (
                <View className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500" />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  engineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  toggleText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  }
});
