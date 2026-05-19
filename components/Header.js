import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, useWindowDimensions, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "./AuthContext.js";
import { 
  ChevronDown, Sun, Moon, Menu, X, LogOut, UserCircle, 
  MessageSquare, Layout, Home, Info, Briefcase, Settings, ChevronRight, Bell
} from "lucide-react-native";
import { useDispatch, useSelector } from "react-redux";
import { toggleTheme, setUnreadCount } from "../store/orchestrationSlice";
import Modal from "react-native-modal";
import { Typography } from "./ui/Typography";
import { Button } from "./ui/Button";
import socketService from "../services/socket";
import { useRouter, usePathname } from "expo-router";
import { ActivityIndicator } from 'react-native';

export default function Header() {
  // ✅ ALL hooks called unconditionally first — never skip any
  const dispatch = useDispatch();
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const reduxTheme = useSelector(state => state.orchestration.theme);
  const isDark = reduxTheme === 'dark';

  const [dbUser, setDbUser] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isUpdatingType, setIsUpdatingType] = useState(false);
  const unreadCount = useSelector(state => state.orchestration.unreadNotificationsCount);

  // ✅ Router hooks — separate try-catches, NEVER return early from catch
  let router = null;
  let pathname = "/";
  try { router = useRouter(); } catch (e) { /* nav not ready */ }
  try { pathname = usePathname(); } catch (e) { /* nav not ready */ }

  const isDesktop = width >= 1024;
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://172.25.2.90:5000';

  // Safe navigation — no-op if router isn't ready
  const navigate = useCallback((href) => {
    if (router) router.push(href);
  }, [router]);

  const toggleUserType = async () => {
    if (!user?.id || !dbUser) return;
    try {
      setIsUpdatingType(true);
      const newType = dbUser.user_type === 'buyer' ? 'seller' : 'buyer';
      const res = await fetch(`${backendUrl}/update-user`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supabase_id: user.id, user_type: newType })
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      if (data.success) {
        setDbUser({ ...dbUser, user_type: newType });
        setConfirmModalOpen(false);
      } else {
        alert("Failed to switch role: " + data.error);
      }
    } catch (err) {
      console.error("[SWITCH ERROR]", err);
      alert("Error switching user type.");
    } finally {
      setIsUpdatingType(false);
    }
  };

  const getFilteredLinks = () => {
    if (!user) {
      return [
        { label: "Home", href: "/", icon: Home },
        { label: "About", href: "/about", icon: Info }
      ];
    }
    
    const links = [
      { label: "Home", href: "/", icon: Home },
     
      { label: "About", href: "/about", icon: Info }
    ];

    if (dbUser?.user_type === 'seller') {
      links.push(
        { label: "Provider", href: "/provider", icon: Briefcase },
        { label: "Jobs", href: "/booked-jobs", icon: Briefcase }
      );
    } else {
      links.push(
        { label: "Booked Services", href: "/booked-services", icon: Briefcase },
         { label: "Chat", href: "/conversations", icon: MessageSquare },
      );
    }
    return links;
  };

  const filteredLinks = getFilteredLinks();

  const fetchUser = async () => {
    try {
      if (!user?.id) return;
      const response = await fetch(`${backendUrl}/user/${user.id}`);
      const data = await response.json();
      if (data?.user) setDbUser(data.user);
    } catch (err) {
      console.log(err);
    }
  };

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
    fetchUser();
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

