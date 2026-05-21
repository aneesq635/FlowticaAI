import React, { useState, useEffect } from "react";
import { View, ScrollView, TouchableOpacity, Text, TextInput, Modal, Alert, ActivityIndicator, Platform, Linking, StyleSheet, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../../components/AuthContext";
import { Typography } from "../../../components/ui/Typography";
import { useSelector } from "react-redux";
import { Clock, MapPin, CheckCircle, XCircle, DollarSign, Briefcase, Star, Trash, User, Phone, ExternalLink } from "lucide-react-native";
import MiniMap from "../../../components/MiniMap";

const StatusBadge = ({ status }) => {
  const getStatusStyles = () => {
    switch (status) {
      case 'completed': return { bg: 'rgba(255,255,255,0.05)', text: '#10b981', label: 'COMPLETED' };
      case 'cancelled': return { bg: 'rgba(239,68,68,0.1)', text: '#ef4444', label: 'CANCELLED' };
      case 'confirmed': return { bg: 'rgba(255,255,255,0.1)', text: '#fff', label: 'CONFIRMED' };
      default: return { bg: 'rgba(255,255,255,0.03)', text: '#94a3b8', label: status.toUpperCase() };
    }
  };

  const styles = getStatusStyles();
  return (
    <View style={[s.statusBadge, { backgroundColor: styles.bg }]}>
      <Text style={[s.statusText, { color: styles.text }]}>{styles.label}</Text>
    </View>
  );
};

const AvatarPlaceholder = ({ name, size = 48, isDark }) => {
  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 'CL';
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
      <Text style={[s.avatarText, { fontSize: size * 0.4, color: isDark ? '#94a3b8' : '#475569' }]}>{initials}</Text>
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
        <View style={[s.statsCard, { backgroundColor: isDark ? '#0f172a' : '#fff', borderColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
          <View style={s.statsGrid}>
            <View style={s.statItem}>
              <Text style={s.statLabel}>RATING</Text>
              <Text style={[s.statValue, { color: isDark ? '#fff' : '#000' }]}>{stats.rating.toFixed(1)}</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statLabel}>COMPLETED</Text>
              <Text style={[s.statValue, { color: isDark ? '#fff' : '#000' }]}>{stats.completed_jobs}</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statLabel}>HOURS</Text>
              <Text style={[s.statValue, { color: isDark ? '#fff' : '#000' }]}>{stats.total_hours_worked}</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statLabel}>EARNINGS</Text>
              <View style={s.earningsRow}>
                <Text style={[s.statValue, { color: isDark ? '#fff' : '#000' }]}>{stats.total_earnings}</Text>
                <Text style={s.statUnit}>PKR</Text>
              </View>
            </View>
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
            const upcoming = !completed && !cancelled;

            return (
              <View key={booking._id} style={[s.card, { backgroundColor: isDark ? '#0f172a' : '#fff', borderColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
                {/* Trash Button - Absolute Position */}
                <TouchableOpacity onPress={() => handleDeleteBooking(booking._id)} style={s.trashBtnAbsolute}>
                  <Trash size={14} color="#ef4444" />
                </TouchableOpacity>

                {/* Card Header: Type + Status */}
                <View style={s.cardTop}>
                  <StatusBadge status={booking.status} />
                </View>

                {/* Main Info Section */}
                <View style={s.cardBody}>
                  <View style={s.serviceHeader}>
                    <Text style={[s.serviceType, { color: isDark ? '#fff' : '#0f172a' }]}>{booking.service_type.toUpperCase()}</Text>
                    <View style={s.priceTag}>
                      <Text style={s.priceText}>{booking.price}</Text>
                      <Text style={s.currencyText}>PKR</Text>
                    </View>
                  </View>

                  <View style={s.divider} />

                  {/* Customer Section */}
                  <View style={s.entityRow}>
                    <View style={s.avatarContainer}>
                      {snap.customer_avatar ? (
                        <Image source={{ uri: snap.customer_avatar }} style={s.avatar} />
                      ) : (
                        <AvatarPlaceholder name={snap.customer_name || 'Client'} isDark={isDark} />
                      )}
                    </View>
                    <View style={s.entityDetails}>
                      <Text style={[s.entityName, { color: isDark ? '#f8fafc' : '#0f172a' }]}>{snap.customer_name || 'Client'}</Text>
                      {snap.customer_phone && (
                        <View style={s.infoRow}>
                          <Phone size={10} color="#64748b" />
                          <Text style={s.infoText}>{snap.customer_phone}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Operational Info Boxes */}
                  <View style={s.operationalGrid}>
                    <View style={[s.infoBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }]}>
                      <View style={s.infoRow}>
                        <Clock size={12} color="#64748b" />
                        <Text style={s.infoLabel}>TASK START:</Text>
                      </View>
                      <Text style={[s.infoValue, { color: isDark ? '#cbd5e1' : '#1e293b' }]}>
                        {booking.requested_date} @ {booking.requested_time}
                      </Text>
                    </View>
                  </View>

                  {/* Location & Map Section */}
                  {snap.customer_location_data?.address && (
                    <View style={s.locationSection}>
                      <View style={s.locationHeader}>
                        <MapPin size={12} color="#64748b" />
                        <Text style={s.locationTitle}>JOB SITE ADDRESS</Text>
                      </View>
                      <Text style={[s.addressText, { color: isDark ? '#94a3b8' : '#475569' }]} numberOfLines={2}>
                        {snap.customer_location_data.address}
                      </Text>

                      {snap.customer_location_data.latitude && (
                        <View style={s.mapWrapper}>
                          <MiniMap
                            latitude={snap.customer_location_data.latitude}
                            longitude={snap.customer_location_data.longitude}
                            address={snap.customer_location_data.address}
                            height={110}
                          />
                          <TouchableOpacity onPress={() => openMap(snap.customer_location_data)} style={s.mapOverlay}>
                            <View style={s.mapAction}>
                              <ExternalLink size={14} color="#fff" />
                              <Text style={s.mapActionText}>NAVIGATE</Text>
                            </View>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                </View>

                {/* Footer Action Buttons */}
                {upcoming && (
                  <View style={s.cardActions}>
                    <TouchableOpacity onPress={() => handleCancelBooking(booking)} style={[s.actionBtn, s.cancelBtn]}>
                      <Text style={s.cancelBtnText}>CANCEL TASK</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleOpenComplete(booking)}
                      style={[s.actionBtn, s.completeBtn]}
                    >
                      <Text style={s.completeBtnText}>DEPLOY COMPLETE</Text>
                    </TouchableOpacity>
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
  header: { marginBottom: 32, marginTop: 24 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  subtitle: { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginTop: 4 },
  statsCard: { paddingHorizontal: 24, paddingVertical: 18, borderRadius: 28, marginBottom: 28, borderWidth: 1 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statItem: { alignItems: 'center' },
  statLabel: { fontSize: 8, fontWeight: '900', color: '#64748b', marginBottom: 6, letterSpacing: 1 },
  statValue: { fontSize: 16, fontWeight: '900' },
  statDivider: { width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.06)' },
  earningsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  statUnit: { fontSize: 8, fontWeight: '900', color: '#64748b', marginBottom: 2 },
  emptyState: { alignItems: 'center', marginTop: 80, gap: 16 },
  emptyText: { fontSize: 12, fontWeight: 'bold' },
  card: { borderRadius: 28, padding: 24, marginBottom: 20, borderWidth: 1, overflow: 'hidden' },
  trashBtnAbsolute: { position: 'absolute', top: 20, right: 20, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(239,68,68,0.08)', zIndex: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  cardBody: { gap: 20 },
  serviceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingRight: 40 },
  serviceType: { fontSize: 18, fontWeight: '900', letterSpacing: 0.5, flex: 1, lineHeight: 24 },
  priceTag: { alignItems: 'flex-end', marginLeft: 12 },
  priceText: { fontSize: 18, fontWeight: '900', color: '#64748b' },
  currencyText: { fontSize: 10, fontWeight: '900', color: '#94a3b8', marginTop: -2 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  entityRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarContainer: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  entityDetails: { gap: 4, flex: 1 },
  entityName: { fontSize: 14, fontWeight: '800' },
  operationalGrid: { gap: 12 },
  infoBox: { padding: 16, borderRadius: 18 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  infoLabel: { fontSize: 9, color: '#64748b', fontWeight: '900', letterSpacing: 0.5 },
  infoValue: { fontSize: 12, fontWeight: '700' },
  infoText: { fontSize: 11, color: '#94a3b8' },
  locationSection: { gap: 10 },
  locationHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationTitle: { fontSize: 10, fontWeight: '900', color: '#64748b', letterSpacing: 1 },
  addressText: { fontSize: 13, lineHeight: 20 },
  mapWrapper: { borderRadius: 20, overflow: 'hidden', height: 110, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  mapOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  mapAction: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#000', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  mapActionText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  cardActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  actionBtn: { flex: 1, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { backgroundColor: 'transparent', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  cancelBtnText: { color: '#ef4444', fontSize: 11, fontWeight: '900' },
  completeBtn: { backgroundColor: '#fff' },
  completeBtnText: { color: '#000', fontSize: 11, fontWeight: '900' },
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
