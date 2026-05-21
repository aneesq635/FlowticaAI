import React, { useState } from 'react';
import { View, StyleSheet, useWindowDimensions, TouchableOpacity, Text } from 'react-native';
import Sidebar from '../../../components/Sidebar';
import ChatPanel from '../chat/ChatPanel';
import OrchestrationPanel from '../../../components/orchestration/OrchestrationPanel';
import { LayoutPanelLeft, ChevronRight, ChevronLeft } from 'lucide-react-native';
import { MotiView, AnimatePresence } from 'moti';
import { useSelector, useDispatch } from 'react-redux';
import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { setActiveConversation, setMessages } from '../../../store/chatSlice';
import { hydrateState, setChatVisibility } from '../../../store/orchestrationSlice';
import api from '../../../services/api';

export default function OrchestratorDashboard() {
  const { id } = useLocalSearchParams();
  const dispatch = useDispatch();
  const { width } = useWindowDimensions();
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';
  const { isEngineExpanded, isChatVisible } = useSelector(state => state.orchestration);

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

  useEffect(() => {
    // Auto-expand on large screens if not already interaction-driven
    if (width > 1200) {
      dispatch(setEngineExpanded(true));
    }
  }, [width, dispatch]);

  const isDesktop = width > 1024;

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#020617' : '#f8fafc' }]}>
      <View style={styles.mainContent}>
        <View style={styles.workspace}>
          <AnimatePresence>
            {isChatVisible && (
              <MotiView
                animate={{
                  flex: isEngineExpanded && isDesktop ? 0.6 : 1,
                  opacity: 1
                }}
                style={styles.chatContainer}
              >
                <ChatPanel />
              </MotiView>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isEngineExpanded && (
              <MotiView
                from={{ width: 0, opacity: 0 }}
                animate={{
                  width: isDesktop ? 480 : width,
                  opacity: 1
                }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'timing', duration: 300 }}
                style={[
                  styles.engineContainer,
                  { borderLeftColor: isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0' }
                ]}
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
  },
  workspace: {
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

