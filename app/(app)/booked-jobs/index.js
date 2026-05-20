import React, { useState, useEffect } from "react";
import { View, ScrollView, TouchableOpacity, Text, TextInput, Modal, Alert, ActivityIndicator, } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../../components/AuthContext";
import { Typography } from "../../../components/ui/Typography";
import { useSelector } from "react-redux";
import { ArrowLeft, Clock, MapPin, CheckCircle, XCircle, DollarSign, Briefcase, Star, Trash, User, Phone, Mail } from "lucide-react-native";
import MiniMap from "../../../components/MiniMap";

export default function BookedJobs() {
  const router = useRouter();
  const { user } = useAuth();
  const reduxTheme = useSelector(state => state.orchestration.theme);
  const isDark = reduxTheme === 'dark';
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://172.25.2.90:5000';

  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState({
    completed_jobs: 0,
    total_hours_worked: 0,
    total_earnings: 0,
    rating: 5.0
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals state
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [hoursWorked, setHoursWorked] = useState("");
  const [totalEarned, setTotalEarned] = useState("");
  const [note, setNote] = useState("");

  const fetchData = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      // Fetch Bookings
      const resBookings = await fetch(`${backendUrl}/api/bookings/provider/${user.id}`);
      const dataBookings = await resBookings.json();
      if (dataBookings.success) {
        setBookings(dataBookings.bookings);
      }

      // Fetch Provider Stats
      const resProfile = await fetch(`${backendUrl}/api/providers/profile/${user.id}`);
      const dataProfile = await resProfile.json();
      if (dataProfile.success && dataProfile.profile) {
        setStats({
          completed_jobs: dataProfile.profile.completed_jobs || 0,
          total_hours_worked: dataProfile.profile.total_hours_worked || 0,
          total_earnings: dataProfile.profile.total_earnings || 0,
          rating: dataProfile.profile.rating || 5.0
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const isTimePassed = (dateStr, timeStr) => {
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

  const handleOpenComplete = (booking) => {
    setSelectedBooking(booking);
    setHoursWorked("");
    setTotalEarned(booking.price ? booking.price.toString() : "");
    setNote("");
    setCompleteModalOpen(true);
  };

  const handleCompleteSubmit = async () => {
    if (!hoursWorked || isNaN(hoursWorked) || parseFloat(hoursWorked) <= 0) {
      Alert.alert("Invalid Input", "Please enter a valid number of hours worked.");
      return;
    }
    if (!totalEarned || isNaN(totalEarned) || parseFloat(totalEarned) < 0) {
      Alert.alert("Invalid Input", "Please enter a valid earnings amount.");
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetch(`${backendUrl}/api/bookings/${selectedBooking._id}/provider-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hours_worked: parseFloat(hoursWorked),
          total_earned: parseFloat(totalEarned),
          note: note
        })
      });

      const resJson = await response.json();
      if (resJson.success) {
        Alert.alert("Success", "Job marked as completed successfully!");
        setCompleteModalOpen(false);
        fetchData();
      } else {
        Alert.alert("Error", resJson.error || "Failed to complete job.");
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelBooking = (booking) => {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this booking? This will notify the customer.",
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
                  role: "seller"
                })
              });
              const resJson = await response.json();
              if (resJson.success) {
                Alert.alert("Cancelled", "Booking has been successfully cancelled.");
                fetchData();
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

  const handleDeleteBooking = (bookingId) => {
    Alert.alert(
      "Delete Job History",
      "Are you sure you want to delete this job from your history?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setActionLoading(true);
              const response = await fetch(`${backendUrl}/api/bookings/${bookingId}`, {
                method: "DELETE",
              });
              const resJson = await response.json();
              if (resJson.success) {
                Alert.alert("Deleted", "Job has been removed.");
                fetchData();
              } else {
                Alert.alert("Error", resJson.error || "Failed to delete job.");
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

  const insets = useSafeAreaInsets(); // import { useSafeAreaInsets } from 'react-native-safe-area-context'

  return (
    <View style={{ flex: 1, paddingBottom: insets.bottom, backgroundColor: isDark ? '#020617' : '#f8fafc' }}>

      <ScrollView style={{ flex: 1, padding: 24 }} contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="mb-6">
          <Typography variant="h1" className="tracking-tighter text-2xl font-black">Booked Jobs</Typography>
          <Typography variant="body" className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Monitor active bookings, stats, and milestones</Typography>
        </View>

        {/* Insight Section */}
        <View className={`p-5 mb-6 rounded-3xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
          <Typography variant="h3" className="mb-4">Provider Dashboard Insights</Typography>
          <View className="flex-row flex-wrap justify-between">
            <View className={`w-[48%] p-3 mb-3 rounded-2xl ${isDark ? 'bg-slate-800/40' : 'bg-slate-100'} items-center`}>
              <Star size={20} color={isDark ? '#e2e8f0' : '#0f172a'} />
              <Typography variant="h4">{stats.rating.toFixed(1)}</Typography>
              <Typography variant="small" className="opacity-60 text-center">Avg Rating</Typography>
            </View>
            <View className="w-[48%] p-3 mb-3 rounded-2xl bg-emerald-500/10 items-center">
              <CheckCircle size={20} color="#10b981" />
              <Typography variant="h4">{stats.completed_jobs}</Typography>
              <Typography variant="small" className="opacity-60 text-center">Completed Jobs</Typography>
            </View>
            <View className="w-[48%] p-3 rounded-2xl bg-amber-500/10 items-center">
              <Clock size={20} color="#f59e0b" />
              <Typography variant="h4">{stats.total_hours_worked}</Typography>
              <Typography variant="small" className="opacity-60 text-center">Total Hours</Typography>
            </View>
            <View className="w-[48%] p-3 rounded-2xl bg-purple-500/10 items-center">
              <DollarSign size={20} color="#a855f7" />
              <Typography variant="h4">{stats.total_earnings} PKR</Typography>
              <Typography variant="small" className="opacity-60 text-center">Total Earnings</Typography>
            </View>
          </View>
        </View>

        <Typography variant="h3" className="mb-4">My Booked Jobs</Typography>

        {loading ? (
          <View style={{ paddingVertical: 40, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={isDark ? '#ffffff' : '#0f172a'} />
          </View>
        ) : bookings.length === 0 ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 40 }}>
            <Briefcase size={48} color={isDark ? '#475569' : '#94a3b8'} />
            <Typography variant="h3" className="mb-2 mt-3">No Confirmed Jobs</Typography>
            <Typography variant="small" className="text-center opacity-60">
              When client confirms a transaction request, the jobs will show up here.
            </Typography>
          </View>
        ) : (
          bookings.map(booking => {
            const completed = booking.status === 'completed';
            const cancelled = booking.status === 'cancelled';
            const upcoming = !completed && !cancelled;
            const isDoneEnabled = upcoming;

            return (
              <View key={booking._id} className={`p-5 mb-4 rounded-3xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                <View className="flex-row justify-between items-start mb-4">
                  <View className="flex-1 mr-2">
                    <Typography variant="h3">{booking.service_type}</Typography>
                    <Typography variant="small" className="text-blue-500 font-bold mt-1">
                      Agreed Price: {booking.price} PKR
                    </Typography>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <View className={`px-3 py-1 rounded-full ${completed ? 'bg-green-500/20' : cancelled ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
                      <Text className={`font-bold ${completed ? 'text-green-500' : cancelled ? 'text-red-500' : 'text-blue-500'}`}>
                        {completed ? 'Completed' : cancelled ? 'Cancelled' : 'Confirmed'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDeleteBooking(booking._id)}
                      className={`w-8 h-8 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                    >
                      <Trash size={14} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View className="border-t border-b py-3 my-2 border-slate-100 dark:border-slate-800">
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <Clock size={16} color={isDark ? '#94a3b8' : '#64748b'} />
                    <Typography variant="small" className="opacity-80 ml-2 font-semibold">
                      Scheduled: {booking.requested_date} at {booking.requested_time}
                    </Typography>
                  </View>

                  <Text className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 ml-0.5">Customer Details</Text>

                  <View className="flex-row items-center mb-3">
                    <View className="w-10 h-10 rounded-full bg-blue-500/10 items-center justify-center mr-3 border border-blue-500/20">
                      <User size={18} color="#3b82f6" />
                    </View>
                    <View className="flex-1">
                      <Typography variant="small" className="font-bold text-slate-900 dark:text-white text-sm">
                        {booking.customer_name || 'Client'}
                      </Typography>
                      {booking.customer_email ? (
                        <View className="flex-row items-center mt-0.5">
                          <Mail size={12} color={isDark ? '#64748b' : '#94a3b8'} style={{ marginRight: 4 }} />
                          <Typography variant="small" className="text-slate-500 dark:text-slate-400 text-xs">
                            {booking.customer_email}
                          </Typography>
                        </View>
                      ) : null}
                    </View>
                  </View>


                  {(booking.customer_phone && booking.customer_phone !== 'Not provided') ||
                    (booking.customer_location && booking.customer_location !== 'Not provided') ? (
                    <View className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/40">
                      {booking.customer_phone && booking.customer_phone !== 'Not provided' && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: (booking.customer_location && booking.customer_location !== 'Not provided') ? 6 : 0 }}>
                          <Phone size={13} color={isDark ? '#64748b' : '#94a3b8'} />
                          <Typography variant="small" className="opacity-80 ml-2 text-xs font-semibold">
                            {booking.customer_phone}
                          </Typography>
                        </View>
                      )}
                      {booking.customer_location && booking.customer_location !== 'Not provided' && (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <MapPin size={13} color={isDark ? '#64748b' : '#94a3b8'} />
                          <Typography variant="small" className="opacity-80 ml-2 text-xs font-semibold">
                            {booking.customer_location}
                          </Typography>
                        </View>
                      )}
                    </View>
                  ) : null}

                  {booking.location_data?.latitude && (
                    <MiniMap
                      latitude={booking.location_data.latitude}
                      longitude={booking.location_data.longitude}
                      address={booking.location}
                      height={120}
                    />
                  )}
                </View>

                {upcoming && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                    <TouchableOpacity
                      onPress={() => handleCancelBooking(booking)}
                      style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, backgroundColor: 'rgba(239,68,68,0.1)', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    >
                      <Trash size={16} color="#ef4444" />
                      <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Cancel Job</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleOpenComplete(booking)}
                      style={{ paddingHorizontal: 24, paddingVertical: 10, borderRadius: 16, backgroundColor: '#22c55e', flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    >
                      <CheckCircle size={16} color="#ffffff" />
                      <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>Done</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView >

      {/* Modal */}
      < Modal visible={completeModalOpen} animationType="slide" transparent={true} >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <View style={{ padding: 24, borderTopLeftRadius: 40, borderTopRightRadius: 40, borderTopWidth: 1, borderColor: isDark ? '#1e293b' : '#f1f5f9', backgroundColor: isDark ? '#0f172a' : '#ffffff', minHeight: 450 }}>
            <View style={{ width: 48, height: 6, borderRadius: 3, backgroundColor: isDark ? '#334155' : '#e2e8f0', alignSelf: 'center', marginBottom: 24 }} />

            <Typography variant="h2" className="mb-2">Complete Booking</Typography>
            <Typography variant="small" className="opacity-70 mb-6">
              Enter hours worked and the final earned amount to complete the job.
            </Typography>

            <View className="mb-4">
              <Typography variant="small" className="font-bold mb-2">Hours Worked</Typography>
              <TextInput
                value={hoursWorked}
                onChangeText={setHoursWorked}
                placeholder="e.g. 2.5"
                keyboardType="numeric"
                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                className={`p-4 rounded-2xl border text-base ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
              />
            </View>

            <View className="mb-4">
              <Typography variant="small" className="font-bold mb-2">Total Earnings (PKR)</Typography>
              <TextInput
                value={totalEarned}
                onChangeText={setTotalEarned}
                placeholder="e.g. 1500"
                keyboardType="numeric"
                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                className={`p-4 rounded-2xl border text-base ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
              />
            </View>

            <View className="mb-6">
              <Typography variant="small" className="font-bold mb-2">Optional Notes</Typography>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Any special remarks..."
                placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                className={`p-4 rounded-2xl border text-base ${isDark ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
              />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 'auto' }}>
              <TouchableOpacity
                onPress={() => setCompleteModalOpen(false)}
                style={{ width: '45%', paddingVertical: 16, borderRadius: 16, alignItems: 'center', backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}
              >
                <Text style={{ fontWeight: 'bold', color: isDark ? '#ffffff' : '#0f172a' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                disabled={actionLoading}
                onPress={handleCompleteSubmit}
                style={{ width: '45%', paddingVertical: 16, borderRadius: 16, alignItems: 'center', backgroundColor: '#22c55e' }}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal >
    </View >
  );
}
