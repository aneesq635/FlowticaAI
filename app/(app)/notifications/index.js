import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector } from 'react-redux';
import { useAuth } from '../../../components/AuthContext';
import { 
  Bell, 
  ArrowLeft, 
  Check, 
  X, 
  Clock, 
  MapPin, 
  DollarSign, 
  CheckCircle,
  AlertCircle
} from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import socketService from '../../../services/socket';

export default function NotificationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';
  
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://172.25.2.90:5000';

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${backendUrl}/api/notifications/${user.id}`);
      const data = await res.json();
      if (data.success) {
        setNotifications(data.notifications || []);
        // Auto mark as read on load
        if (data.notifications?.some(n => n.status === 'unread')) {
          markAllAsRead();
        }
      }
    } catch (e) {
      console.warn("Failed to fetch notifications list", e);
    } finally {
      setIsLoading(false);
    }
  }, [user, backendUrl]);

  const markAllAsRead = async () => {
    if (!user?.id) return;
    try {
      await fetch(`${backendUrl}/api/notifications/mark-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_supabase_id: user.id })
      });
    } catch (e) {
      console.warn(e);
    }
  };

  const clearAll = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${backendUrl}/api/notifications/clear`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_supabase_id: user.id })
      });
      const data = await res.json();
      if (data.success) {
        setNotifications([]);
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const deleteNotification = async (id) => {
    try {
      const res = await fetch(`${backendUrl}/api/notifications/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(prev => prev.filter(n => n._id !== id));
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const handleCounterDecision = async (requestId, decision) => {
    try {
      setIsLoading(true);
      const res = await fetch(`${backendUrl}/api/providers/requests/${requestId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: decision })
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert(
          "Success", 
          `You have ${decision === 'approved' ? 'accepted' : 'declined'} the counter-offer.`
        );
        fetchNotifications();
      } else {
        Alert.alert("Error", data.error || "Failed to submit decision.");
        setIsLoading(false);
      }
    } catch (e) {
      Alert.alert("Error", "Could not reach server.");
      setIsLoading(false);
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
        return () => {
          socket.off('booking_notification', handleNotif);
        };
      }
    } else {
      setIsLoading(false);
    }
  }, [user, fetchNotifications]);

  if (isLoading) {
    return (
      <View className={`flex-1 justify-center items-center ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  // Group by date
  const groupedNotifications = notifications.reduce((acc, notif) => {
    const date = new Date(notif.created_at).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(notif);
    return acc;
  }, {});

  return (
    <ScrollView 
      className={`flex-1 ${isDark ? 'bg-slate-950' : 'bg-slate-50'} px-6 pt-6`}
      showsVerticalScrollIndicator={false}
    >
      <View className="flex-row justify-between items-center mb-8">
        <View className="flex-row items-center">
          <TouchableOpacity 
            onPress={() => router.back()}
            className={`p-3 rounded-2xl mr-4 ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-100'}`}
          >
            <ArrowLeft size={18} color={isDark ? '#e2e8f0' : '#1e293b'} />
          </TouchableOpacity>
          <View>
            <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Notifications</Text>
            <Text className="text-slate-500 font-bold text-xs uppercase tracking-tight">System Updates</Text>
          </View>
        </View>

        {notifications.length > 0 && (
          <TouchableOpacity 
            onPress={clearAll}
            className={`px-4 py-2.5 rounded-2xl ${isDark ? 'bg-slate-900 border border-slate-800' : 'bg-white border border-slate-150'}`}
          >
            <Text className={`text-xs font-black uppercase tracking-wider ${isDark ? 'text-red-400' : 'text-red-600'}`}>
              Clear All
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {notifications.length === 0 ? (
        <View className="items-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 border-dashed">
          <View className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <Bell size={28} color={isDark ? '#64748b' : '#94a3b8'} />
          </View>
          <Text className={`font-black text-base ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>No notifications yet</Text>
          <Text className="text-slate-400 font-bold text-xs mt-1 text-center px-6">
            We will alert you when service providers respond to your requests.
          </Text>
        </View>
      ) : (
        <View className="mb-12">
          {Object.entries(groupedNotifications).map(([date, notifs]) => (
            <View key={date} className="mb-6">
              <Text className={`text-sm font-bold mb-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{date}</Text>
              {notifs.map((notif) => {
                const isUnread = notif.status === 'unread';
                const isCounter = notif.type === 'counter_offer';
                
                return (
                  <Card 
                    key={notif._id} 
                    className={`mb-4 p-5 rounded-3xl border-0 shadow-sm relative overflow-hidden ${
                      isUnread 
                        ? (isDark ? 'bg-slate-900 border-l-4 border-blue-500' : 'bg-white border-l-4 border-blue-500') 
                        : (isDark ? 'bg-slate-900/60' : 'bg-white/80')
                    }`}
                  >
                    <View className="flex-row justify-between items-start mb-2">
                      <View className="flex-1 mr-2">
                        <Text className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {notif.title}
                        </Text>
                        <Text className={`text-sm mt-1 leading-relaxed ${isDark ? 'text-slate-350' : 'text-slate-600'}`}>
                          {notif.message}
                        </Text>
                      </View>
                      <View className="mt-1 flex-row">
                        {notif.type === 'approved' || notif.type === 'booking_confirmed' ? (
                          <CheckCircle size={20} color="#22c55e" className="mr-2" />
                        ) : notif.type === 'denied' ? (
                          <AlertCircle size={20} color="#ef4444" className="mr-2" />
                        ) : (
                          <Clock size={20} color="#f97316" className="mr-2" />
                        )}
                        <TouchableOpacity onPress={() => deleteNotification(notif._id)}>
                          <X size={20} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {isCounter && (
                      <View className="flex-row space-x-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <TouchableOpacity 
                          onPress={() => handleCounterDecision(notif.related_id, 'approved')}
                          className="flex-1 bg-green-600 py-3 rounded-2xl items-center justify-center shadow-sm"
                        >
                          <Text className="text-white font-black text-xs">Accept Offer</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          onPress={() => handleCounterDecision(notif.related_id, 'denied')}
                          className="flex-1 bg-slate-200 dark:bg-slate-800 py-3 rounded-2xl items-center justify-center"
                        >
                          <Text className={`font-black text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                            Decline
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </Card>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
