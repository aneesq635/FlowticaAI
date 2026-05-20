import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSelector } from 'react-redux';
import { Home, MessageSquare, Briefcase, Settings } from 'lucide-react-native';
import { useAuth } from './AuthContext';

const { width } = Dimensions.get('window');

export default function BottomNav({ userType }) {
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const customerTabs = [
    { label: 'Home', href: '/', icon: Home },
    { label: 'Chat', href: '/conversations', icon: MessageSquare },
    { label: 'Services', href: '/booked-services', icon: Briefcase },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  const providerTabs = [
    { label: 'Home', href: '/', icon: Home },
    { label: 'Provider', href: '/provider', icon: Briefcase },
    { label: 'Jobs', href: '/booked-jobs', icon: Briefcase },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  const guestTabs = [
    { label: 'Home', href: '/', icon: Home },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  // Resolve active tabs dynamically
  const tabs = !user 
    ? guestTabs 
    : userType === 'seller' 
      ? providerTabs 
      : customerTabs;

  const getActiveTabHref = (path) => {
    if (!path) return '/';
    if (path === '/') return '/';
    if (path.startsWith('/conversations') || path.startsWith('/orchestrator') || path.startsWith('/chat')) {
      return '/conversations';
    }
    if (path.startsWith('/provider')) {
      return '/provider';
    }
    if (path.startsWith('/booked-jobs')) {
      return '/booked-jobs';
    }
    if (path.startsWith('/booked-services')) {
      return '/booked-services';
    }
    if (path.startsWith('/settings') || path.startsWith('/profile')) {
      return '/settings';
    }
    return path;
  };

  const activeTabHref = getActiveTabHref(pathname);
  const activeIndex = tabs.findIndex(t => t.href === activeTabHref);

  const pillAnim = useRef(new Animated.Value(activeIndex >= 0 ? activeIndex : 0)).current;
  const pillOpacity = useRef(new Animated.Value(activeIndex >= 0 ? 1 : 0)).current;

  useEffect(() => {
    if (activeIndex >= 0) {
      Animated.spring(pillAnim, {
        toValue: activeIndex,
        useNativeDriver: true,
        damping: 18,
        stiffness: 150,
      }).start();
    }
  }, [activeIndex, tabs.length]);

  useEffect(() => {
    Animated.timing(pillOpacity, {
      toValue: activeIndex >= 0 ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [activeIndex]);

  const tabWidth = width / tabs.length;

  return (
    <View
      style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        borderTopWidth: 0.5,
        borderTopColor: isDark ? '#1e293b' : '#e2e8f0',
        paddingBottom: 24, paddingTop: 8,
        height: 80,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {/* Animated Pill Background */}
      {tabs.length > 0 && (
        <Animated.View
          style={{
            position: 'absolute',
            top: 8,
            left: 10,
            width: tabWidth - 20,
            height: 48,
            borderRadius: 24,
            backgroundColor: isDark ? '#f1f5f9' : '#0f172a',
            opacity: pillOpacity,
            transform: [
              {
                translateX: pillAnim.interpolate({
                  inputRange: tabs.map((_, i) => i),
                  outputRange: tabs.map((_, i) => i * tabWidth),
                }),
              },
            ],
            shadowColor: '#000',
            shadowOpacity: isDark ? 0 : 0.08,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 12,
            elevation: 4,
          }}
        />
      )}

      {tabs.map((tab, index) => {
        const isActive = activeTabHref === tab.href;
        const Icon = tab.icon;

        return (
          <TouchableOpacity
            key={tab.href}
            onPress={() => router.push(tab.href)}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              height: 48,
            }}
            activeOpacity={0.7}
          >
            <Icon
              size={20}
              color={
                isActive
                  ? (isDark ? '#0f172a' : '#ffffff')
                  : (isDark ? '#64748b' : '#94a3b8')
              }
            />
            <Text
              style={{
                fontSize: 10,
                fontWeight: '700',
                marginTop: 4,
                color: isActive
                  ? (isDark ? '#0f172a' : '#ffffff')
                  : (isDark ? '#64748b' : '#94a3b8'),
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}