import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { MotiView, AnimatePresence } from 'moti';
import { Send, Paperclip, Bot, User, Activity, ChevronDown, ChevronUp, Sparkles, Mic } from 'lucide-react-native';
import socketService from '../../../services/socket';
import api from '../../../services/api';
import { addMessage } from '../../../store/chatSlice';
import { Typography } from '../../../components/ui/Typography';
import { Card } from '../../../components/ui/Card';
import LiveVoiceAssistant from '../../../components/orchestration/LiveVoiceAssistant';
import { startVoiceSession } from '../../../store/liveAgentSlice';
import { Keyboard } from 'react-native';
import ChatProviderCard from '../../../components/ChatProviderCard';
import BookingModal from '../../../components/BookingModal';
import MiniMap from '../../../components/MiniMap';
import { useAuth } from '../../../components/AuthContext';
import { Phone, CheckCircle, DollarSign, XCircle, Clock as ClockIcon, MapPin, Linking } from 'lucide-react-native';
import { Alert } from 'react-native';

// ─────────────────────────────────────────────────────────
// REPLACE your entire ChatMessage component with this
// ─────────────────────────────────────────────────────────

const ChatMessage = ({ message, onBook, onRespondToCounter }) => {
  const isUser = message.role === 'user';
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';

  const hasProviders = !isUser && message.providers && message.providers.length > 0;

  return (
    // ── OUTER WRAPPER: full width, no maxWidth constraint ──
    <MotiView
      from={{ opacity: 0, translateY: 15, scale: 0.98 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: 'timing', duration: 400 }}
      style={{ marginBottom: 20, width: '100%' }}
    >
      {/* ── BUBBLE ROW (text message only) ── */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          // If this message has provider cards below, constrain bubble width normally
          // Otherwise allow full width feel
        }}
      >
        {/* Bot Avatar */}
        {!isUser && (
          <View style={{
            width: 32, height: 32, borderRadius: 16,
            alignItems: 'center', justifyContent: 'center',
            marginRight: 8, marginTop: 4, flexShrink: 0,
            backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
          }}>
            <Bot size={16} color={isDark ? '#64748b' : '#94a3b8'} />
          </View>
        )}

        {/* Bubble — only text + meta, NO cards inside */}
        <View style={{
          maxWidth: '82%',
          padding: 14,
          borderRadius: 22,
          borderTopRightRadius: isUser ? 4 : 22,
          borderTopLeftRadius: isUser ? 22 : 4,
          backgroundColor: isUser
            ? (isDark ? '#1e293b' : '#0f172a')
            : (isDark ? '#0f172a' : '#ffffff'),
          borderWidth: isUser ? 0 : 1,
          borderColor: isDark ? '#1e293b' : '#f1f5f9',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: isDark ? 0.2 : 0.06,
          shadowRadius: 8,
          elevation: 2,
        }}>
          <Text style={{
            fontSize: 14, lineHeight: 21,
            color: isUser ? '#ffffff' : (isDark ? '#e2e8f0' : '#1e293b'),
          }}>
            {message.content}
          </Text>

          {message.agent && (
            <View style={{
              flexDirection: 'row', alignItems: 'center',
              marginTop: 10, paddingHorizontal: 8, paddingVertical: 4,
              borderRadius: 6,
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc',
            }}>
              <Sparkles size={10} color={isDark ? '#64748b' : '#94a3b8'} />
              <Text style={{ fontSize: 11, marginLeft: 6, color: isDark ? '#94a3b8' : '#64748b', fontWeight: '700' }}>
                {message.agent}
              </Text>
            </View>
          )}

          {/* Counter Offer Card — stays inside bubble (it's a reply card) */}
          {message.type === 'counter_offer' && (
            <View style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 18,
              backgroundColor: isDark ? 'rgba(249,115,22,0.08)' : '#fff7ed',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(249,115,22,0.2)' : '#fed7aa',
            }}>
              <Text style={{ fontSize: 9, fontWeight: '900', letterSpacing: 1.5, color: isDark ? '#fb923c' : '#c2410c', marginBottom: 4 }}>
                NEW COUNTER OFFER
              </Text>
              <Text style={{ fontSize: 18, fontWeight: '900', color: isDark ? '#fff' : '#0f172a', marginBottom: 8 }}>
                {message.counter_price} PKR
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <ClockIcon size={12} color={isDark ? '#f97316' : '#ea580c'} />
                <Text style={{ fontSize: 11, marginLeft: 6, fontWeight: '700', color: isDark ? '#cbd5e1' : '#475569' }}>
                  {message.counter_date} at {message.counter_time}
                </Text>
              </View>
              {message.status === 'countered' ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => onRespondToCounter(message.request_id, 'accepted')}
                    style={{ flex: 1, backgroundColor: '#0f172a', paddingVertical: 11, borderRadius: 14, alignItems: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onRespondToCounter(message.request_id, 'rejected')}
                    style={{
                      flex: 1, paddingVertical: 11, borderRadius: 14, alignItems: 'center',
                      backgroundColor: isDark ? '#1e293b' : '#fff',
                      borderWidth: 1, borderColor: isDark ? '#334155' : '#e2e8f0',
                    }}
                  >
                    <Text style={{ fontWeight: '900', fontSize: 12, color: isDark ? '#cbd5e1' : '#374151' }}>Decline</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ paddingVertical: 6, alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 1, color: '#64748b' }}>
                    RESPONSE SENT: {message.status?.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Booking Confirmation — stays inside bubble */}
          {message.type === 'booking_confirmation' && (
            <View style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 18,
              backgroundColor: isDark ? 'rgba(16,185,129,0.08)' : '#f0fdf4',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(16,185,129,0.2)' : '#bbf7d0',
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View>
                  <Text style={{ fontSize: 9, fontWeight: '900', letterSpacing: 1.5, color: '#10b981', marginBottom: 2 }}>BOOKING CONFIRMED</Text>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: isDark ? '#fff' : '#0f172a' }}>{message.service_type}</Text>
                </View>
                <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle size={20} color="#fff" />
                </View>
              </View>
              <View style={{ padding: 10, borderRadius: 12, backgroundColor: isDark ? '#1e293b' : '#fff', marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <ClockIcon size={13} color="#64748b" />
                  <Text style={{ fontSize: 12, marginLeft: 6, fontWeight: '700', color: isDark ? '#cbd5e1' : '#475569' }}>
                    {message.date} at {message.time}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <DollarSign size={13} color="#64748b" />
                  <Text style={{ fontSize: 12, marginLeft: 6, fontWeight: '700', color: isDark ? '#cbd5e1' : '#475569' }}>
                    {message.price} PKR
                  </Text>
                </View>
              </View>
              {message.location_data && (
                <TouchableOpacity
                  onPress={() => {
                    const { latitude, longitude } = message.location_data;
                    const url = Platform.select({
                      ios: `maps:0,0?q=Booking@${latitude},${longitude}`,
                      android: `geo:0,0?q=${latitude},${longitude}(Booking)`,
                    });
                    Linking.openURL(url);
                  }}
                  style={{ borderRadius: 14, overflow: 'hidden' }}
                >
                  <MiniMap
                    latitude={message.location_data.latitude}
                    longitude={message.location_data.longitude}
                    address={message.location}
                    height={90}
                  />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* User Avatar */}
        {isUser && (
          <View style={{
            width: 32, height: 32, borderRadius: 16,
            alignItems: 'center', justifyContent: 'center',
            marginLeft: 8, marginTop: 4, flexShrink: 0,
            backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
          }}>
            <User size={16} color={isDark ? '#ffffff' : '#000000'} />
          </View>
        )}
      </View>

      {/* ── PROVIDER CARDS — rendered OUTSIDE bubble, full width ── */}
      {hasProviders && (
        <View style={{ marginTop: 14, paddingLeft: 0, width: '100%' }}>
          {message.providers.slice(0, 3).map((provider, idx) => (
            <ChatProviderCard
              key={provider._id || idx}
              provider={provider}
              onBook={onBook}
              index={idx}
            />
          ))}
        </View>
      )}
    </MotiView>
  );
};
const OrchestrationStatus = () => {
  const dispatch = useDispatch();
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';
  const orchestrationState = useSelector(state => state.orchestration.activeState);

  if (!orchestrationState) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => dispatch(setEngineExpanded(true))}
    >
      <MotiView
        from={{ height: 0, opacity: 0 }}
        animate={{ height: 52, opacity: 1 }}
        className={`px-5 flex-row items-center justify-between border-b ${isDark ? 'bg-slate-950 border-slate-900' : 'bg-slate-50 border-slate-200'}`}
      >
        <View className="flex-row items-center">
          <MotiView
            from={{ opacity: 0.4 }}
            animate={{ opacity: 1 }}
            transition={{ loop: true, type: 'timing', duration: 1000 }}
            className={`w-2 h-2 rounded-full mr-3 ${isDark ? 'bg-emerald-500' : 'bg-emerald-400'}`}
          />
          <Text className={`text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {orchestrationState.toUpperCase()} ACTIVE
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className={`text-[9px] font-black tracking-widest ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
            SHOW ENGINE
          </Text>
          <Activity size={12} color={isDark ? '#475569' : '#94a3b8'} strokeWidth={3} />
        </View>
      </MotiView>
    </TouchableOpacity>
  );
};

