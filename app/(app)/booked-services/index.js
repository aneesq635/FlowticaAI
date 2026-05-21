import React, { useState, useEffect } from "react";
import { View, ScrollView, TouchableOpacity, Text, TextInput, Alert, ActivityIndicator, Platform, Linking, StyleSheet, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../../components/AuthContext";
import { Typography } from "../../../components/ui/Typography";
import { useSelector } from "react-redux";
import { Clock, MapPin, Star, CheckCircle, Trash, User, Phone, Globe, ExternalLink } from "lucide-react-native";
import Modal from "react-native-modal";
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
  const initials = name ? name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : 'AI';
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
      <Text style={[s.avatarText, { fontSize: size * 0.4, color: isDark ? '#94a3b8' : '#475569' }]}>{initials}</Text>
    </View>
  );
};

export default function BookedServices() {
  const router = useRouter();
  const { user } = useAuth();
  const reduxTheme = useSelector(state => state.orchestration.theme);
  const isDark = reduxTheme === 'dark';
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://172.25.2.129:5000'; // Updated as per user's latest change

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
        console.log(`[DEBUG] Mapped ${data.bookings.length} bookings for customer`);
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
        Alert.alert("Success", "Service finalized.");
        setRatingModal({ open: false, bookingId: null });
        setRating(5);
        setFeedback("");
        fetchBookings();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelBooking = (booking) => {
    Alert.alert(
      "Cancel Booking",
      "Confirm cancellation. The provider will be notified.",
      [
        { text: "Discard", style: "cancel" },
        {
          text: "Confirm",
          style: "destructive",
          onPress: async () => {
            try {
              setActionLoading(true);
              const response = await fetch(`${backendUrl}/api/bookings/${booking._id}/cancel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_supabase_id: user.id, role: "buyer" })
              });
              if ((await response.json()).success) fetchBookings();
            } catch (err) {
              console.error(err);
            } finally {
              setActionLoading(false);
            }
          }
        }
      ]
    );
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
            if ((await res.json()).success) fetchBookings();
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
      ios: `maps:0,0?q=${address || 'Service Location'}@${latitude},${longitude}`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${address || 'Service Location'})`,
    });
    Linking.openURL(url);
  };

  const isPast = (dateStr, timeStr) => {
    try {
      const now = new Date();
      let targetDateStr = dateStr?.includes('T') ? dateStr : `${dateStr}T${timeStr || '00:00'}:00`;
      const targetDate = new Date(targetDateStr);
      return now >= targetDate;
    } catch (e) { return true; }
  };

  return (
    <SafeAreaView edges={['bottom']} style={[s.safe, { backgroundColor: isDark ? '#020617' : '#f8fafc' }]}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Typography variant="h1" style={s.title}>Booked Services</Typography>
          <Text style={[s.subtitle, { color: isDark ? '#64748b' : '#94a3b8' }]}>MANAGEMENT TERMINAL</Text>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={isDark ? '#fff' : '#0f172a'} />
        ) : bookings.length === 0 ? (
          <View style={s.emptyState}>
            <Clock size={48} color={isDark ? '#1e293b' : '#e2e8f0'} />
            <Text style={[s.emptyText, { color: isDark ? '#475569' : '#94a3b8' }]}>No active service requests found.</Text>
          </View>
        ) : (
          bookings.map(booking => {
            const snap = booking.snapshot || {};
            const completed = booking.status === 'completed';
            const cancelled = booking.status === 'cancelled';
            const upcoming = !completed && !cancelled;
            const canComplete = upcoming && isPast(booking.requested_date || booking.date, booking.requested_time || booking.time);

            return (
              <View key={booking._id} style={[s.card, { backgroundColor: isDark ? '#0f172a' : '#fff', borderColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
                {/* Trash Button - Absolute positioned for cleaner header */}
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

                  {/* Provider Details */}
                  <View style={s.entityRow}>
                    <View style={s.avatarContainer}>
                      {snap.provider_avatar ? (
                        <Image source={{ uri: snap.provider_avatar }} style={s.avatar} />
                      ) : (
                        <AvatarPlaceholder name={snap.provider_name || 'Expert'} isDark={isDark} />
                      )}
                    </View>
                    <View style={s.entityDetails}>
                      <Text style={[s.entityName, { color: isDark ? '#f8fafc' : '#0f172a' }]}>{snap.provider_name || 'Service Expert'}</Text>
                      {snap.provider_phone && (
                        <View style={s.infoRow}>
                          <Phone size={10} color="#64748b" />
                          <Text style={s.infoText}>{snap.provider_phone}</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Operational Info Boxes */}
                  <View style={s.operationalGrid}>
                    <View style={[s.infoBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }]}>
                      <View style={s.infoRow}>
                        <Clock size={12} color="#64748b" />
                        <Text style={s.infoLabel}>SCHEDULED:</Text>
                      </View>
                      <Text style={[s.infoValue, { color: isDark ? '#cbd5e1' : '#1e293b' }]}>
                        {booking.requested_date || booking.date} @ {booking.requested_time || booking.time}
                      </Text>
                    </View>
                  </View>

                  {/* Location & Map Section */}
                  {snap.customer_location_data?.address && (
                    <View style={s.locationSection}>
                      <View style={s.locationHeader}>
                        <MapPin size={12} color="#64748b" />
                        <Text style={s.locationTitle}>SERVICE ADDRESS</Text>
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
                              <Text style={s.mapActionText}>OPEN MAPS</Text>
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
                      <Text style={s.cancelBtnText}>CANCEL</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      disabled={!canComplete}
                      onPress={() => setRatingModal({ open: true, bookingId: booking._id })}
                      style={[s.actionBtn, canComplete ? s.completeBtn : s.disabledBtn]}
                    >
                      <Text style={canComplete ? s.completeBtnText : s.disabledBtnText}>
                        {canComplete ? 'MARK COMPLETED' : 'AWAITING SERVICE'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Finalize Modal */}
      <Modal
        isVisible={ratingModal.open}
        onBackdropPress={() => setRatingModal({ open: false, bookingId: null })}
        backdropOpacity={0.4}
        useNativeDriver
      >
        <View style={[s.modal, { backgroundColor: isDark ? '#0f172a' : '#fff' }]}>
          <Text style={[s.modalTitle, { color: isDark ? '#fff' : '#0f172a' }]}>RATE EXPERIENCE</Text>

          <View style={s.starRow}>
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity key={star} onPress={() => setRating(star)} style={s.star}>
                <Star size={28} color={star <= rating ? "#fff" : "#334155"} fill={star <= rating ? "#fff" : "none"} strokeWidth={1.5} />
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            value={feedback}
            onChangeText={setFeedback}
            placeholder="Technical remarks (optional)..."
            placeholderTextColor="#475569"
            style={[s.input, { backgroundColor: isDark ? '#020617' : '#f8fafc', color: isDark ? '#fff' : '#000', borderColor: isDark ? '#1e293b' : '#e2e8f0' }]}
            multiline
          />

          <TouchableOpacity
            disabled={actionLoading}
            onPress={handleComplete}
            style={s.submitBtn}
          >
            {actionLoading ? <ActivityIndicator size="small" color="#000" /> : <Text style={s.submitBtnText}>FINALIZE TRANSACTION</Text>}
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1, padding: 24 },
  scrollContent: { paddingBottom: 100 },
  header: { marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  subtitle: { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginTop: 4 },
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
  disabledBtn: { backgroundColor: 'rgba(255,255,255,0.05)' },
  disabledBtnText: { color: '#475569', fontSize: 11, fontWeight: '900' },
  modal: { padding: 32, borderRadius: 32, gap: 24 },
  modalTitle: { fontSize: 16, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  star: { padding: 4 },
  input: { padding: 16, borderRadius: 16, borderWidth: 1, height: 100, textAlignVertical: 'top', fontSize: 13 },
  submitBtn: { height: 56, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
});
