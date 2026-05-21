import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Linking, Platform, StyleSheet } from 'react-native';
import { MotiView, AnimatePresence } from 'moti';
import {
  Star,
  MapPin,
  CheckCircle,
  Phone,
  Navigation,
  ChevronDown,
  ChevronUp,
  Clock,
  ShieldCheck,
  Award,
  Calendar,
  Zap,
} from 'lucide-react-native';
import { useSelector } from 'react-redux';
import MiniMap from './MiniMap';

const ChatProviderCard = ({ provider, onBook, index = 0 }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';

  const phone = provider.phone || provider.location_data?.phone || '';
  const canCall = phone.length > 0 && phone !== '???';

  const openDialer = () => {
    if (canCall) Linking.openURL(`tel:${phone}`);
  };

  const openMaps = () => {
    const coords = provider.provider_coordinates || provider.location_data || {};
    const lat = coords.latitude || provider.coordinates?.[1];
    const lng = coords.longitude || provider.coordinates?.[0];
    if (lat && lng) {
      const label = encodeURIComponent(provider.name || 'Provider');
      const url = Platform.select({
        ios: `maps:0,0?q=${label}@${lat},${lng}`,
        android: `geo:0,0?q=${lat},${lng}(${label})`,
      });
      Linking.openURL(url);
    }
  };

  const rating = provider.rating?.toFixed(1) || '5.0';
  const distance =
    provider._distance_km && provider._distance_km < 900
      ? `${provider._distance_km}km`
      : '???';

  return (
    <MotiView
      from={{ opacity: 0, translateY: 24, scale: 0.97 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: 'timing', duration: 420, delay: index * 120 }}
      style={[
        styles.card,
        {
          backgroundColor: isDark ? '#0d1117' : '#ffffff',
          borderColor: isDark ? '#1e293b' : '#e8edf5',
          shadowColor: isDark ? '#000' : '#94a3b8',
        },
      ]}
    >
      {/* ── TOP ACCENT BAR ── */}
      <View style={styles.accentBar} />

      {/* ── HEADER ── */}
      <View style={styles.header}>
        {/* Name + badge */}
        <View style={{ flex: 1, marginRight: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
            <Text
              style={[styles.providerName, { color: isDark ? '#f1f5f9' : '#0f172a' }]}
              numberOfLines={1}
            >
              {provider.name}
            </Text>
            {provider.verified && (
              <ShieldCheck
                size={15}
                color="#10b981"
                style={{ marginLeft: 6 }}
              />
            )}
          </View>
          <Text style={[styles.serviceType, { color: isDark ? '#475569' : '#64748b' }]}>
            {(provider.specialization || provider.service_type || '').toUpperCase()}
          </Text>
        </View>

        {/* Rating pill */}
        <View
          style={[
            styles.ratingPill,
            { backgroundColor: isDark ? '#1e293b' : '#fef9ee' },
          ]}
        >
          <Star size={13} color="#f59e0b" fill="#f59e0b" />
          <Text style={[styles.ratingText, { color: isDark ? '#fbbf24' : '#92400e' }]}>
            {rating}
          </Text>
        </View>
      </View>

      {/* ── STATS ROW ── */}
      <View style={styles.statsRow}>
        <StatChip icon={<MapPin size={12} color="#6366f1" />} label={distance} isDark={isDark} />
        <StatChip
          icon={<Clock size={12} color="#0ea5e9" />}
          label={`${provider.eta_minutes || '--'} min`}
          isDark={isDark}
        />
        <StatChip
          icon={<Award size={12} color="#10b981" />}
          label={`Rs.${provider.hourly_rate || provider.priceEst}/hr`}
          isDark={isDark}
        />
        <StatChip
          icon={<Zap size={12} color="#f59e0b" />}
          label={`${(((provider.reliability_score || 0.95) * 100).toFixed(0))}%`}
          isDark={isDark}
        />
      </View>

      {/* ── MAP ── */}
      <TouchableOpacity
        onPress={openMaps}
        activeOpacity={0.92}
        style={[styles.mapContainer, { borderColor: isDark ? '#1e293b' : '#e2e8f0' }]}
      >
        <View pointerEvents="none">
          <MiniMap
            latitude={
              provider.provider_coordinates?.latitude ||
              provider.location_data?.latitude ||
              33.6844
            }
            longitude={
              provider.provider_coordinates?.longitude ||
              provider.location_data?.longitude ||
              73.0479
            }
            height={130}
          />
        </View>
        {/* Map overlay hint */}
        <View style={styles.mapOverlay}>
          <Navigation size={11} color="#fff" />
          <Text style={styles.mapOverlayText}>Tap to open maps</Text>
        </View>
      </TouchableOpacity>

      {/* ── AI REASONING ── */}
      <View
        style={[
          styles.reasoningBox,
          { backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: isDark ? '#1e293b' : '#e2e8f0' },
        ]}
      >
        <Text style={[styles.reasoningLabel, { color: isDark ? '#334155' : '#94a3b8' }]}>
          AI SELECTION REASONING
        </Text>
        {Array.isArray(provider.ranking_reason) ? (
          provider.ranking_reason.map((reason, idx) => (
            <ReasonRow key={idx} text={reason} isDark={isDark} />
          ))
        ) : (
          <ReasonRow
            text={provider.ranking_reason || 'Verified match based on location and rating.'}
            isDark={isDark}
          />
        )}
      </View>

      {/* ── EXPAND TOGGLE ── */}
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        style={styles.expandToggle}
        activeOpacity={0.7}
      >
        <Text style={[styles.expandText, { color: isDark ? '#475569' : '#94a3b8' }]}>
          {isExpanded ? 'Show Less' : 'Show More Details'}
        </Text>
        {isExpanded ? (
          <ChevronUp size={13} color={isDark ? '#475569' : '#94a3b8'} />
        ) : (
          <ChevronDown size={13} color={isDark ? '#475569' : '#94a3b8'} />
        )}
      </TouchableOpacity>

      {/* ── EXPANDED CONTENT ── */}
      <AnimatePresence>
        {isExpanded && (
          <MotiView
            from={{ opacity: 0, translateY: -8 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0, translateY: -8 }}
            transition={{ type: 'timing', duration: 250 }}
            style={[
              styles.expandedBox,
              {
                backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                borderColor: isDark ? '#1e293b' : '#e2e8f0',
              },
            ]}
          >
            <ExpandRow
              label="Experience & Skills"
              value={provider.experience || 'Available upon request.'}
              isDark={isDark}
            />
            <View style={{ height: 10 }} />
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <ExpandRow
                label="Languages"
                value={provider.languages?.join(', ') || 'English, Urdu'}
                isDark={isDark}
                flex
              />
              <ExpandRow
                label="Completed Jobs"
                value={`${provider.completed_jobs || 0} Jobs`}
                isDark={isDark}
                flex
              />
            </View>
          </MotiView>
        )}
      </AnimatePresence>

      {/* ── ACTION FOOTER ── */}
      <View
        style={[
          styles.footer,
          { borderTopColor: isDark ? '#1e293b' : '#f1f5f9' },
        ]}
      >
        {/* Call */}
        <TouchableOpacity
          onPress={openDialer}
          disabled={!canCall}
          style={[
            styles.footerBtn,
            {
              borderRightWidth: 1,
              borderRightColor: isDark ? '#1e293b' : '#f1f5f9',
              opacity: canCall ? 1 : 0.3,
            },
          ]}
        >
          <Phone size={15} color={isDark ? '#94a3b8' : '#64748b'} />
          <Text style={[styles.footerBtnText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
            Call
          </Text>
        </TouchableOpacity>

        {/* Maps */}
        <TouchableOpacity
          onPress={openMaps}
          style={[
            styles.footerBtn,
            {
              borderRightWidth: 1,
              borderRightColor: isDark ? '#1e293b' : '#f1f5f9',
            },
          ]}
        >
          <Navigation size={15} color={isDark ? '#94a3b8' : '#64748b'} />
          <Text style={[styles.footerBtnText, { color: isDark ? '#94a3b8' : '#64748b' }]}>
            Maps
          </Text>
        </TouchableOpacity>

        {/* Book — hero button */}
        <TouchableOpacity
          onPress={() => onBook(provider)}
          style={styles.bookBtn}
          activeOpacity={0.85}
        >
          <View style={styles.bookBtnInner}>
            <Calendar size={14} color="#fff" />
            <Text style={styles.bookBtnText}>Book</Text>
          </View>
        </TouchableOpacity>
      </View>
    </MotiView>
  );
};

/* ─── Small helper components ─── */

const StatChip = ({ icon, label, isDark }) => (
  <View
    style={[
      styles.statChip,
      { backgroundColor: isDark ? '#161b27' : '#f8fafc', borderColor: isDark ? '#1e293b' : '#e8edf5' },
    ]}
  >
    {icon}
    <Text style={[styles.statLabel, { color: isDark ? '#64748b' : '#64748b' }]}>{label}</Text>
  </View>
);

const ReasonRow = ({ text, isDark }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 5 }}>
    <CheckCircle size={11} color="#10b981" fill="rgba(16,185,129,0.12)" />
    <Text style={[styles.reasonText, { color: isDark ? '#94a3b8' : '#64748b' }]}>{text}</Text>
  </View>
);

const ExpandRow = ({ label, value, isDark, flex }) => (
  <View style={flex ? { flex: 1 } : {}}>
    <Text style={[styles.expandLabel, { color: isDark ? '#334155' : '#94a3b8' }]}>{label.toUpperCase()}</Text>
    <Text style={[styles.expandValue, { color: isDark ? '#cbd5e1' : '#374151' }]}>{value}</Text>
  </View>
);

/* ─── Styles ─── */
const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  accentBar: {
    height: 3,
    backgroundColor: '#0f172a',
    // subtle gradient feel via a second layer would need LinearGradient; keeping solid for now
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 10,
  },
  providerName: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  serviceType: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '900',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 6,
    flexWrap: 'wrap',
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  mapContainer: {
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  mapOverlayText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  reasoningBox: {
    marginHorizontal: 16,
    marginBottom: 4,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  reasoningLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.8,
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 7,
  },
  expandToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 4,
  },
  expandText: {
    fontSize: 11,
    fontWeight: '700',
  },
  expandedBox: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  expandLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  expandValue: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  footer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    alignItems: 'stretch',
  },
  footerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  footerBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
  bookBtn: {
    flex: 1.4,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 8,
    borderRadius: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  bookBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  bookBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});

export default ChatProviderCard;