import React, { useState, useEffect } from "react";
import { View, ScrollView, TouchableOpacity, Text, TextInput, Alert, ActivityIndicator, Platform, Linking, StyleSheet, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../../components/AuthContext";
import { Typography } from "../../../components/ui/Typography";
import { useSelector } from "react-redux";
import { Clock, MapPin, Star, CheckCircle, Trash, User, Phone, Globe, ExternalLink, Mail, Copy } from "lucide-react-native";
import Modal from "react-native-modal";
import MiniMap from "../../../components/MiniMap";
import * as Clipboard from 'expo-clipboard';

const StatusBadge = ({ status }) => {
  const getStatusStyles = () => {
    switch (status) {
      case 'completed': return { bg: '#ecfdf5', text: '#10b981', label: 'Completed' };
      case 'cancelled': return { bg: '#fef2f2', text: '#ef4444', label: 'Cancelled' };
      case 'confirmed': return { bg: '#ebf5ff', text: '#3b82f6', label: 'Confirmed' };
      case 'pending': return { bg: '#fff7ed', text: '#f97316', label: 'Pending' };
      case 'review_needed': return { bg: '#fffbeb', text: '#d97706', label: 'Review Needed' };
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
            const providerSubmitted = booking.provider_submitted;
            const customerSubmitted = booking.customer_submitted;
            const upcoming = !completed && !cancelled && !customerSubmitted;
            const canComplete = (upcoming && isPast(booking.requested_date || booking.date, booking.requested_time || booking.time)) || (providerSubmitted && !customerSubmitted);

            let displayStatus = booking.status;
            if (providerSubmitted && !customerSubmitted && !completed) {
              displayStatus = 'review_needed';
            }

            return (
              <View key={booking._id} style={s.card}>
                {/* Header: Title, Status, Trash */}
                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.serviceType}>{booking.service_type}</Text>
                    <Text style={s.priceText}>Price: {booking.price} PKR</Text>
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
                    Scheduled: {booking.requested_date || booking.date} at {booking.requested_time || booking.time}
                  </Text>
                </View>

                {/* Provider Details Section */}
                <View style={s.sectionContainer}>
                  <Text style={s.sectionHeader}>PROVIDER DETAILS</Text>
                  <View style={s.providerRow}>
                    <View style={s.avatarWrapper}>
                      {snap.provider_avatar ? (
                        <Image source={{ uri: snap.provider_avatar }} style={s.avatar} />
                      ) : (
                        <AvatarPlaceholder name={snap.provider_name} size={40} isDark={isDark} />
                      )}
                    </View>
                    <View style={s.providerInfo}>
                      <Text style={s.providerName}>{snap.provider_name || 'Service Expert'}</Text>
                      <TouchableOpacity
                        style={s.emailRow}
                        onPress={async () => {
                          const email = snap.provider_email || booking.provider_email;
                          if (email) {
                            await Clipboard.setStringAsync(email);
                            Alert.alert('Copied', 'Email copied to clipboard');
                          }
                        }}
                      >
                        <Mail size={12} color="#94a3b8" />
                        <Text style={s.contactText}>{snap.provider_email || booking.provider_email || 'No email'}</Text>
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
                        await Clipboard.setStringAsync(snap.provider_phone || 'N/A');
                        Alert.alert('Copied', 'Phone number copied to clipboard');
                      }}
                    >
                      <Phone size={16} color="#94a3b8" />
                      <Text style={s.contactValueText}>{snap.provider_phone || 'N/A'}</Text>
                      <View style={s.copyIconSmall}>
                        <Copy size={12} color="#cbd5e1" />
                      </View>
                    </TouchableOpacity>

                    {/* Row 2: Address (Not copyable) */}
                    <View style={[s.contactRow, { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10, marginTop: 10 }]}>
                      <MapPin size={16} color="#94a3b8" />
                      <Text style={s.contactValueText}>
                        {snap.provider_location_data?.address || booking.provider_location || 'Address N/A'}
                      </Text>
                    </View>
                  </View>

                  {/* MiniMap Integration */}
                  {(snap.provider_location_data?.latitude || snap.customer_location_data?.latitude) && (
                    <View style={s.mapContainer}>
                      <MiniMap
                        latitude={snap.provider_location_data?.latitude || snap.customer_location_data?.latitude}
                        longitude={snap.provider_location_data?.longitude || snap.customer_location_data?.longitude}
                        address={snap.provider_location_data?.address || snap.customer_location_data?.address}
                        height={120}
                      />
                      <TouchableOpacity
                        onPress={() => openMap(snap.provider_location_data || snap.customer_location_data)}
                        style={s.mapOverlay}
                      >
                        <ExternalLink size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Footer Action Buttons */}
                {upcoming && (
                  <View style={s.cardActions}>
                    {!providerSubmitted && (
                      <TouchableOpacity onPress={() => handleCancelBooking(booking)} style={[s.actionBtn, s.cancelBtn]}>
                        <Trash size={14} color="#ef4444" style={{ marginRight: 6 }} />
                        <Text style={s.cancelBtnText}>Cancel Service</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      disabled={!canComplete}
                      onPress={() => setRatingModal({ open: true, bookingId: booking._id })}
                      style={[s.actionBtn, canComplete ? (providerSubmitted ? s.reviewBtn : s.completeBtn) : s.lockedBtn]}
                    >
                      <CheckCircle size={14} color={canComplete ? (providerSubmitted ? "#fff" : "#3b82f6") : "#64748b"} style={{ marginRight: 6 }} />
                      <Text style={canComplete ? (providerSubmitted ? s.reviewBtnText : s.completeBtnText) : s.lockedBtnText}>
                        {providerSubmitted ? 'Complete Review' : (canComplete ? 'Mark Done' : 'Locked')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {customerSubmitted && !providerSubmitted && !completed && (
                  <View style={{ marginTop: 16, padding: 12, backgroundColor: '#fff7ed', borderRadius: 12, borderWidth: 1, borderColor: '#ffedd5' }}>
                    <Text style={{ color: '#ea580c', fontWeight: '700', fontSize: 12, textAlign: 'center' }}>
                      Waiting for provider to submit final job summary.
                    </Text>
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
  scroll: { flex: 1, padding: 20 },
  scrollContent: { paddingBottom: 100 },
  header: { marginBottom: 24 },
  title: { fontSize: 32, fontWeight: '900', color: '#0f172a', letterSpacing: -0.5 },
  subtitle: { fontSize: 12, fontWeight: '700', color: '#64748b', letterSpacing: 1, marginTop: 4, textTransform: 'uppercase' },
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
  providerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  avatarWrapper: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 44, height: 44 },
  providerInfo: { flex: 1, gap: 2 },
  providerName: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
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
  completeBtn: { backgroundColor: '#ebf5ff', borderColor: '#dbeafe' },
  completeBtnText: { color: '#3b82f6', fontSize: 13, fontWeight: '700' },
  lockedBtn: { backgroundColor: '#f8fafc', borderColor: '#f1f5f9' },
  lockedBtnText: { color: '#94a3b8', fontSize: 13, fontWeight: '700' },
  reviewBtn: { backgroundColor: '#8b5cf6', borderColor: '#7c3aed' },
  reviewBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  modal: { padding: 32, borderRadius: 32, gap: 24 },
  modalTitle: { fontSize: 16, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  star: { padding: 4 },
  input: { padding: 16, borderRadius: 16, borderWidth: 1, height: 100, textAlignVertical: 'top', fontSize: 13 },
  submitBtn: { height: 56, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  submitBtnText: { color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
});
