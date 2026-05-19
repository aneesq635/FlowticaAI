import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { MotiView, AnimatePresence } from 'moti';
import { Send, Paperclip, Bot, User, Activity, ChevronDown, ChevronUp, Sparkles, Mic } from 'lucide-react-native';
import socketService from '../../../services/socket';
import { addMessage } from '../../../store/chatSlice';
import { Typography } from '../../../components/ui/Typography';
import { Card } from '../../../components/ui/Card';
import LiveVoiceAssistant from '../../../components/orchestration/LiveVoiceAssistant';
import { startVoiceSession } from '../../../store/liveAgentSlice';
import {  Keyboard } from 'react-native';

const ChatMessage = ({ message }) => {
  const isUser = message.role === 'user';
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';

  return (
    <MotiView
      from={{ opacity: 0, translateY: 15, scale: 0.98 }}
      animate={{ opacity: 1, translateY: 0, scale: 1 }}
      transition={{ type: 'timing', duration: 400 }}
      className={`mb-6 max-w-[85%] ${isUser ? 'self-end' : 'self-start'}`}
    >
      {/* items-start — avatar top pe rahega chahe message kitna bhi lamba ho */}
      <View className={`flex-row ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start`}>
        
        {/* Bot Avatar */}
        {!isUser && (
          <View className={`w-8 h-8 rounded-full items-center justify-center mr-2 mt-1 shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <Bot size={16} color={isDark ? '#64748b' : '#94a3b8'} />
          </View>
        )}

        {/* Bubble */}
        <View className={`
          p-4 rounded-[24px]
          ${isUser
            ? (isDark
                ? 'bg-slate-800 border border-slate-700 rounded-tr-sm'
                : 'bg-slate-900 rounded-tr-sm')
            : (isDark
                ? 'bg-slate-900 border border-slate-800 rounded-tl-sm'
                : 'bg-white border border-slate-100 rounded-tl-sm')
          }
        `}>
          <Text className={`text-sm leading-5 ${isUser ? 'text-white' : (isDark ? 'text-slate-200' : 'text-slate-800')}`}>
            {message.content}
          </Text>

          {message.agent && (
            <View className={`flex-row items-center mt-3 px-2 py-1 rounded-md ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
              <Sparkles size={10} color={isDark ? '#64748b' : '#94a3b8'} />
              <Text className={`text-xs ml-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {message.agent}
              </Text>
            </View>
          )}
        </View>

        {/* User Avatar */}
        {isUser && (
          <View className={`w-8 h-8 rounded-full items-center justify-center ml-2 mt-1 shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
            <User size={16} color={isDark ? '#fff' : '#000'} />
          </View>
        )}
      </View>
    </MotiView>
  );
};
const OrchestrationStatus = () => {
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';
  const orchestrationState = useSelector(state => state.orchestration.activeState);
  
  if (!orchestrationState) return null;

  return (
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
        className={`w-2 h-2 rounded-full mr-3 ${isDark ? 'bg-slate-500' : 'bg-slate-400'}`}
      />
      <Text className={`text-xs font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
        Agentic Orchestration Active
      </Text>
    </View>
    <View className="flex-row items-center">
      <Activity size={14} color={isDark ? '#475569' : '#94a3b8'} strokeWidth={2.5} />
      <Text className={`text-xs ml-2 font-black ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
        {orchestrationState.toUpperCase()}
      </Text>
    </View>
  </MotiView>
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
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current.scrollToEnd({ animated: true });
      }, 150);
    }
  }, [messages]);

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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  className="flex-1"
  keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <OrchestrationStatus />

      <ScrollView
       ref={scrollViewRef}
  className={`flex-1 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}
 contentContainerStyle={{ padding: 24, paddingBottom: 160 }}
  showsVerticalScrollIndicator={false}
  keyboardShouldPersistTaps="handled"
      >
        <AnimatePresence>
          {messages.length === 0 ? (
            <MotiView
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="items-center justify-center pt-20"
            >
              <View className={`w-20 h-20  rounded-[30px] items-center justify-center mb-6 shadow-2xl shadow-blue-500/50 ${isDark? 'bg-slate-800' : 'bg-black'}`}>
                <Bot size={40} color="#fff" />
              </View>
              <Typography variant="h3" className="text-center mb-2">How can I help you today?</Typography>
              <Typography variant="body" className="text-center opacity-60 px-10">
                Ask for any service (AC repair, Cleaning, etc.) and I'll orchestrate the entire process for you.
              </Typography>
            </MotiView>
          ) : (
            messages.map((msg, index) => (
              <ChatMessage key={msg.id || index} message={msg} />
            ))
          )}
        </AnimatePresence>
      </ScrollView>

      {/* Input Area */}
      <View 
  className={`px-4 border-t ${isDark ? 'bg-slate-950 border-slate-900' : 'bg-white border-slate-100'}`}
  style={{ 
    paddingBottom: Platform.OS === 'android' ? 16 : 28, 
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
  className={`w-12 h-12 rounded-full items-center justify-center mb-1 ${
    input.trim()
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
    </KeyboardAvoidingView>
  );
};

export default ChatPanel;
