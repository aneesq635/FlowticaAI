import React, { useEffect } from 'react';
import {
  View, StyleSheet, useWindowDimensions, TouchableOpacity, Text
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useLocalSearchParams } from 'expo-router';
import { MotiView, AnimatePresence } from 'moti';
import { Cpu, X } from 'lucide-react-native';

import ChatPanel from '../chat/ChatPanel';
import OrchestrationPanel from '../../../components/orchestration/OrchestrationPanel';
import {
  setEngineExpanded,
  hydrateState,
  setChatVisibility,
} from '../../../store/orchestrationSlice';
import { setActiveConversation, setMessages } from '../../../store/chatSlice';
import api from '../../../services/api';

export default function OrchestratorDashboard() {
  const { id } = useLocalSearchParams();
  const dispatch = useDispatch();
  const { width } = useWindowDimensions();

  const isDark = useSelector(s => s.orchestration.theme) === 'dark';
  const isEngineExpanded = useSelector(s => s.orchestration.isEngineExpanded);
  const isChatVisible = useSelector(s => s.orchestration.isChatVisible);

  const isDesktop = width > 1024;

  // ── Layout logic ──────────────────────────────────────────
  // On mobile, if engine is expanded, we usually hide the chat
  // to avoid horizontal overflow issues.
  useEffect(() => {
    if (!isDesktop && isEngineExpanded) {
      dispatch(setChatVisibility(false));
    } else {
      dispatch(setChatVisibility(true));
    }
  }, [isEngineExpanded, isDesktop]);

  // ── Hydrate conversation state on mount ──────────────────
  useEffect(() => {
    if (!id) return;
    dispatch(setActiveConversation(id));

    const hydrate = async () => {
      try {
        const data = await api.get(`/conversations/${id}/context`);
        if (data?.success) {
          dispatch(hydrateState(data.context));
          dispatch(setMessages({ conversationId: id, messages: data.context.messages }));
        }
      } catch (err) {
        console.error('[HYDRATE]', err);
      }
    };
    hydrate();
  }, [id]);

  // ── Auto-expand engine on large screens ──────────────────
  useEffect(() => {
    if (width > 1400) dispatch(setEngineExpanded(true));
  }, [width]);

  return (
    <View
      style={[styles.root, { backgroundColor: isDark ? '#020617' : '#f8fafc' }]}
    >
      {/* ── Chat panel ── */}
      <AnimatePresence>
        {isChatVisible && (
          <MotiView
            key="chat"
            from={{ opacity: 0 }}
            animate={{
              opacity: 1,
              flex: isEngineExpanded && isDesktop ? 0.6 : 1,
            }}
            exit={{ opacity: 0 }}
            transition={{ type: 'timing', duration: 250 }}
            style={styles.chatContainer}
          >
            <ChatPanel />
          </MotiView>
        )}
      </AnimatePresence>

      {/* ── Engine panel ── */}
      <AnimatePresence>
        {isEngineExpanded && (
          <MotiView
            key="engine"
            from={{ translateX: width, opacity: 0 }}
            animate={{ translateX: 0, opacity: 1 }}
            exit={{ translateX: width, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            style={[
              styles.engineContainer,
              {
                width: isDesktop ? 720 : width,
                position: isDesktop ? 'relative' : 'absolute',
                right: 0,
                zIndex: 100,
                borderLeftColor: isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0',
                backgroundColor: isDark ? '#020617' : '#ffffff',
              },
            ]}
          >
            {/* Close button for mobile */}
            {!isDesktop && (
              <TouchableOpacity
                onPress={() => dispatch(setEngineExpanded(false))}
                className="absolute top-12 right-6 z-50 w-10 h-10 rounded-full bg-white/10 items-center justify-center border border-white/20"
              >
                <X size={20} color="#fff" />
              </TouchableOpacity>
            )}
            <OrchestrationPanel />
          </MotiView>
        )}
      </AnimatePresence>

      {/* Floating Toggle Button (if engine hidden) */}
      {!isEngineExpanded && (
        <MotiView
          from={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute bottom-32 right-6 z-50"
        >
          <TouchableOpacity
            onPress={() => dispatch(setEngineExpanded(true))}
            className="w-14 h-14 rounded-2xl bg-white items-center justify-center shadow-2xl"
          >
            <Cpu size={24} color="#0f172a" strokeWidth={2.5} />
          </TouchableOpacity>
        </MotiView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  chatContainer: {
    height: '100%',
  },
  engineContainer: {
    height: '100%',
    borderLeftWidth: 1,
  },
});