const ChatPanel = () => {
  const [input, setInput] = useState('');
  const [isOrchPanelOpen, setIsOrchPanelOpen] = useState(false);
  const scrollViewRef = useRef();
  const activeConversationId = useSelector(state => state.chat.activeConversationId);
  const conversations = useSelector(state => state.chat.conversations);
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';
  const isVoiceActive = useSelector(state => state.liveAgent.isVoiceSessionActive);

  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const { user } = useAuth();

  const messages = useMemo(() => {
    const conv = conversations.find(c => (c.id === activeConversationId || c._id === activeConversationId));
    return conv?.messages || [];
  }, [conversations, activeConversationId]);

  const dispatch = useDispatch();
  const [keyboardHeight, setKeyboardHeight] = React.useState(0);
  React.useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', e => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    // Phase 6.9: Real-time Socket Sync (Requirement 6)
    const socket = socketService.socket;
    if (socket) {
      const handleStatusUpdate = (data) => {
        console.log("[CHAT PANEL] Request status updated in real-time:", data);
        // We could re-fetch conversation here or update local state
        // For now, let's just log. Redux chatSlice might already handle incoming status messages.
      };
      socket.on('request_status_updated', handleStatusUpdate);
      return () => socket.off('request_status_updated', handleStatusUpdate);
    }
  }, []);

  const handleRespondToCounter = async (requestId, action) => {
    try {
      const data = await api.post('/api/bookings/counter/respond', { request_id: requestId, action });
      if (data.success) {
        Alert.alert("Success", `Counter-offer ${action}.`);
      } else {
        Alert.alert("Error", data.error || "Failed to respond.");
      }
    } catch (e) {
      Alert.alert("Error", "Could not reach server.");
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollViewRef.current) {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [messages]);

  const handleBookProvider = (provider) => {
    setSelectedProvider(provider);
    setBookingModalVisible(true);
  };

  const handleSend = () => {
    console.log(`\n[CHAT PANEL] Send button clicked.`);
    console.log(`[CHAT PANEL] Input Text: "${input}"`);
    console.log(`[CHAT PANEL] Active Conversation ID: ${activeConversationId}`);

    if (!input.trim()) {
      console.warn('[CHAT PANEL WARNING] Input is empty, ignoring send.');
      return;
    }
    if (!activeConversationId) {
      console.error('[CHAT PANEL ERROR] Active Conversation ID is null/missing! Cannot send.');
      return;
    }

    try {
      const userMessage = { role: 'user', content: input.trim() };
      console.log('[CHAT PANEL] Dispatching user message to Redux store:', JSON.stringify(userMessage));
      dispatch(addMessage({ conversationId: activeConversationId, message: userMessage }));

      console.log('[CHAT PANEL] Handing over message transmission to socketService...');
      socketService.sendMessage(input.trim(), activeConversationId);

      console.log('[CHAT PANEL] Clearing message input field.');
      setInput('');
    } catch (err) {
      console.error('[CHAT PANEL ERROR] Exception inside handleSend:', err);
    }
  };


  // const isDark = useSelector(state => state.orchestration.theme) === 'dark';
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}  // ← KEY FIX: was just "padding"
      className="flex-1"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <OrchestrationStatus />

      <ScrollView
        ref={scrollViewRef}
        className={`flex-1 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}
        contentContainerStyle={{ padding: 24, paddingBottom: 40 }}  // ← remove 220, was too much
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
      >
        <AnimatePresence>
          {messages.length === 0 ? (
            <MotiView
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="items-center justify-center pt-20"
            >
              <View className={`w-20 h-20  rounded-[30px] items-center justify-center mb-6 shadow-2xl shadow-blue-500/50 ${isDark ? 'bg-slate-800' : 'bg-black'}`}>
                <Bot size={40} color="#fff" />
              </View>
              <Typography variant="h3" className="text-center mb-2">How can I help you today?</Typography>
              <Typography variant="body" className="text-center opacity-60 px-10">
                Ask for any service (AC repair, Cleaning, etc.) and I'll orchestrate the entire process for you.
              </Typography>
            </MotiView>
          ) : (
            messages.map((msg, index) => (
              <ChatMessage
                key={msg.id || index}
                message={msg}
                onBook={handleBookProvider}
                onRespondToCounter={handleRespondToCounter}
              />
            ))
          )}
        </AnimatePresence>
      </ScrollView>

      {/* Input Area */}
      <View
        className={`px-4 border-t ${isDark ? 'bg-slate-950 border-slate-900' : 'bg-white border-slate-100'}`}
        style={{
          paddingBottom: Platform.OS === 'android' ? 12 : 28,
          paddingTop: 12,
        }}
      >
        <View className={`flex-row items-end p-2 rounded-[32px] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
          <TouchableOpacity className="p-3 mb-1">
            <Paperclip size={20} color={isDark ? '#64748b' : '#94a3b8'} />
          </TouchableOpacity>

          <TextInput
            className={`flex-1 px-3 py-4 text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}
            placeholder="Search for a service..."
            placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
            value={input}
            onChangeText={setInput}
            multiline
            maxHeight={120}
          />

          {/* Voice Activation Toggle */}
          <TouchableOpacity
            onPress={() => {
              if (activeConversationId) {
                dispatch(startVoiceSession());
              }
            }}
            disabled={!activeConversationId}
            className={`w-12 h-12 rounded-full items-center justify-center mb-1 mr-2 ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-slate-100 border border-slate-200'}`}
          >
            <Mic size={18} color="#10b981" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSend}
            disabled={!input.trim() || !activeConversationId}
            className={`w-12 h-12 rounded-full items-center justify-center mb-1 ${input.trim()
              ? (isDark ? 'bg-slate-700' : 'bg-slate-900')
              : (isDark ? 'bg-slate-800' : 'bg-slate-200')
              }`}
          >
            <Send size={18} color={input.trim() ? '#fff' : (isDark ? '#334155' : '#cbd5e1')} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Glassmorphic Realtime Voice Assistant Overlay */}
      {isVoiceActive && (
        <LiveVoiceAssistant
          conversationId={activeConversationId}
          userId="customer"
          socketioSid={socketService.socket?.id}
          onClose={() => {
            console.log('[CHAT PANEL] LiveVoiceAssistant overlay dismissed.');
          }}
        />
      )}
      {/* Booking Modal (Phase 4) */}
      <BookingModal
        visible={bookingModalVisible}
        onClose={() => setBookingModalVisible(false)}
        provider={selectedProvider}
        customer_id={user?.id}
        conversation_id={activeConversationId}
      />
    </KeyboardAvoidingView>
  );
};

export default ChatPanel;
