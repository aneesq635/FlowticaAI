import React, { useState, useEffect } from "react";
import { View, ScrollView, TouchableOpacity, Text, TextInput, Modal, Alert, ActivityIndicator, Platform, Linking, StyleSheet, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../../components/AuthContext";
import { Typography } from "../../../components/ui/Typography";
import { useSelector } from "react-redux";
import { Clock, MapPin, CheckCircle, XCircle, DollarSign, Briefcase, Star, Trash, User, Phone, ExternalLink, Globe, Mail, Copy } from "lucide-react-native";
import MiniMap from "../../../components/MiniMap";
import * as Clipboard from 'expo-clipboard';

const StatusBadge = ({ status }) => {
  const getStatusStyles = () => {
    switch (status) {
      case 'completed': return { bg: '#ecfdf5', text: '#10b981', label: 'Completed' };
      case 'cancelled': return { bg: '#fef2f2', text: '#ef4444', label: 'Cancelled' };
      case 'confirmed': return { bg: '#ebf5ff', text: '#3b82f6', label: 'Confirmed' };
      case 'pending': return { bg: '#fff7ed', text: '#f97316', label: 'Pending' };
      case 'waiting_review': return { bg: '#f5f3ff', text: '#8b5cf6', label: 'Waiting for Review' };
      default: return { bg: '#f8fafc', text: '#64748b', label: status.charAt(0).toUpperCase() + status.slice(1) };
    }
  };

  const styles = getStatusStyles();
  return (
    <View style={[s.statusBadge, { backgroundColor: styles.bg }]}>
      <Text style={[s.statusText, { color: styles.text }]}>{styles.label}</Text>
    </View>
  );
};

const AvatarPlaceholder = ({ size = 48 }) => {
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' }]}>
      <User size={size * 0.6} color="#3b82f6" />
    </View>
  );
};

