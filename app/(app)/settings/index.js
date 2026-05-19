import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '../../../components/AuthContext';
import { toggleTheme } from '../../../store/orchestrationSlice';
import { Sun, Moon, LogOut, UserCircle, ChevronRight, RefreshCw } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import Modal from 'react-native-modal';
import { useDbUser } from '../../../components/UserContext';

export default function SettingsPage() {
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';
  const dispatch = useDispatch();
  const { user, logout } = useAuth();
  const router = useRouter();

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const { dbUser, setDbUser } = useDbUser();
  const [isUpdatingType, setIsUpdatingType] = useState(false);
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://172.25.2.90:5000';

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

  useEffect(() => {
    fetchUser();
  }, [user?.id]);

  // Normal row — ChevronRight wala, koi toggle nahi
  const Row = ({ icon: Icon, label, sub, onPress, danger }) => (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-row items-center p-4 mb-3 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
      activeOpacity={0.7}
    >
      <View className={`w-10 h-10 rounded-xl items-center justify-center mr-4 ${danger ? 'bg-red-500/10' : isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
        <Icon size={20} color={danger ? '#ef4444' : isDark ? '#94a3b8' : '#475569'} />
      </View>
      <View className="flex-1">
        <Text className={`font-bold text-sm ${danger ? 'text-red-500' : isDark ? 'text-slate-100' : 'text-slate-900'}`}>{label}</Text>
        {sub && <Text className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{sub}</Text>}
      </View>
      <ChevronRight size={16} color={isDark ? '#334155' : '#cbd5e1'} />
    </TouchableOpacity>
  );

  // Theme toggle row — alag, toggle switch ke saath
  const ThemeRow = () => (
    <TouchableOpacity
      onPress={() => dispatch(toggleTheme())}
      className={`flex-row items-center p-4 mb-3 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
      activeOpacity={0.7}
    >
      <View className={`w-10 h-10 rounded-xl items-center justify-center mr-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
        {isDark ? <Sun size={20} color="#94a3b8" /> : <Moon size={20} color="#475569" />}
      </View>
      <View className="flex-1">
        <Text className={`font-bold text-sm ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Dark Mode</Text>
        <Text className={`text-xs mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Change app theme</Text>
      </View>
      {/* Toggle Switch */}
      <View
        style={{
          width: 48,
          height: 28,
          borderRadius: 14,
          backgroundColor: isDark ? '#6366f1' : '#cbd5e1',
          justifyContent: 'center',
          paddingHorizontal: 3,
        }}
      >
        <View style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: 'white',
          alignSelf: isDark ? 'flex-end' : 'flex-start',
          shadowColor: '#000',
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 3,
        }} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className={`flex-1 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`} edges={['top']}>
      <ScrollView className="flex-1 px-5 pt-4" contentContainerStyle={{ paddingBottom: 100 }}>
        <Text className={`text-2xl font-black mb-6 ${isDark ? 'text-white' : 'text-slate-950'}`}>Settings</Text>

        {/* Appearance Section */}
        <Text className={`text-xs font-black uppercase tracking-widest mb-3 ml-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Appearance</Text>
        <ThemeRow />

        {/* Account Section — logged in */}
        {user && (
          <>
            <Text className={`text-xs font-black uppercase tracking-widest mb-3 ml-1 mt-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Account</Text>
            <Row icon={UserCircle} label="My Profile" sub="Edit contact & location" onPress={() => router.push('/profile')} />
            <Row icon={RefreshCw} label="Switch Role" sub="Toggle between buyer & seller" onPress={() => setConfirmModalOpen(true)} />
            <Row icon={LogOut} label="Sign Out" danger onPress={logout} />
          </>
        )}

        {/* Account Section — logged out */}
        {!user && (
          <>
            <Text className={`text-xs font-black uppercase tracking-widest mb-3 ml-1 mt-4 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Account</Text>
            <Row icon={UserCircle} label="Sign In" sub="Connect your account" onPress={() => router.push('/auth')} />
          </>
        )}
      </ScrollView>

      {/* Switch Role Modal */}
      <Modal
        isVisible={confirmModalOpen}
        onBackdropPress={() => setConfirmModalOpen(false)}
        useNativeDriver
      >
        <View className={`rounded-[40px] p-8 ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
          <View className={`w-16 h-16 rounded-3xl items-center justify-center mb-6 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-100'}`}>
            <UserCircle size={32} color={isDark ? '#e2e8f0' : '#0f172a'} />
          </View>

          <Text className={`text-xl font-black mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Switch Account</Text>
          <Text className={`mb-8 text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Are you sure you want to switch to the{' '}
            <Text className={`font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {dbUser?.user_type === 'buyer' ? 'Seller' : 'Buyer'}
            </Text>{' '}
            experience?
          </Text>

          <View className="flex-row gap-4">
            <View className="flex-1">
              <TouchableOpacity
                onPress={() => setConfirmModalOpen(false)}
                disabled={isUpdatingType}
                className={`rounded-2xl items-center justify-center border ${isDark ? 'border-slate-700' : 'border-slate-200'}`}
                style={{ minHeight: 48 }}
              >
                <Text className={`font-black text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <View className="flex-1">
              <TouchableOpacity
                onPress={toggleUserType}
                disabled={isUpdatingType}
                className={`rounded-2xl items-center justify-center ${isUpdatingType ? 'opacity-70' : 'opacity-100'} ${isDark ? 'bg-slate-100' : 'bg-slate-900'}`}
                style={{ minHeight: 48 }}
              >
                {isUpdatingType ? (
                  <ActivityIndicator size="small" color={isDark ? '#0f172a' : '#f1f5f9'} />
                ) : (
                  <Text className={`font-black text-sm ${isDark ? 'text-slate-900' : 'text-white'}`}>Confirm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}