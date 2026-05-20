import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { MotiView, AnimatePresence } from 'moti';
import { Mic, MicOff, PhoneOff, Keyboard, AlertCircle, Radio } from 'lucide-react-native';
import geminiLiveManager from '../../services/geminiLiveManager';
import { toggleMute } from '../../store/liveAgentSlice';

const LiveVoiceAssistant = ({ conversationId, userId, socketioSid, onClose }) => {
  const dispatch = useDispatch();
  const state = useSelector(state => state.liveAgent);
  const {
    isVoiceSessionActive,
    connectionStatus,
    isMuted,
    isSpeaking,
    isListening,
    liveTranscript,
    assistantTranscript,
    waveformLevels,
    error,
  } = state;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const captionScrollRef = useRef(null);

  // Fade-in entry animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 350,
      useNativeDriver: true,
    }).start();

    // Start voice session using geminiLiveManager
    geminiLiveManager.startSession(conversationId, userId, socketioSid);

    return () => {
      // Clean up session on unmount
      geminiLiveManager.stopSession();
    };
  }, []);

  // Auto-scroll subtitles to the bottom as conversation develops
  useEffect(() => {
    if (captionScrollRef.current) {
      setTimeout(() => {
        captionScrollRef.current.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [liveTranscript, assistantTranscript]);

  const handleToggleMute = () => {
    dispatch(toggleMute());
    const nextMuteState = !isMuted;
    geminiLiveManager.toggleMute(nextMuteState);
  };

  const handleDisconnect = () => {
    // Fade out and close
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      geminiLiveManager.stopSession();
      if (onClose) onClose();
    });
  };

  // Resolve orb colors based on current connection & speaking activity
  const getOrbColors = () => {
    if (error || connectionStatus === 'error') {
      return {
        glow: 'rgba(239, 68, 68, 0.4)',
        core: '#ef4444',
        border: 'rgba(239, 68, 68, 0.2)',
        status: 'Error Connecting',
      };
    }
    if (connectionStatus === 'connecting') {
      return {
        glow: 'rgba(245, 158, 11, 0.4)',
        core: '#f59e0b',
        border: 'rgba(245, 158, 11, 0.2)',
        status: 'Connecting...',
      };
    }
    if (isMuted) {
      return {
        glow: 'rgba(100, 116, 139, 0.3)',
        core: '#64748b',
        border: 'rgba(100, 116, 139, 0.2)',
        status: 'Microphone Muted',
      };
    }
    if (isSpeaking) {
      return {
        glow: 'rgba(139, 92, 246, 0.4)',
        core: '#8b5cf6',
        border: 'rgba(139, 92, 246, 0.2)',
        status: 'Speaking',
      };
    }
    if (isListening) {
      return {
        glow: 'rgba(16, 185, 129, 0.4)',
        core: '#10b981',
        border: 'rgba(16, 185, 129, 0.2)',
        status: 'Listening',
      };
    }
    
    // Fallback/Thinking/Idle
    return {
      glow: 'rgba(245, 158, 11, 0.3)',
      core: '#f59e0b',
      border: 'rgba(245, 158, 11, 0.1)',
      status: 'Syncing...',
    };
  };

  const orbStyle = getOrbColors();

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
      {/* Background radial gradient indicator */}
      <View style={[styles.backgroundGlow, { backgroundColor: orbStyle.glow }]} />

      {/* Header Info */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Radio size={16} color={orbStyle.core} style={styles.liveIndicatorIcon} />
          <Text style={styles.headerTitle}>FLOWTICA LIVE GATEWAY</Text>
        </View>
        <Text style={[styles.connectionText, { color: orbStyle.core }]}>
          {orbStyle.status.toUpperCase()}
        </Text>
      </View>

      {/* Realtime Dual Captions Window */}
      <View style={styles.captionsContainer}>
        <ScrollView 
          ref={captionScrollRef}
          contentContainerStyle={styles.captionsScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.captionsList}>
            {/* User transcript card */}
            {liveTranscript ? (
              <MotiView 
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                style={styles.userBubble}
              >
                <Text style={styles.bubbleSpeaker}>YOU</Text>
                <Text style={styles.userText}>{liveTranscript}</Text>
              </MotiView>
            ) : null}

            {/* Assistant transcript card */}
            {assistantTranscript ? (
              <MotiView 
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                style={styles.assistantBubble}
              >
                <Text style={styles.bubbleSpeaker}>FLOWTICA AI (Puck Voice)</Text>
                <Text style={styles.assistantText}>{assistantTranscript}</Text>
              </MotiView>
            ) : (
              !liveTranscript && connectionStatus === 'connected' && (
                <View style={styles.waitingContainer}>
                  <Text style={styles.waitingText}>Say something, I'm listening...</Text>
                </View>
              )
            )}
          </View>
        </ScrollView>
      </View>

      {/* Waveform Visualizer */}
      <View style={styles.visualizerContainer}>
        <View style={styles.waveform}>
          {waveformLevels.map((val, idx) => (
            <MotiView
              key={idx}
              animate={{
                height: Math.max(4, val * 1.5),
                backgroundColor: orbStyle.core,
              }}
              transition={{
                type: 'timing',
                duration: 100,
              }}
              style={styles.waveformBar}
            />
          ))}
        </View>
      </View>

      {/* Main Multi-Layer Animated Orb */}
      <View style={styles.orbWrapper}>
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={() => {
            if (isSpeaking) {
              // Tap the orb during voice response to interrupt/barge-in
              geminiLiveManager.handleInterruption();
            }
          }}
          style={styles.orbTouchZone}
        >
          {/* Inner Core */}
          <MotiView
            animate={{
              scale: isSpeaking ? [1, 1.15, 1] : isListening ? [1, 1.08, 1] : 1,
            }}
            transition={{
              loop: true,
              duration: isSpeaking ? 1200 : 2500,
              type: 'timing',
            }}
            style={[styles.orbCore, { backgroundColor: orbStyle.core }]}
          />
          
          {/* Mid Layer Glow Ring */}
          <MotiView
            animate={{
              scale: isSpeaking ? [1, 1.4, 1] : isListening ? [1, 1.25, 1] : 1,
              opacity: isSpeaking ? 0.6 : 0.4,
            }}
            transition={{
              loop: true,
              duration: isSpeaking ? 1200 : 2500,
              type: 'timing',
            }}
            style={[styles.orbMiddle, { borderColor: orbStyle.core }]}
          />

          {/* Outer Ambient Breathing Wave */}
          <MotiView
            animate={{
              scale: isSpeaking ? [1, 1.8, 1] : isListening ? [1, 1.5, 1] : 1,
              opacity: isSpeaking ? 0.3 : 0.15,
            }}
            transition={{
              loop: true,
              duration: isSpeaking ? 1200 : 2500,
              type: 'timing',
            }}
            style={[styles.orbOuter, { borderColor: orbStyle.core }]}
          />
        </TouchableOpacity>
      </View>

      {/* System Error Banner */}
      {error && (
        <MotiView 
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={styles.errorBanner}
        >
          <AlertCircle size={18} color="#fca5a5" />
          <Text style={styles.errorText}>{error}</Text>
        </MotiView>
      )}

      {/* control Dashboard */}
      <View style={styles.controlsRow}>
        {/* Keyboard/Return to Text Button */}
        <TouchableOpacity 
          style={styles.controlButton} 
          onPress={handleDisconnect}
          activeOpacity={0.7}
        >
          <View style={styles.controlIconCircle}>
            <Keyboard size={22} color="#94a3b8" />
          </View>
          <Text style={styles.controlLabel}>Text Chat</Text>
        </TouchableOpacity>

        {/* Primary Disconnect Key */}
        <TouchableOpacity 
          style={[styles.controlButton, styles.endSessionButton]} 
          onPress={handleDisconnect}
          activeOpacity={0.7}
        >
          <View style={[styles.controlIconCircle, styles.disconnectCircle]}>
            <PhoneOff size={24} color="#fff" />
          </View>
          <Text style={[styles.controlLabel, styles.disconnectLabel]}>End Session</Text>
        </TouchableOpacity>

        {/* Microphone Mute Key */}
        <TouchableOpacity 
          style={styles.controlButton} 
          onPress={handleToggleMute}
          activeOpacity={0.7}
        >
          <View style={[styles.controlIconCircle, isMuted && styles.mutedCircle]}>
            {isMuted ? (
              <MicOff size={22} color="#f43f5e" />
            ) : (
              <Mic size={22} color="#10b981" />
            )}
          </View>
          <Text style={[styles.controlLabel, isMuted && styles.mutedLabel]}>
            {isMuted ? 'Muted' : 'Mute'}
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0f',
    zIndex: 9999,
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 40,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'hidden',
  },
  backgroundGlow: {
    position: 'absolute',
    top: '25%',
    left: '10%',
    right: '10%',
    height: 350,
    borderRadius: 180,
    opacity: 0.12,
    filter: 'blur(80px)',
    zIndex: -1,
  },
  header: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  liveIndicatorIcon: {
    marginRight: 6,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#94a3b8',
    letterSpacing: 2,
  },
  connectionText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginTop: 2,
  },
  captionsContainer: {
    flex: 1,
    width: '100%',
    maxHeight: '35%',
    marginVertical: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    overflow: 'hidden',
  },
  captionsScroll: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  captionsList: {
    gap: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: '85%',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 14,
    maxWidth: '85%',
  },
  bubbleSpeaker: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  userText: {
    color: '#e2e8f0',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  assistantText: {
    color: '#f1f5f9',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  waitingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  waitingText: {
    color: '#475569',
    fontSize: 12,
    fontStyle: 'italic',
  },
  visualizerContainer: {
    height: 40,
    width: '80%',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    width: '100%',
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
    minHeight: 4,
  },
  orbWrapper: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  orbTouchZone: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  orbCore: {
    width: 76,
    height: 76,
    borderRadius: 38,
    zIndex: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  orbMiddle: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2.5,
    zIndex: 2,
  },
  orbOuter: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 1.5,
    zIndex: 1,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 10,
    gap: 8,
    maxWidth: '100%',
    marginBottom: 15,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  controlsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  controlButton: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  controlIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  controlLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  endSessionButton: {
    flex: 1.2,
  },
  disconnectCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ef4444',
    borderColor: '#fca5a5',
    borderWidth: 1.5,
    shadowColor: '#ef4444',
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
  disconnectLabel: {
    color: '#ef4444',
    fontSize: 11,
  },
  mutedCircle: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderColor: 'rgba(244, 63, 94, 0.3)',
  },
  mutedLabel: {
    color: '#f43f5e',
  },
});

export default LiveVoiceAssistant;
