import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isVoiceSessionActive: false,
  connectionStatus: 'idle', // 'idle' | 'connecting' | 'connected' | 'error'
  isMuted: false,
  isSpeaking: false,
  isListening: false,
  liveTranscript: '', // Realtime user captions
  assistantTranscript: '', // Realtime assistant captions
  waveformLevels: Array(15).fill(2), // Amplitude bars for visualization
  error: null,
};

const liveAgentSlice = createSlice({
  name: 'liveAgent',
  initialState,
  reducers: {
    startVoiceSession: (state) => {
      state.isVoiceSessionActive = true;
      state.connectionStatus = 'connecting';
      state.liveTranscript = '';
      state.assistantTranscript = '';
      state.isMuted = false;
      state.isSpeaking = false;
      state.isListening = false;
      state.error = null;
    },
    setConnectionStatus: (state, action) => {
      state.connectionStatus = action.payload;
      if (action.payload === 'connected') {
        state.error = null;
      }
    },
    toggleMute: (state) => {
      state.isMuted = !state.isMuted;
    },
    setMuted: (state, action) => {
      state.isMuted = action.payload;
    },
    setIsSpeaking: (state, action) => {
      state.isSpeaking = action.payload;
      if (action.payload) {
        state.isListening = false;
      }
    },
    setIsListening: (state, action) => {
      state.isListening = action.payload;
      if (action.payload) {
        state.isSpeaking = false;
      }
    },
    updateLiveTranscript: (state, action) => {
      state.liveTranscript = action.payload;
    },
    updateAssistantTranscript: (state, action) => {
      state.assistantTranscript = action.payload;
    },
    updateWaveformLevels: (state, action) => {
      state.waveformLevels = action.payload;
    },
    setVoiceError: (state, action) => {
      state.connectionStatus = 'error';
      state.error = action.payload;
    },
    endVoiceSession: (state) => {
      state.isVoiceSessionActive = false;
      state.connectionStatus = 'idle';
      state.isMuted = false;
      state.isSpeaking = false;
      state.isListening = false;
      state.liveTranscript = '';
      state.assistantTranscript = '';
      state.waveformLevels = Array(15).fill(2);
      state.error = null;
    },
  },
});

export const {
  startVoiceSession,
  setConnectionStatus,
  toggleMute,
  setMuted,
  setIsSpeaking,
  setIsListening,
  updateLiveTranscript,
  updateAssistantTranscript,
  updateWaveformLevels,
  setVoiceError,
  endVoiceSession,
} = liveAgentSlice.actions;

export default liveAgentSlice.reducer;