const NavItem = ({ label, href, icon: Icon, isMobile = false }) => {
  const isActive = pathname === href;
  return (
    <TouchableOpacity
      onPress={() => {
        navigate(href);
        if (isMobile) setMobileOpen(false);
      }}
      className={`
        flex-row items-center
        ${isMobile
          ? 'py-4 px-6 rounded-2xl mb-2'
          : 'px-4 py-2 rounded-xl mx-1'}
        ${isActive
          ? (isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-950')
          : (isMobile
              ? (isDark ? 'bg-slate-900 border border-slate-800' : 'bg-slate-50 border border-slate-100')
              : 'bg-transparent')}
      `}
    >
      {/* ✅ Icon with gap-3 so icon and text have breathing room */}
      {isMobile && Icon && (
        <View className="mr-3">
          <Icon
            size={20}
            color={isActive ? '#fff' : (isDark ? '#94a3b8' : '#475569')}
          />
        </View>
      )}
      {/* ✅ whitespace-nowrap keeps label on one line */}
      <Text
        numberOfLines={1}
        className={`
          text-sm font-black uppercase tracking-widest flex-1
          ${isActive ? 'text-white' : (isDark ? 'text-slate-400' : 'text-slate-600')}
        `}
      >
        {label}
      </Text>
      {isMobile && (
        <ChevronRight
          size={16}
          color={isDark ? '#334155' : '#cbd5e1'}
          style={{ marginLeft: 8 }}
        />
      )}
    </TouchableOpacity>
  );
};


  // ✅ Guard JSX (not hooks) — if router isn't ready, show nothing
  if (!router) return null;

 return (
  <>
    <SafeAreaView
      edges={['top']}
      className={`w-full border-b ${isDark ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-100'} z-50`}
    >
      {/* ✅ justify-between: logo left, actions right — no desktop nav in between */}
      <View className="flex-row justify-between items-center h-20 px-6 max-w-7xl mx-auto w-full">

        {/* Logo */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => navigate("/")}
          className="flex-row items-center"
        >
          <View className={`w-10 h-10 ${isDark ? 'bg-slate-100' : 'bg-slate-900'} rounded-xl items-center justify-center mr-3 shadow-lg`}>
            <Layout size={20} color={isDark ? '#0f172a' : '#fff'} strokeWidth={3} />
          </View>
          <Text className={`font-black text-xl tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Flowtica{' '}
            <Text className={`font-extrabold ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>AI</Text>
          </Text>
        </TouchableOpacity>

        {/* Actions — right side only */}
        <View className="flex-row items-center gap-2">

          {/* Theme toggle */}
          <TouchableOpacity
            onPress={() => dispatch(toggleTheme())}
            className={`w-11 h-11 rounded-2xl items-center justify-center ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}
          >
            {isDark
              ? <Sun size={18} color="#f59e0b" />
              : <Moon size={18} color="#818cf8" />}
          </TouchableOpacity>

          {/* Notification bell */}
          {user && (
            <TouchableOpacity
              onPress={() => navigate("/notifications")}
              className={`w-11 h-11 rounded-2xl items-center justify-center relative ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}
            >
              <Bell size={18} color={isDark ? '#e2e8f0' : '#1e293b'} />
              {unreadCount > 0 && (
                <View className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-red-500" />
              )}
            </TouchableOpacity>
          )}

          {/* ✅ Hamburger only — desktop nav removed entirely */}
          <TouchableOpacity
            onPress={() => setMobileOpen(true)}
            className={`w-11 h-11 rounded-2xl items-center justify-center ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}
          >
            <Menu size={20} color={isDark ? '#f1f5f9' : '#0f172a'} />
          </TouchableOpacity>

        </View>
      </View>
    </SafeAreaView>


    {/* ─── Slide-in Menu (mobile + desktop both use this now) ─────────────── */}
    <Modal
      isVisible={mobileOpen}
      onBackdropPress={() => setMobileOpen(false)}
      animationIn="slideInRight"
      animationOut="slideOutRight"
      style={{ margin: 0, justifyContent: 'flex-end', flexDirection: 'row' }}
      backdropOpacity={0.4}
      useNativeDriver
    >
      <View className={`h-full w-80 shadow-2xl ${isDark ? 'bg-[#0f172a]' : 'bg-white'}`}>
        <SafeAreaView className="flex-1" edges={['top', 'bottom']}>

          {/* Menu header */}
          <View className={`p-6 flex-row justify-between items-center border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
            <Typography variant="h3">Explore</Typography>
            <TouchableOpacity
              onPress={() => setMobileOpen(false)}
              className={`p-2 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
            >
              <X size={20} color={isDark ? '#f1f5f9' : '#0f172a'} />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-4">
            <View className="mb-8">
              <Typography variant="xs" className="ml-2 mb-4 opacity-50 uppercase tracking-widest">
                Navigation
              </Typography>
              {filteredLinks.map((link) => (
                <NavItem key={link.label} {...link} isMobile />
              ))}
            </View>

            {user && (
              <View className="mb-8">
                <Typography variant="xs" className="ml-2 mb-4 opacity-50 uppercase tracking-widest">
                  Account
                </Typography>

                {/* Profile */}
                <TouchableOpacity
                  onPress={() => { setMobileOpen(false); navigate("/profile"); }}
                  className={`p-4 mb-3 rounded-2xl flex-row items-center border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}
                >
                  <View className={`w-10 h-10 rounded-xl items-center justify-center mr-4 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                    <UserCircle size={24} color={isDark ? '#f1f5f9' : '#0f172a'} />
                  </View>
                  <View className="flex-1">
                    <Typography variant="small" className="font-black">My Profile</Typography>
                    <Typography variant="xs" className="opacity-60">Edit contact & location</Typography>
                  </View>
                  <ChevronRight size={16} color={isDark ? '#334155' : '#cbd5e1'} />
                </TouchableOpacity>

                {/* Switch View */}
                <TouchableOpacity
                  onPress={() => { setMobileOpen(false); setConfirmModalOpen(true); }}
                  className={`p-4 rounded-2xl flex-row items-center border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}
                >
                  <View className={`w-10 h-10 rounded-xl items-center justify-center mr-4 ${isDark ? 'bg-slate-700' : 'bg-slate-800'}`}>
                    <UserCircle size={24} color="#fff" />
                  </View>
                  <View className="flex-1">
                    <Typography variant="small" className="font-black">Switch View</Typography>
                    <Typography variant="xs" className="opacity-60">
                      to {dbUser?.user_type === 'buyer' ? 'Seller' : 'Buyer'}
                    </Typography>
                  </View>
                  <ChevronRight size={16} color={isDark ? '#334155' : '#cbd5e1'} />
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Bottom sign out / connect */}
          <View className={`p-6 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
            {user ? (
              <Button
                title="Sign Out"
                variant="danger"
                icon={LogOut}
                onPress={() => { logout(); setMobileOpen(false); }}
              />
            ) : (
              <Button
                title="Connect"
                onPress={() => { navigate("/auth"); setMobileOpen(false); }}
              />
            )}
          </View>

        </SafeAreaView>
      </View>
    </Modal>


    {/* ─── Switch Account Confirm Modal ───────────────────────────────────── */}
    <Modal
      isVisible={confirmModalOpen}
      onBackdropPress={() => setConfirmModalOpen(false)}
      useNativeDriver
    >
      <View className={`rounded-[40px] p-8 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>

        <View className={`w-16 h-16 rounded-3xl items-center justify-center mb-6 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-100'}`}>
          <UserCircle size={32} color={isDark ? '#e2e8f0' : '#0f172a'} />
        </View>

        <Typography variant="h2" className="mb-2">Switch Account</Typography>
        <Typography className="mb-8 opacity-70">
          Are you sure you want to switch to the{' '}
          <Text className="font-black opacity-100">
            {dbUser?.user_type === 'buyer' ? 'Seller' : 'Buyer'}
          </Text>{' '}
          experience?
        </Typography>

        {/* ✅ gap-4 between buttons, fixed minHeight so spinner doesn't resize btn */}
        <View className="flex-row gap-4">
          <View className="flex-1">
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => setConfirmModalOpen(false)}
              disabled={isUpdatingType}
            />
          </View>
          <View className="flex-1">
            {/* ✅ Spinner inside fixed-height container — no layout shift */}
            <TouchableOpacity
              onPress={toggleUserType}
              disabled={isUpdatingType}
              className={`rounded-2xl items-center justify-center ${isUpdatingType ? 'opacity-70' : 'opacity-100'} bg-slate-900 dark:bg-slate-100`}
              style={{ minHeight: 48 }}
            >
              {isUpdatingType ? (
                <ActivityIndicator
                  size="small"
                  color={isDark ? '#0f172a' : '#f1f5f9'}
                />
              ) : (
                <Text className={`font-black text-sm ${isDark ? 'text-slate-900' : 'text-white'}`}>
                  Confirm
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

      </View>
    </Modal>
  </>
);
}