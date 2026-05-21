import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform
} from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import { X, Calendar, Clock, Check, ChevronRight, AlertCircle } from 'lucide-react-native';
import { useSelector } from 'react-redux';
import api from '../services/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// For simplicity, we'll use a fixed backend URL fallback if env is missing
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://10.73.20.155:5000';

const BookingModal = ({ visible, onClose, provider, customer_id, conversation_id }) => {
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [availability, setAvailability] = useState({ blocked_dates: [], taken_slots: [] });

  // Generate next 14 days
  const dates = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      list.push({
        full: d.toISOString().split('T')[0],
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        date: d.getDate(),
      });
    }
    return list;
  }, []);

  // Standard slots 9 AM - 6 PM
  const timeSlots = [
    '09:00', '10:00', '11:00', '12:00', '13:00',
    '14:00', '15:00', '16:00', '17:00', '18:00'
  ];

  useEffect(() => {
    if (visible && dates.length > 0) {
      setSelectedDate(dates[0].full);
    }
  }, [visible]);

  useEffect(() => {
    if (selectedDate && provider?.supabase_id) {
      fetchAvailability(selectedDate);
    }
  }, [selectedDate, provider]);

  const fetchAvailability = async (date) => {
    setLoading(true);
    try {
      const resp = await fetch(`${API_URL}/api/providers/${provider.supabase_id}/availability?date=${date}`);
      const data = await resp.json();
      if (data.success) {
        setAvailability(data);
      }
    } catch (err) {
      console.error('Failed to fetch availability:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedDate || !selectedSlot) return;

    setConfirming(true);
    try {
      const scheduled_time = `${selectedDate}T${selectedSlot}:00.000Z`;
      const providerSubabaseId = provider.provider_supabase_id || provider.supabase_id;
      const payload = {
        provider_supabase_id: providerSubabaseId,
        customer_supabase_id: customer_id,
        conversation_id: conversation_id,
        service_type: provider.service_name || provider.main_service || provider.service_type || 'Service',
        scheduled_time: scheduled_time,
        price: provider.price_per_hour || provider.hourly_rate || 50,
      };
      console.log('[BookingModal] Submitting payload:', JSON.stringify(payload));
      const data = await api.post('/api/bookings', payload);
      if (data.success) {
        Alert.alert('Booking Confirmed!', `Your session with ${provider.provider_name || provider.name} is scheduled for ${selectedDate} at ${selectedSlot}.`);
        onClose();
      } else {
        Alert.alert('Booking Failed', data.error || 'Something went wrong.');
      }
    } catch (err) {
      Alert.alert('Error', 'Could not reach the server.');
    } finally {
      setConfirming(false);
    }
  };

  if (!provider) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/60">
        <TouchableOpacity
          className="flex-1"
          activeOpacity={1}
          onPress={onClose}
        />

        <AnimatePresence>
          {visible && (
            <MotiView
              from={{ translateY: SCREEN_HEIGHT * 0.5 }}
              animate={{ translateY: 0 }}
              exit={{ translateY: SCREEN_HEIGHT * 0.5 }}
              transition={{ type: 'spring', damping: 20, stiffness: 150 }}
              style={{
                height: SCREEN_HEIGHT * 0.75,
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderTopLeftRadius: 32,
                borderTopRightRadius: 32,
                padding: 24,
              }}
            >
              {/* Header */}
              <View className="flex-row items-center justify-between mb-6">
                <View>
                  <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Book Session
                  </Text>
                  <Text className={`text-sm opacity-60 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    with {provider.provider_name || provider.name}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={onClose}
                  className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                >
                  <X size={20} color={isDark ? '#fff' : '#000'} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Date Selection */}
                <Text className={`text-xs font-bold uppercase tracking-widest mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Select Date
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="mb-8"
                >
                  {dates.map((d) => {
                    const isSelected = selectedDate === d.full;
                    const isBlocked = availability.blocked_dates.includes(d.full);

                    return (
                      <TouchableOpacity
                        key={d.full}
                        disabled={isBlocked}
                        onPress={() => setSelectedDate(d.full)}
                        className={`mr-3 items-center justify-center w-16 h-20 rounded-2xl border-2 ${isSelected
                            ? (isDark ? 'bg-white border-white' : 'bg-slate-900 border-slate-900')
                            : (isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100')
                          } ${isBlocked ? 'opacity-20' : 'opacity-100'}`}
                      >
                        <Text className={`text-[10px] font-bold uppercase ${isSelected
                            ? (isDark ? 'text-slate-900' : 'text-white')
                            : (isDark ? 'text-slate-500' : 'text-slate-400')
                          }`}>
                          {d.day}
                        </Text>
                        <Text className={`text-xl font-black mt-1 ${isSelected
                            ? (isDark ? 'text-slate-900' : 'text-white')
                            : (isDark ? 'text-slate-200' : 'text-slate-900')
                          }`}>
                          {d.date}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Time Selection */}
                <Text className={`text-xs font-bold uppercase tracking-widest mb-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Available Slots
                </Text>

                {loading ? (
                  <View className="py-10 items-center">
                    <ActivityIndicator color={isDark ? '#fff' : '#000'} />
                  </View>
                ) : (
                  <View className="flex-row flex-wrap justify-between">
                    {timeSlots.map((slot) => {
                      const isSelected = selectedSlot === slot;
                      const isTaken = availability.taken_slots.includes(slot);

                      return (
                        <TouchableOpacity
                          key={slot}
                          disabled={isTaken}
                          onPress={() => setSelectedSlot(slot)}
                          className={`w-[30%] mb-3 py-4 rounded-xl items-center justify-center border ${isSelected
                              ? (isDark ? 'bg-white border-white' : 'bg-slate-900 border-slate-900')
                              : (isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-100')
                            } ${isTaken ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}
                        >
                          <Text className={`text-sm font-bold ${isSelected
                              ? (isDark ? 'text-slate-900' : 'text-white')
                              : (isDark ? 'text-slate-300' : 'text-slate-900')
                            }`}>
                            {slot}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* Price Info */}
                <View className={`mt-6 p-5 rounded-3xl flex-row items-center justify-between ${isDark ? 'bg-slate-900/40' : 'bg-slate-50'}`}>
                  <View className="flex-row items-center">
                    <View className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-white shadow-sm'}`}>
                      <Clock size={18} color={isDark ? '#94a3b8' : '#64748b'} />
                    </View>
                    <View className="ml-3">
                      <Text className={`text-[10px] font-bold uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Estimated Price</Text>
                      <Text className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Rs. {provider.price_per_hour || provider.hourly_rate || 50}/hr</Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color={isDark ? '#334155' : '#cbd5e1'} />
                </View>
              </ScrollView>

              {/* Action Buttons */}
              <View className="flex-row items-center space-x-3 mt-6">
                <TouchableOpacity
                  onPress={onClose}
                  className={`flex-1 py-5 rounded-3xl items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}
                >
                  <Text className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  disabled={!selectedSlot || !selectedDate || confirming}
                  onPress={handleConfirm}
                  className={`flex-[2] py-5 rounded-3xl items-center justify-center ${!selectedSlot || !selectedDate
                      ? (isDark ? 'bg-slate-800' : 'bg-slate-200')
                      : (isDark ? 'bg-white' : 'bg-slate-900')
                    }`}
                >
                  {confirming ? (
                    <ActivityIndicator color={isDark ? '#000' : '#fff'} />
                  ) : (
                    <View className="flex-row items-center">
                      <Check size={18} color={isDark ? '#000' : '#fff'} className="mr-2" />
                      <Text className={`font-black ${isDark ? 'text-slate-900' : 'text-white'}`}>Confirm Booking</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </MotiView>
          )}
        </AnimatePresence>
      </View>
    </Modal>
  );
};

export default BookingModal;