export default function BookedJobs() {
  const router = useRouter();
  const { user } = useAuth();
  const reduxTheme = useSelector(state => state.orchestration.theme);
  const isDark = reduxTheme === 'dark';
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://172.25.2.129:5000';

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

  const handleOpenComplete = (booking) => {
    setSelectedBooking(booking);
    setHoursWorked("");
    setTotalEarned(booking.price ? booking.price.toString() : "");
    setNote("");
    setCompleteModalOpen(true);
  };

  const handleCompleteSubmit = async () => {
    if (!hoursWorked || isNaN(hoursWorked) || parseFloat(hoursWorked) <= 0) {
      Alert.alert("Invalid Input", "Enter hours worked.");
      return;
    }
    try {
      setActionLoading(true);
      const res = await fetch(`${backendUrl}/api/bookings/${selectedBooking._id}/provider-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hours_worked: parseFloat(hoursWorked),
          total_earned: parseFloat(totalEarned),
          note: note
        })
      });
      if ((await res.json()).success) {
        setCompleteModalOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelBooking = (booking) => {
    Alert.alert("Confirm", "Cancel this job?", [
      { text: "Discard", style: "cancel" },
      {
        text: "Confirm",
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(true);
            const res = await fetch(`${backendUrl}/api/bookings/${booking._id}/cancel`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ user_supabase_id: user.id, role: "seller" })
            });
            if ((await res.json()).success) fetchData();
          } catch (err) { console.error(err); }
          finally { setActionLoading(false); }
        }
      }
    ]);
  };

  const handleDeleteBooking = (bookingId) => {
    Alert.alert("Delete", "Remove from history?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Delete",
        style: "destructive",
        onPress: async () => {
          try {
            setActionLoading(true);
            const res = await fetch(`${backendUrl}/api/bookings/${bookingId}`, { method: "DELETE" });
            if ((await res.json()).success) fetchData();
          } catch (e) { console.error(e); }
          finally { setActionLoading(false); }
        }
      }
    ]);
  };

  const openMap = (location) => {
    if (!location?.latitude || !location?.longitude) return;
    const { latitude, longitude, address } = location;
    const url = Platform.select({
      ios: `maps:0,0?q=${address || 'Job Location'}@${latitude},${longitude}`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${address || 'Job Location'})`,
    });
    Linking.openURL(url);
  };

  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, paddingBottom: insets.bottom, backgroundColor: isDark ? '#020617' : '#f8fafc' }}>
      <ScrollView style={{ flex: 1, paddingHorizontal: 24 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Typography variant="h1" style={s.title}>Booked Jobs</Typography>
          <Text style={[s.subtitle, { color: isDark ? '#64748b' : '#94a3b8' }]}>ORCHESTRATION PIPELINE</Text>
        </View>

        {/* Insight Section - Premium Management Header */}
        {/* Insight Section - Premium Stats boxes as in image */}
        <View style={s.statsContainer}>
          <View style={[s.statBox, { backgroundColor: '#fff7ed' }]}>
            <View style={s.statIconCircle}>
              <Clock size={20} color="#f97316" />
            </View>
            <Text style={s.statValueMain}>{stats.total_hours_worked}</Text>
            <Text style={s.statLabelMain}>Total Hours</Text>
          </View>

          <View style={[s.statBox, { backgroundColor: '#f5f3ff' }]}>
            <View style={s.statIconCircle}>
              <DollarSign size={20} color="#8b5cf6" />
            </View>
            <Text style={s.statValueMain}>{stats.total_earnings} PKR</Text>
            <Text style={s.statLabelMain}>Total Earnings</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={isDark ? '#fff' : '#0f172a'} />
        ) : bookings.length === 0 ? (
          <View style={s.emptyState}>
            <Briefcase size={48} color={isDark ? '#1e293b' : '#e2e8f0'} />
            <Text style={[s.emptyText, { color: isDark ? '#475569' : '#94a3b8' }]}>No active workloads assigned.</Text>
          </View>
        ) : (
          bookings.map(booking => {
            const snap = booking.snapshot || {};
            const completed = booking.status === 'completed';
            const cancelled = booking.status === 'cancelled';
            const providerSubmitted = booking.provider_submitted;
            const customerSubmitted = booking.customer_submitted;
            const upcoming = !completed && !cancelled && !providerSubmitted;

            let displayStatus = booking.status;
            if (providerSubmitted && !customerSubmitted && !completed) {
              displayStatus = 'waiting_review';
            }

            return (
              <View key={booking._id} style={s.card}>
                {/* Header: Title, Status, Trash */}
                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.serviceType}>{booking.service_type}</Text>
                    <Text style={s.priceText}>Agreed Price: {booking.price} PKR</Text>
                  </View>
                  <View style={s.statusRow}>
                    <StatusBadge status={displayStatus} />
                    <TouchableOpacity onPress={() => handleDeleteBooking(booking._id)} style={s.trashBtn}>
                      <Trash size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={s.divider} />

                {/* Scheduled Time */}
                <View style={s.infoRow}>
                  <Clock size={18} color="#94a3b8" />
                  <Text style={s.scheduledText}>
                    Scheduled: {booking.requested_date} at {booking.requested_time}
                  </Text>
                </View>

                {/* Customer Details Section */}
                <View style={s.sectionContainer}>
                  <Text style={s.sectionHeader}>CUSTOMER DETAILS</Text>
                  <View style={s.customerRow}>
                    <View style={s.avatarWrapper}>
                      {snap.customer_avatar ? (
                        <Image source={{ uri: snap.customer_avatar }} style={s.avatar} />
                      ) : (
                        <AvatarPlaceholder name={snap.customer_name} size={40} isDark={isDark} />
                      )}
                    </View>
                    <View style={s.customerInfo}>
                      <Text style={s.customerName}>{snap.customer_name || 'Client'}</Text>
                      <TouchableOpacity
                        style={s.emailRow}
                        onPress={async () => {
                          const email = snap.customer_email || booking.customer_email;
                          if (email) {
                            await Clipboard.setStringAsync(email);
                            Alert.alert('Copied', 'Email copied to clipboard');
                          }
                        }}
                      >
                        <Mail size={12} color="#94a3b8" />
                        <Text style={s.contactText}>{snap.customer_email || booking.customer_email || 'No email'}</Text>
                        <Copy size={10} color="#cbd5e1" style={{ marginLeft: 4 }} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Refined Contact Info Box */}
                  <View style={s.contactInfoBox}>
                    {/* Row 1: Phone (Copyable) */}
                    <TouchableOpacity
                      style={s.contactRow}
                      onPress={async () => {
                        await Clipboard.setStringAsync(snap.customer_phone || 'N/A');
                        Alert.alert('Copied', 'Phone number copied to clipboard');
                      }}
                    >
                      <Phone size={16} color="#94a3b8" />
                      <Text style={s.contactValueText}>{snap.customer_phone || 'N/A'}</Text>
                      <View style={s.copyIconSmall}>
                        <Copy size={12} color="#cbd5e1" />
                      </View>
                    </TouchableOpacity>

                    {/* Row 2: Address (Not copyable) */}
                    <View style={[s.contactRow, { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10, marginTop: 10 }]}>
                      <MapPin size={16} color="#94a3b8" />
                      <Text style={s.contactValueText}>
                        {snap.customer_location_data?.address || booking.customer_location || 'No address provided'}
                      </Text>
                    </View>
                  </View>

                  {/* MiniMap Integration */}
                  {snap.customer_location_data?.latitude && (
                    <View style={s.mapContainer}>
                      <MiniMap
                        latitude={snap.customer_location_data.latitude}
                        longitude={snap.customer_location_data.longitude}
                        address={snap.customer_location_data.address}
                        height={120}
                      />
                      <TouchableOpacity
                        onPress={() => openMap(snap.customer_location_data)}
                        style={s.mapOverlay}
                      >
                        <ExternalLink size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Footer Action Buttons */}
                {(upcoming || (cancelled && !providerSubmitted)) && (
                  <View style={s.cardActions}>
                    {upcoming && (
                      <TouchableOpacity onPress={() => handleCancelBooking(booking)} style={[s.actionBtn, s.cancelBtn]}>
                        <Trash size={14} color="#ef4444" style={{ marginRight: 6 }} />
                        <Text style={s.cancelBtnText}>Cancel Job</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => handleOpenComplete(booking)}
                      style={[s.actionBtn, s.completeBtn]}
                    >
                      <CheckCircle size={14} color="#fff" style={{ marginRight: 6 }} />
                      <Text style={s.completeBtnText}>{cancelled ? 'Submit Closure' : 'Done'}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {providerSubmitted && !customerSubmitted && !completed && (
                  <View style={{ marginTop: 16, padding: 12, backgroundColor: '#f5f3ff', borderRadius: 12, borderWidth: 1, borderColor: '#ddd6fe' }}>
                    <Text style={{ color: '#7c3aed', fontWeight: '700', fontSize: 12, textAlign: 'center' }}>
                      Waiting for customer to provide rating and feedback.
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Completion Modal */}
      <Modal visible={completeModalOpen} animationType="slide" transparent={true}>
        <View style={s.modalContainer}>
          <View style={[s.modal, { backgroundColor: isDark ? '#0f172a' : '#fff' }]}>
            <View style={[s.modalHandle, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]} />

            <Text style={[s.modalTitle, { color: isDark ? '#fff' : '#0f172a' }]}>MARK AS DEPLOYED</Text>

            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>HOURS WORKED</Text>
              <TextInput
                value={hoursWorked}
                onChangeText={setHoursWorked}
                placeholder="e.g. 2.5"
                keyboardType="numeric"
                placeholderTextColor="#475569"
                style={[s.input, { backgroundColor: isDark ? '#020617' : '#f8fafc', color: isDark ? '#fff' : '#000', borderColor: isDark ? '#1e293b' : '#e2e8f0' }]}
              />
            </View>

            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>TOTAL EARNINGS (PKR)</Text>
              <TextInput
                value={totalEarned}
                onChangeText={setTotalEarned}
                placeholder="Final amount"
                keyboardType="numeric"
                placeholderTextColor="#475569"
                style={[s.input, { backgroundColor: isDark ? '#020617' : '#f8fafc', color: isDark ? '#fff' : '#000', borderColor: isDark ? '#1e293b' : '#e2e8f0' }]}
              />
            </View>

            <View style={s.inputGroup}>
              <Text style={s.inputLabel}>DEBRIEF NOTES</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Technical remarks..."
                placeholderTextColor="#475569"
                style={[s.input, { backgroundColor: isDark ? '#020617' : '#f8fafc', color: isDark ? '#fff' : '#000', borderColor: isDark ? '#1e293b' : '#e2e8f0', height: 80 }]}
                multiline
              />
            </View>

            <View style={s.modalActions}>
              <TouchableOpacity onPress={() => setCompleteModalOpen(false)} style={s.modalCancel}>
                <Text style={[s.modalCancelText, { color: isDark ? '#fff' : '#000' }]}>DISCARD</Text>
              </TouchableOpacity>

              <TouchableOpacity disabled={actionLoading} onPress={handleCompleteSubmit} style={s.modalSubmit}>
                {actionLoading ? <ActivityIndicator size="small" color="#000" /> : <Text style={s.modalSubmitText}>FINALIZE</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  header: { marginBottom: 24, marginTop: 12 },
  title: { fontSize: 32, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  subtitle: { fontSize: 12, fontWeight: '700', color: '#64748b', letterSpacing: 1, marginTop: 4, textTransform: 'uppercase' },
  statsContainer: { flexDirection: 'row', gap: 16, marginBottom: 32 },
  statBox: { flex: 1, borderRadius: 24, padding: 20, gap: 12, elevation: 1 },
  statIconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  statValueMain: { fontSize: 24, fontWeight: '800', color: '#1e293b' },
  statLabelMain: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  emptyState: { alignItems: 'center', marginTop: 80, gap: 16 },
  emptyText: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { fontSize: 12, fontWeight: '700' },
  trashBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fef2f2', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fee2e2' },
  serviceType: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 2 },
  priceText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  scheduledText: { fontSize: 14, color: '#94a3b8', fontWeight: '500' },
  sectionContainer: { marginTop: 8 },
  sectionHeader: { fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 1.5, marginBottom: 12 },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatarWrapper: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 44, height: 44 },
  customerInfo: { flex: 1, gap: 2 },
  customerName: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  contactText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
  contactInfoBox: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#f1f5f9' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  contactValueText: { fontSize: 13, color: '#64748b', fontWeight: '500', flex: 1, lineHeight: 18 },
  copyIconSmall: { padding: 4 },
  mapContainer: { height: 120, borderRadius: 16, overflow: 'hidden', backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  mapOverlay: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 8 },
  cardActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  actionBtn: { flex: 1, height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  cancelBtn: { backgroundColor: '#fef2f2', borderColor: '#fee2e2' },
  cancelBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '700' },
  completeBtn: { backgroundColor: '#10b981', borderColor: '#059669' },
  completeBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  modalContainer: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modal: { padding: 32, borderTopLeftRadius: 40, borderTopRightRadius: 40, gap: 20 },
  modalHandle: { width: 48, height: 6, borderRadius: 3, alignSelf: 'center', marginBottom: 4 },
  modalTitle: { fontSize: 16, fontWeight: '900', textAlign: 'center', letterSpacing: 1, marginBottom: 16 },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 9, fontWeight: '900', color: '#64748b' },
  input: { padding: 16, borderRadius: 16, borderWidth: 1, fontSize: 14 },
  modalActions: { flexDirection: 'row', gap: 16, marginTop: 12 },
  modalCancel: { flex: 1, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { fontWeight: '900', fontSize: 11 },
  modalSubmit: { flex: 1, height: 56, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  modalSubmitText: { color: '#000', fontWeight: '900', fontSize: 11 },
});
