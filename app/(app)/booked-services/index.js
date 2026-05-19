import React, { useState, useEffect } from "react";
import { View, ScrollView, TouchableOpacity, Text, TextInput, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../../components/AuthContext";
import { Typography } from "../../../components/ui/Typography";
import { useSelector } from "react-redux";
import { ArrowLeft, Clock, MapPin, Star, CheckCircle, Trash, User, Phone, Mail } from "lucide-react-native";
import Modal from "react-native-modal";
import { Button } from "../../../components/ui/Button";

export default function BookedServices() {
  const router = useRouter();
  const { user } = useAuth();
  const reduxTheme = useSelector(state => state.orchestration.theme);
  const isDark = reduxTheme === 'dark';
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://172.25.2.90:5000';

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [ratingModal, setRatingModal] = useState({ open: false, bookingId: null });
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");

  const fetchBookings = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const res = await fetch(`${backendUrl}/api/bookings/customer/${user.id}`);
      const data = await res.json();
      if (data.success) {
        setBookings(data.bookings);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [user]);

  const handleComplete = async () => {
    try {
      setActionLoading(true);
      const res = await fetch(`${backendUrl}/api/bookings/${ratingModal.bookingId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, feedback })
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert("Completed", "Service completed and rated successfully!");
        setRatingModal({ open: false, bookingId: null });
        setRating(5);
        setFeedback("");
        fetchBookings();
      } else {
        Alert.alert("Error", data.error || "Failed to complete service.");
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelBooking = (booking) => {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this service booking? This will notify the provider.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              setActionLoading(true);
              const response = await fetch(`${backendUrl}/api/bookings/${booking._id}/cancel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  user_supabase_id: user.id,
                  role: "buyer"
                })
              });
              const resJson = await response.json();
              if (resJson.success) {
                Alert.alert("Cancelled", "Booking has been successfully cancelled.");
                fetchBookings();
              } else {
                Alert.alert("Error", resJson.error || "Failed to cancel booking.");
              }
            } catch (err) {
              console.error(err);
              Alert.alert("Error", "Something went wrong.");
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
  };

  const isPast = (dateStr, timeStr) => {
    try {
      const now = new Date();
      let targetDateStr = dateStr;
      if (timeStr) {
        let timePart = timeStr.trim();
        // Convert 12 hour to 24 hour if present
        if (timePart.toLowerCase().includes('pm') || timePart.toLowerCase().includes('am')) {
          const parts = timePart.split(' ');
          const time = parts[0];
          const modifier = parts[1] || 'pm';
          let [hours, minutes] = time.split(':');
          if (hours === '12') hours = '00';
          if (modifier.toLowerCase() === 'pm') hours = parseInt(hours, 10) + 12;
          timePart = `${hours.toString().padStart(2, '0')}:${minutes.padStart(2, '0')}`;
        }
        targetDateStr = `${dateStr}T${timePart}:00`;
      }
      const targetDate = new Date(targetDateStr);
      return now >= targetDate;
    } catch (e) {
      return true; // fallback
    }
  };

  return (
    <SafeAreaView edges={['bottom']} className={`flex-1 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>

      <ScrollView className="flex-1 p-6" contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="mb-6">
          <Typography variant="h1" className="tracking-tighter text-2xl font-black">Booked Services</Typography>
          <Typography variant="body" className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Track and manage your requested services</Typography>
        </View>

        {loading ? (
          <View className="py-10 justify-center items-center">
            <ActivityIndicator size="large" color={isDark ? '#ffffff' : '#0f172a'} />
          </View>
        ) : bookings.length === 0 ? (
          <View className="items-center justify-center mt-20">
            <Typography variant="h3" className="mb-2">No Bookings Yet</Typography>
            <Typography variant="small" className="text-center opacity-60">
              When you book a service, it will appear here.
            </Typography>
          </View>
        ) : (
          bookings.map(booking => {
            const completed = booking.status === 'completed';
            const cancelled = booking.status === 'cancelled';
            const upcoming = !completed && !cancelled;
            const canComplete = upcoming && isPast(booking.date, booking.time);
            
            return (
              <View key={booking._id} className={`p-5 mb-4 rounded-3xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
                <View className="flex-row justify-between items-start mb-4">
                  <View className="flex-1 mr-2">
                    <Typography variant="h3">{booking.service_type}</Typography>
                    <Typography variant="small" className="text-blue-500 font-bold mt-1">
                      Price: {booking.price} PKR
                    </Typography>
                  </View>
                  <View className={`px-3 py-1 rounded-full ${completed ? 'bg-green-500/20' : cancelled ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
                    <Text className={`font-bold ${completed ? 'text-green-500' : cancelled ? 'text-red-500' : 'text-blue-500'}`}>
                      {completed ? 'Completed' : cancelled ? 'Cancelled' : 'Confirmed'}
                    </Text>
                  </View>
                </View>

                {/* Details */}
                <View className="border-t border-b py-3 my-2 border-slate-100 dark:border-slate-800">
                  <View className="flex-row items-center mb-3">
                   <Clock size={16} color={isDark ? '#94a3b8' : '#64748b'} style={{ marginRight: 8 }} />
                    <Typography variant="small" className="opacity-80 font-semibold">
                      Scheduled: {booking.date || booking.requested_date} at {booking.time || booking.requested_time}
                    </Typography>
                  </View>

                  <Text className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 ml-0.5">Provider Details</Text>
                  
                  <View className="flex-row items-center mb-3">
                    <View className="w-10 h-10 rounded-full bg-blue-500/10 items-center justify-center mr-3 border border-blue-500/20">
                      <User size={18} color="#3b82f6" />
                    </View>
                    <View className="flex-1">
                      <Typography variant="small" className="font-bold text-slate-900 dark:text-white text-sm">
                        {booking.provider_name || 'Service Expert'}
                      </Typography>
                      {booking.provider_email ? (
                        <View className="flex-row items-center mt-0.5">
                          <Mail size={12} color={isDark ? '#64748b' : '#94a3b8'} style={{ marginRight: 4 }} />
                          <Typography variant="small" className="text-slate-500 dark:text-slate-400 text-xs">
                            {booking.provider_email}
                          </Typography>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  {(booking.provider_phone && booking.provider_phone !== 'Not provided') ||
 (booking.provider_location && booking.provider_location !== 'Not provided') ? (
  <View className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/40">
    {booking.provider_phone && booking.provider_phone !== 'Not provided' && (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: (booking.provider_location && booking.provider_location !== 'Not provided') ? 6 : 0 }}>
        <Phone size={13} color={isDark ? '#64748b' : '#94a3b8'} />
        <Typography variant="small" className="opacity-80 text-xs font-semibold ml-2">
          {booking.provider_phone}
        </Typography>
      </View>
    )}
    {booking.provider_location && booking.provider_location !== 'Not provided' && (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <MapPin size={13} color={isDark ? '#64748b' : '#94a3b8'} />
        <Typography variant="small" className="opacity-80 text-xs font-semibold ml-2">
          {booking.provider_location}
        </Typography>
      </View>
    )}
  </View>
) : null}
                </View>

                {upcoming && (
                  <View className="flex-row justify-between items-center mt-4">
                    <TouchableOpacity 
                      onPress={() => handleCancelBooking(booking)}
                      className="px-4 py-2.5 rounded-2xl bg-red-500/10 flex-row items-center"
                    >
                     <Trash size={16} color="#ef4444" style={{ marginRight: 6 }} />
                      <Text className="text-red-500 font-bold">Cancel Service</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                      disabled={!canComplete}
                      onPress={() => setRatingModal({ open: true, bookingId: booking._id })}
                      className={`px-6 py-2.5 rounded-2xl flex-row items-center ${canComplete ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-800'}`}
                    >
                      <CheckCircle size={16} color={canComplete ? '#ffffff' : '#64748b'} style={{ marginRight: 6 }} />
                      <Text className={`font-bold ${canComplete ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                        {canComplete ? 'Mark Completed' : 'Locked'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Rating Modal */}
      <Modal isVisible={ratingModal.open} onBackdropPress={() => setRatingModal({ open: false, bookingId: null })} useNativeDriver>
        <View className={`p-6 rounded-[32px] ${isDark ? 'bg-slate-900' : 'bg-white'}`}>
          <Typography variant="h3" className="mb-2 text-center">Rate your experience</Typography>
          <Typography variant="small" className="opacity-60 mb-6 text-center">
            How was the quality of service provided?
          </Typography>
          
          <View className="flex-row justify-center mb-6">
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity key={star} onPress={() => setRating(star)} className="p-2">
                <Star size={32} color={star <= rating ? "#eab308" : (isDark ? "#334155" : "#cbd5e1")} fill={star <= rating ? "#eab308" : "none"} />
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            value={feedback}
            onChangeText={setFeedback}
            placeholder="Write some feedback (optional)..."
            placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
            className={`p-4 mb-6 rounded-2xl border text-base min-h-[80] ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
            multiline
          />

          <View className="flex-row justify-between">
            <TouchableOpacity 
              onPress={() => setRatingModal({ open: false, bookingId: null })}
              className={`w-[45%] py-4 rounded-2xl items-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
            >
              <Text className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              disabled={actionLoading}
              onPress={handleComplete}
              className={`w-[45%] py-4 rounded-2xl ${isDark ? 'bg-white' : 'bg-slate-900'} items-center justify-center`}
            >
              {actionLoading ? (
                <ActivityIndicator size="small" color={isDark ? '#0f172a' : '#ffffff'} />
              ) : (
                <Text className={`${isDark ? 'text-slate-950' : 'text-white'} font-bold`}>Submit</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
