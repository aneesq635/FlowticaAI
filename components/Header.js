import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, useWindowDimensions, Image, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";
import { useAuth } from "./AuthContext.js";
import { 
  ChevronDown, 
  Sun, 
  Moon, 
  Menu, 
  X, 
  LogOut, 
  UserCircle, 
  MessageSquare,
  Layout,
  Home,
  Info,
  Briefcase,
  User,
  Settings,
  ChevronRight
} from "lucide-react-native";
import { useDispatch, useSelector } from "react-redux";
import { toggleTheme } from "../store/orchestrationSlice";
import Modal from "react-native-modal";
import { Typography } from "./ui/Typography";
import { Button } from "./ui/Button";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const reduxTheme = useSelector(state => state.orchestration.theme);
  const isDark = reduxTheme === 'dark';
  
  const [dbUser, setDbUser] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isUpdatingType, setIsUpdatingType] = useState(false);

  const isDesktop = width >= 1024;
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.0.102:5000';

  const toggleUserType = async () => {
    if (!user?.id || !dbUser) return;
    try {
      setIsUpdatingType(true);
      const newType = dbUser.user_type === 'buyer' ? 'seller' : 'buyer';
      const res = await fetch(`${backendUrl}/update-user`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supabase_id: user.id,
          user_type: newType
        })
      });
      const data = await res.json();
      if (data.success) {
        setDbUser({ ...dbUser, user_type: newType });
        setConfirmModalOpen(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdatingType(false);
    }
  };

  const navLinks = [
    { label: "Home", href: "/", icon: Home },
    { label: "Chat", href: "/conversations", icon: MessageSquare },
    { label: "About", href: "/about", icon: Info },
    { label: "Provider", href: "/provider", icon: Briefcase },
  ];

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

  useEffect(() => {
    fetchUser();
  }, [user]);

  const NavItem = ({ label, href, icon: Icon, isMobile = false }) => {
    const isActive = pathname === href;
    return (
      <TouchableOpacity
        onPress={() => {
          router.push(href);
          if (isMobile) setMobileOpen(false);
        }}
        className={`
          flex-row items-center
          ${isMobile ? 'py-4 px-6 rounded-2xl mb-2' : 'px-4 py-2 rounded-xl mx-1'}
          ${isActive 
            ? (isDark ? 'bg-blue-600' : 'bg-slate-900') 
            : (isMobile ? (isDark ? 'bg-slate-900' : 'bg-slate-50') : 'bg-transparent')
          }
        `}
      >
        {isMobile && Icon && (
          <Icon size={20} color={isActive ? '#fff' : (isDark ? '#64748b' : '#475569')} className="mr-4" />
        )}
        <Text className={`
          text-sm font-black uppercase tracking-widest
          ${isActive ? 'text-white' : (isDark ? 'text-slate-400' : 'text-slate-600')}
        `}>
          {label}
        </Text>
        {isMobile && <ChevronRight size={16} color={isDark ? '#334155' : '#e2e8f0'} className="ml-auto" />}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <SafeAreaView 
        edges={['top']} 
        className={`w-full border-b ${isDark ? 'bg-slate-950 border-slate-900' : 'bg-white border-slate-100'} z-50`}
      >
        <View className="flex-row justify-between items-center h-20 px-6 max-w-7xl mx-auto">
          {/* Logo */}
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => router.push("/")}
            className="flex-row items-center"
          >
            <View className="w-10 h-10 bg-blue-600 rounded-xl items-center justify-center mr-3 shadow-lg shadow-blue-500/30">
              <Layout size={20} color="#fff" strokeWidth={3} />
            </View>
            <Text className={`font-black text-xl tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Flowtica <Text className="text-blue-600">AI</Text>
            </Text>
          </TouchableOpacity>

          {/* Desktop Nav */}
          {isDesktop && (
            <View className="flex-row items-center absolute left-1/2 -ml-40">
              {navLinks.map((link) => (
                <NavItem key={link.label} {...link} />
              ))}
            </View>
          )}

          {/* Actions */}
          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => dispatch(toggleTheme())}
              className={`w-11 h-11 rounded-2xl items-center justify-center mr-3 ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-slate-50 border border-slate-100'}`}
            >
              {isDark ? <Sun size={18} color="#f59e0b" /> : <Moon size={18} color="#818cf8" />}
            </TouchableOpacity>

            {!isDesktop && (
              <TouchableOpacity 
                onPress={() => setMobileOpen(true)}
                className={`w-11 h-11 rounded-2xl items-center justify-center ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-slate-50 border border-slate-100'}`}
              >
                <Menu size={20} color={isDark ? '#fff' : '#000'} />
              </TouchableOpacity>
            )}

            {isDesktop && (
              user ? (
                <TouchableOpacity 
                  onPress={logout}
                  className="ml-3 bg-red-500/10 p-3 rounded-2xl border border-red-500/20"
                >
                  <LogOut size={18} color="#ef4444" />
                </TouchableOpacity>
              ) : (
                <Button 
                  title="Connect" 
                  size="sm" 
                  className="ml-3" 
                  onPress={() => router.push("/auth")} 
                />
              )
            )}
          </View>
        </View>
      </SafeAreaView>

      {/* Slide-in Mobile Menu */}
      <Modal 
        isVisible={mobileOpen}
        onBackdropPress={() => setMobileOpen(false)}
        animationIn="slideInRight"
        animationOut="slideOutRight"
        style={{ margin: 0, justifyContent: 'flex-end', flexDirection: 'row' }}
        backdropOpacity={0.4}
        useNativeDriver
      >
        <View className={`h-full w-80 shadow-2xl ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
          <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
            <View className="p-6 flex-row justify-between items-center border-b border-slate-100 dark:border-slate-900">
              <Typography variant="h3">Explore</Typography>
              <TouchableOpacity 
                onPress={() => setMobileOpen(false)}
                className="p-2 bg-slate-100 dark:bg-slate-900 rounded-full"
              >
                <X size={20} color={isDark ? '#fff' : '#000'} />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1 p-4">
              <View className="mb-8">
                <Typography variant="xs" className="ml-2 mb-4">Navigation</Typography>
                {navLinks.map((link) => (
                  <NavItem key={link.label} {...link} isMobile />
                ))}
              </View>

              {user && (
                <View className="mb-8">
                  <Typography variant="xs" className="ml-2 mb-4">Account</Typography>
                  <TouchableOpacity 
                    onPress={() => { setMobileOpen(false); setConfirmModalOpen(true); }}
                    className={`p-4 rounded-2xl flex-row items-center border ${isDark ? 'bg-blue-500/10 border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}
                  >
                    <View className="w-10 h-10 rounded-xl bg-blue-500 items-center justify-center mr-4">
                      <UserCircle size={24} color="#fff" />
                    </View>
                    <View className="flex-1">
                      <Typography variant="small" className="font-black">Switch View</Typography>
                      <Typography variant="xs" className="text-blue-600">to {dbUser?.user_type === 'buyer' ? 'Seller' : 'Buyer'}</Typography>
                    </View>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>

            <View className="p-6 border-t border-slate-100 dark:border-slate-900">
              {user ? (
                <Button 
                  title="Sign Out" 
                  variant="danger" 
                  icon={LogOut}
                  onPress={() => { logout(); setMobileOpen(false); }} 
                />
              ) : (
                <Button 
                  title="Connect Wallet / Auth" 
                  onPress={() => { router.push("/auth"); setMobileOpen(false); }} 
                />
              )}
            </View>
          </SafeAreaView>
        </View>
      </Modal>

      {/* Confirm Type Change Modal */}
      <Modal 
        isVisible={confirmModalOpen}
        onBackdropPress={() => setConfirmModalOpen(false)}
        useNativeDriver
      >
        <View className={`rounded-[40px] p-8 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
          <View className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-3xl items-center justify-center mb-6">
            <UserCircle size={32} color="#3b82f6" />
          </View>
          <Typography variant="h2" className="mb-2">Switch Account</Typography>
          <Typography className="mb-8">
            Are you sure you want to switch to the {dbUser?.user_type === 'buyer' ? 'Seller' : 'Buyer'} experience?
          </Typography>
          
          <View className="flex-row space-x-4">
            <View className="flex-1">
              <Button 
                title="Cancel" 
                variant="secondary" 
                onPress={() => setConfirmModalOpen(false)}
                disabled={isUpdatingType}
              />
            </View>
            <View className="flex-1">
              <Button 
                title={isUpdatingType ? "..." : "Confirm"} 
                onPress={toggleUserType}
                disabled={isUpdatingType}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
