import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Linking, Platform } from 'react-native';
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
  Calendar
} from 'lucide-react-native';
import { useSelector } from 'react-redux';
import MiniMap from './MiniMap';

const ChatProviderCard = ({ provider, onBook }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';

  const phone = provider.phone || provider.location_data?.phone || '';
  const canCall = phone.length > 0 && phone !== "???";

  const openDialer = () => {
    if (canCall) {
      Linking.openURL(`tel:${phone}`);
    } else {
      console.warn("No valid phone number for provider:", provider.name);
    }
  };

  const openMaps = () => {
    // Phase 6: Robust Coordinate Extraction
    const coords = provider.provider_coordinates || provider.location_data || {};
    const lat = coords.latitude || (provider.coordinates && provider.coordinates[1]);
    const lng = coords.longitude || (provider.coordinates && provider.coordinates[0]);
    
    if (lat && lng) {
      const label = encodeURIComponent(provider.name || "Provider");
      const url = Platform.select({
        ios: `maps:0,0?q=${label}@${lat},${lng}`,
        android: `geo:0,0?q=${lat},${lng}(${label})`
      });
      Linking.openURL(url);
    } else {
      console.warn("Missing coordinates for map action:", provider.name);
    }
  };

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`mb-4 rounded-3xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}
    >
      {/* Header Info */}
      <View className="p-4">
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1">
            <View className="flex-row items-center">
              <Text className={`text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {provider.name}
              </Text>
              {provider.verified && (
                <View className="ml-2">
                  <ShieldCheck size={16} color="#10b981" fill={isDark ? "rgba(16,185,129,0.1)" : "transparent"} />
                </View>
              )}
            </View>
            <Text className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {provider.specialization || provider.service_type}
            </Text>
          </View>
          <View className={`px-2 py-1 rounded-full flex-row items-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <Star size={12} color="#f59e0b" fill="#f59e0b" />
            <Text className={`text-xs font-black ml-1 ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>
              {provider.rating?.toFixed(1) || "5.0"}
            </Text>
          </View>
        </View>

        {/* Stats Row */}
        <View className="flex-row items-center mb-4 gap-4">
          <View className="flex-row items-center">
            <MapPin size={14} color={isDark ? '#64748b' : '#94a3b8'} />
            <Text className={`text-xs ml-1 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {provider._distance_km && provider._distance_km < 900 ? `${provider._distance_km}km` : "???"}
            </Text>
          </View>
          <View className="flex-row items-center">
            <Clock size={14} color={isDark ? '#64748b' : '#94a3b8'} />
            <Text className={`text-xs ml-1 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              ETA: {provider.eta_minutes || "--"} mins
            </Text>
          </View>
          <View className="flex-row items-center">
            <Award size={14} color={isDark ? '#64748b' : '#94a3b8'} />
            <Text className={`text-xs ml-1 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Rs. {provider.hourly_rate || provider.priceEst}/hr
            </Text>
          </View>
          <View className="flex-row items-center">
            <CheckCircle size={14} color={isDark ? '#64748b' : '#94a3b8'} />
            <Text className={`text-xs ml-1 font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Rel: {((provider.reliability_score || 0.95) * 100).toFixed(0)}%
            </Text>
          </View>
        </View>

        {/* Map Preview (Phase 3.6 MANDATORY UI) */}
        <TouchableOpacity 
          onPress={openMaps}
          activeOpacity={0.9}
          className="mb-4 overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800"
        >
          <View pointerEvents="none">
            <MiniMap 
              latitude={provider.provider_coordinates?.latitude || provider.location_data?.latitude || 33.6844}
              longitude={provider.provider_coordinates?.longitude || provider.location_data?.longitude || 73.0479}
              height={120}
            />
          </View>
        </TouchableOpacity>

        {/* Reasoning */}
        <View className={`p-3 rounded-2xl mb-2 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
          <Text className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            AI Selection Reasoning
          </Text>
          {Array.isArray(provider.ranking_reason) ? (
            provider.ranking_reason.map((reason, idx) => (
              <View key={idx} className="flex-row items-center mb-1">
                <CheckCircle size={10} color="#10b981" />
                <Text className={`text-xs ml-2 font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  {reason}
                </Text>
              </View>
            ))
          ) : (
            <View className="flex-row items-center">
              <CheckCircle size={10} color="#10b981" />
              <Text className={`text-xs ml-2 font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                {provider.ranking_reason || "Verified match based on location and rating."}
              </Text>
            </View>
          )}
        </View>

        {/* Expand/Collapse Toggle */}
        <TouchableOpacity 
          onPress={() => setIsExpanded(!isExpanded)}
          className="flex-row items-center justify-center py-2"
        >
          <Text className={`text-xs font-bold mr-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
            {isExpanded ? "Show Less" : "Show More Details"}
          </Text>
          {isExpanded ? <ChevronUp size={14} color={isDark ? '#475569' : '#94a3b8'} /> : <ChevronDown size={14} color={isDark ? '#475569' : '#94a3b8'} />}
        </TouchableOpacity>

        {/* Expanded Content */}
        <AnimatePresence>
          {isExpanded && (
            <MotiView
              from={{ height: 0, opacity: 0 }}
              animate={{ height: isExpanded ? 'auto' : 0, opacity: isExpanded ? 1 : 0 }}
              transition={{ type: 'timing', duration: 300 }}
              style={{ overflow: 'hidden' }}
            >
              <View className={`h-[1px] w-full my-2 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
              
              <View className="space-y-4">
                <View>
                  <Text className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Experience & Skills</Text>
                  <Text className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {provider.experience || "Available upon request."}
                  </Text>
                </View>

                <View className="flex-row justify-between">
                  <View className="flex-1">
                    <Text className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Languages</Text>
                    <Text className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {provider.languages?.join(", ") || "English, Urdu"}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Completed Jobs</Text>
                    <Text className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      {provider.completed_jobs || 0} Successful Works
                    </Text>
                  </View>
                </View>
              </View>
            </MotiView>
          )}
        </AnimatePresence>
      </View>

      {/* Action Footer */}
      <View className={`flex-row border-t ${isDark ? 'border-slate-800 bg-slate-800/30' : 'border-slate-100 bg-slate-50/50'}`}>
        <TouchableOpacity 
          onPress={openDialer}
          disabled={!canCall}
          className={`flex-1 flex-row items-center justify-center py-4 border-r border-slate-100 dark:border-slate-800 ${!canCall ? 'opacity-30' : 'opacity-100'}`}
        >
          <Phone size={16} color={isDark ? (canCall ? '#94a3b8' : '#334155') : (canCall ? '#64748b' : '#cbd5e1')} />
          <Text className={`ml-2 text-xs font-black ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Call</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={openMaps}
          className="flex-1 flex-row items-center justify-center py-4 border-r border-slate-100 dark:border-slate-800"
        >
          <Navigation size={16} color={isDark ? '#94a3b8' : '#64748b'} />
          <Text className={`ml-2 text-xs font-black ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Maps</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => {
            if (onBook) {
              console.log("Initiating Booking Flow for:", provider.name);
              onBook(provider);
            }
          }}
          className="flex-1 flex-row items-center justify-center py-4 bg-slate-900 dark:bg-white"
        >
          <Calendar size={16} color={isDark ? '#fff' : '#000'} />
          <Text className={`ml-2 text-xs font-black ${isDark ? 'text-white' : 'text-black'}`}>Book</Text>
        </TouchableOpacity>
      </View>
    </MotiView>
  );
};

export default ChatProviderCard;
