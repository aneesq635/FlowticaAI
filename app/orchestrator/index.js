import React, { useState } from 'react';
import { View, StyleSheet, useWindowDimensions, TouchableOpacity, Text } from 'react-native';
import Sidebar from '../../components/Sidebar';
import ChatPanel from '../chat/ChatPanel';
import OrchestrationPanel from '../../components/orchestration/OrchestrationPanel';
import { LayoutPanelLeft, ChevronRight, ChevronLeft } from 'lucide-react-native';
import { MotiView, AnimatePresence as MotiAnimatePresence } from 'moti';
import { useSelector, useDispatch } from 'react-redux';
import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { setActiveConversation, setMessages } from '../../store/chatSlice';
import { hydrateState } from '../../store/orchestrationSlice';

const AnimatePresence = MotiAnimatePresence;

export default function OrchestratorDashboard() {
  const { id } = useLocalSearchParams();
  const dispatch = useDispatch();
  const { width } = useWindowDimensions();
  const [isOrchestrationExpanded, setIsOrchestrationExpanded] = useState(width > 1200);

  useEffect(() => {
    const hydrate = async () => {
      if (id) {
        dispatch(setActiveConversation(id));
        try {
          const res = await fetch(`http://192.168.0.102:5000/conversations/${id}/context`);
          const data = await res.json();
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
    <View style={styles.container}>
      {/* Main Content Area */}
      <View style={styles.mainContent}>
        <View style={styles.header}>
          <View style={{ flex: 1 }} />
          <TouchableOpacity 
            style={styles.expandButton}
            onPress={() => setIsOrchestrationExpanded(!isOrchestrationExpanded)}
          >
            <Text style={styles.expandButtonText}>
              {isOrchestrationExpanded ? 'HIDE ENGINE' : 'SHOW ENGINE'}
            </Text>
            {isOrchestrationExpanded ? (
              <ChevronRight size={16} color="#3b82f6" />
            ) : (
              <ChevronLeft size={16} color="#3b82f6" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.contentRow}>
          <AnimatePresence>
            {isChatVisible && (
              <MotiView 
                from={{ width: 0, opacity: 0 }}
                animate={{ width: isOrchestrationExpanded && isDesktop ? '60%' : '100%', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                style={styles.chatWrapper}
              >
                <ChatPanel />
              </MotiView>
            )}
          </AnimatePresence>

          {/* Orchestration Panel (Expandable) */}
          <AnimatePresence>
            {isOrchestrationExpanded && (
              <MotiView
                from={{ width: 0, opacity: 0 }}
                animate={{ width: isDesktop ? 400 : width, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'timing', duration: 300 }}
                style={styles.orchestrationWrapper}
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
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#020617',
  },
  sidebarWrapper: {
    height: '100%',
  },
  mainContent: {
    flex: 1,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  expandButtonText: {
    color: '#3b82f6',
    fontSize: 11,
    fontWeight: 'bold',
    marginRight: 8,
    letterSpacing: 1,
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
  },
  chatWrapper: {
    flex: 1,
  },
  orchestrationWrapper: {
    height: '100%',
    overflow: 'hidden',
  },
});
