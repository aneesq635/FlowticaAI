import React, { useState } from 'react';
import { View, StyleSheet, useWindowDimensions, TouchableOpacity, Text } from 'react-native';
import Sidebar from '../../../components/Sidebar';
import ChatPanel from '../chat/ChatPanel';
import OrchestrationPanel from '../../../components/orchestration/OrchestrationPanel';
import { LayoutPanelLeft, ChevronRight, ChevronLeft } from 'lucide-react-native';
import { MotiView, AnimatePresence as MotiAnimatePresence } from 'moti';
import { useSelector, useDispatch } from 'react-redux';
import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { setActiveConversation, setMessages } from '../../../store/chatSlice';
import { hydrateState } from '../../../store/orchestrationSlice';
import api from '../../../services/api';

const AnimatePresence = MotiAnimatePresence;

export default function OrchestratorDashboard() {
  const { id } = useLocalSearchParams();
  const dispatch = useDispatch();
  const { width } = useWindowDimensions();
  const [isOrchestrationExpanded, setIsOrchestrationExpanded] = useState(width > 1200);
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';

  useEffect(() => {
    const hydrate = async () => {
      if (id) {
        dispatch(setActiveConversation(id));
        try {
          const data = await api.get(`/conversations/${id}/context`);
          if (data.success) {
            dispatch(hydrateState(data.context));
            dispatch(setMessages({ conversationId: id, messages: data.context.messages }));
          }
        } catch (err) {
          console.error("Hydration Error:", err);
        }
      }
    };
    hydrate();
  }, [id]);

  const isDesktop = width > 1024;
  const { isChatVisible } = useSelector(state => state.orchestration);

 return (
  <View className={`flex-1 flex-row ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
    <View className="flex-1">

      {/* Header */}
      <View className={`h-14 flex-row items-center justify-end px-5 border-b ${isDark ? 'border-slate-900' : 'border-slate-200'}`}>
        <TouchableOpacity
          onPress={() => setIsOrchestrationExpanded(!isOrchestrationExpanded)}
          className={`flex-row items-center px-3 py-1.5 rounded-xl border ${
            isOrchestrationExpanded
              ? (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-950 border-slate-800')
              : (isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200')
          }`}
        >
          <Text className={`text-xs font-black tracking-widest mr-2 ${
            isOrchestrationExpanded
              ? 'text-white'
              : (isDark ? 'text-slate-400' : 'text-slate-500')
          }`}>
            {isOrchestrationExpanded ? 'HIDE ENGINE' : 'SHOW ENGINE'}
          </Text>
          {isOrchestrationExpanded
            ? <ChevronRight size={14} color="#fff" />
            : <ChevronLeft size={14} color={isDark ? '#64748b' : '#94a3b8'} />
          }
        </TouchableOpacity>
      </View>

      {/* Content Row */}
      <View className="flex-1 flex-row">
        <AnimatePresence>
          {isChatVisible && (
            <MotiView
              from={{ opacity: 0 }}
              animate={{ width: isOrchestrationExpanded && isDesktop ? '60%' : '100%', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              style={{ flex: isOrchestrationExpanded && isDesktop ? 0 : 1 }}
            >
              <ChatPanel />
            </MotiView>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isOrchestrationExpanded && (
            <MotiView
              from={{ width: 0, opacity: 0 }}
              animate={{ width: isDesktop ? 400 : width, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'timing', duration: 300 }}
              className={`h-full border-l ${isDark ? 'border-slate-900' : 'border-slate-200'}`}
            >
              <OrchestrationPanel />
            </MotiView>
          )}
        </AnimatePresence>
      </View>
    </View>
  </View>
);
}

