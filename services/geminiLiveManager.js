import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import store from '../store';
import { 
  setConnectionStatus, 
  setIsSpeaking, 
  setIsListening, 
  updateLiveTranscript, 
  updateAssistantTranscript, 
  updateWaveformLevels, 
  setVoiceError, 
  endVoiceSession 
} from '../store/liveAgentSlice';
import { addMessage } from '../store/chatSlice';

const DEFAULT_BASE_URL = 'http://192.168.0.102:5000';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || DEFAULT_BASE_URL;
// Token requests go to Flask (port 5000) via BACKEND_URL.
// The WebSocket proxy runs on a DEDICATED port (5001) because Werkzeug
// (Flask-SocketIO threading mode) does not support raw WebSocket upgrades.
const GEMINI_WS_URL = BACKEND_URL
  .replace(/^http/, 'ws')         // http → ws  /  https → wss
  .replace(/:(\d+)$/, ':5001');   // swap port to 5001

class GeminiLiveManager {
  constructor() {
    this.ws = null;
    this.recordInterval = null;
    this.currentRecording = null;
    this.playbackQueue = [];
    this.activeSound = null;
    this.conversationId = null;
    this.userId = null;
    this.socketioSid = null;
    this.isRecordingActive = false;
    this.isMuted = false;
    this.amplitudeInterval = null;
  }

  /**
   * Requests microphone recording permissions from the operating system.
   */
  async requestPermissions() {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (err) {
      console.error('[GEMINI MANAGER] Permissions error:', err);
      return false;
    }
  }

  /**
   * Initializes the live speech session.
   */
  async startSession(conversationId, userId, socketioSid) {
    console.log(`\n[GEMINI MANAGER] === STARTING VOICE SESSION ===`);
    this.conversationId = conversationId;
    this.userId = userId || 'anonymous';
    this.socketioSid = socketioSid;
    
    // 1. Request microphone permission
    const granted = await this.requestPermissions();
    if (!granted) {
      store.dispatch(setVoiceError('Microphone permission is required to use the voice assistant.'));
      return;
    }

    try {
      // Configure audio session for voice chat (speakerphone, dual recording/playback)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldRouteThroughEarpieceAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      // 2. Request ephemeral WebSocket token from Flask backend
      const tokenResponse = await fetch(`${BACKEND_URL}/api/gemini/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: this.conversationId,
          user_id: this.userId,
          socketio_sid: this.socketioSid
        }),
      });

      const tokenData = await tokenResponse.json();
      if (!tokenData.success) {
        throw new Error(tokenData.error || 'Failed to fetch ephemeral session token.');
      }

      const { token } = tokenData;
      console.log(`[GEMINI MANAGER] Ephemeral voice session token obtained.`);

      // 3. Connect to secure Flask WebSocket Proxy (port 5001)
      const wsUrl = `${GEMINI_WS_URL}/api/gemini/ws?token=${token}`;
      console.log(`[GEMINI MANAGER] Connecting to WebSocket proxy: ${wsUrl}`);
      
      this.ws = new WebSocket(wsUrl);
      store.dispatch(setConnectionStatus('connecting'));

      this.ws.onopen = () => {
        console.log('[GEMINI MANAGER SUCCESS] WebSocket Proxy connection opened successfully.');
        store.dispatch(setConnectionStatus('connected'));
        store.dispatch(setIsListening(true));
        
        // Start streaming audio in background
        this.startStreaming();
        this.startAmplitudeSimulator();
      };

      this.ws.onmessage = async (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          // Case 1: Audio Playback chunk received
          if (payload.type === 'audio' && payload.data) {
            this.handleIncomingAudio(payload.data);
          }
          
          // Case 2: Transcription updates
          if (payload.type === 'caption') {
            const { role, text } = payload;
            if (role === 'user') {
              store.dispatch(updateLiveTranscript(text));
            } else if (role === 'assistant') {
              store.dispatch(updateAssistantTranscript(text));
            }
          }
        } catch (msgErr) {
          console.error('[GEMINI MANAGER ERROR] Error parsing WebSocket message:', msgErr);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[GEMINI MANAGER ERROR] WebSocket Error:', error);
        store.dispatch(setVoiceError('A network error occurred in the voice gateway.'));
      };

      this.ws.onclose = (event) => {
        console.warn(`[GEMINI MANAGER] WebSocket connection closed. Reason: ${event.reason}`);
        this.cleanup();
      };

    } catch (err) {
      console.error('[GEMINI MANAGER ERROR] Failed to start voice session:', err);
      store.dispatch(setVoiceError(err.message || 'Initialization failed.'));
      this.cleanup();
    }
  }

  /**
   * Starts capturing microphone in 800ms chunks and streaming them to WebSocket.
   */
  async startStreaming() {
    this.isRecordingActive = true;
    
    // Helper: safely stop a recording, swallowing "already unloaded" errors.
    const safeStop = async (rec) => {
      if (!rec) return;
      try {
        await rec.stopAndUnloadAsync();
      } catch (_) {
        // Silently ignore — already stopped by cleanup() or a previous call.
      }
    };

    const recordNextChunk = async () => {
      if (!this.isRecordingActive || this.isMuted) return;

      try {
        // Linear PCM recording options at 16kHz
        const recordingOptions = {
          android: {
            extension: '.pcm',
            outputFormat: Audio.AndroidOutputFormat.DEFAULT,     // ✅ Raw PCM
            audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,     // ✅ No encoding
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 256000,
          },
          ios: {
            extension: '.wav',
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 16000,
            numberOfChannels: 1,
            bitRate: 128000,
            linearPCMBitDepth: 16,
            linearPCMIsBigEndian: false,
            linearPCMIsFloat: false,
          },
        };

        const { recording } = await Audio.Recording.createAsync(recordingOptions);
        this.currentRecording = recording;

        // Record for 800ms
        await new Promise(resolve => setTimeout(resolve, 800));

        // If cleanup() fired during the 800ms sleep, isRecordingActive will be
        // false AND this.currentRecording will be null (cleanup nulls it first).
        // Use our local `recording` reference for the stop so we don't interfere
        // with the cleanup path, and guard with safeStop to absorb double-stops.
        if (!this.isRecordingActive) {
          await safeStop(recording);
          return;
        }

        // Trigger next recording loop asynchronously to prevent gaps
        recordNextChunk();

        // Grab and clear the shared ref BEFORE stopping so cleanup() can see it
        // is already handled if it fires right now.
        this.currentRecording = null;

        await safeStop(recording);
        const uri = recording.getURI();

        if (uri && this.ws && this.ws.readyState === WebSocket.OPEN) {
          // Read chunk file as base64 string
          const base64Audio = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          // Convert base64 to raw binary bytes to send over WebSocket directly
          const binaryString = atob(base64Audio);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          // Send raw binary to Flask WebSocket Proxy
          this.ws.send(bytes.buffer);
        }

        // Clean up temporary recording chunk from device storage
        if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });

      } catch (err) {
        // Only log truly unexpected errors — "already unloaded" is handled by safeStop.
        if (!err?.message?.includes('already been unloaded')) {
          console.error('[GEMINI MANAGER ERROR] Error capturing or sending recording chunk:', err);
        }
      }
    };

    recordNextChunk();
  }

  /**
   * Generates a 44-byte standard WAV header for 24kHz, 16-bit, Mono PCM audio to satisfy browser/mobile players.
   */
  get44ByteWavHeader(pcmLength) {
    const header = new ArrayBuffer(44);  // ✅ 44 not 48
    const view = new DataView(header);
    const writeString = (v, offset, string) => {
      for (let i = 0; i < string.length; i++)
        v.setUint8(offset + i, string.charCodeAt(i));
    };
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + pcmLength, true);  // ✅ 36 not 40
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);     // ✅ 16 not 20
    view.setUint16(20, 1, true);      // PCM
    view.setUint16(22, 1, true);      // Mono
    view.setUint32(24, 24000, true);  // 24kHz output
    view.setUint32(28, 48000, true);  // ByteRate
    view.setUint16(32, 2, true);      // BlockAlign
    view.setUint16(34, 16, true);     // BitsPerSample
    writeString(view, 36, 'data');
    view.setUint32(40, pcmLength, true);
    return header;
  }

  /**
   * Converts an ArrayBuffer back to base64.
   */
  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Prepend 44-byte WAV header to base64 PCM data, write to a temp file, and queue for playing.
   * Compiles the buffers in binary memory space to guarantee zero base64 padding misalignment issues!
   */
  async handleIncomingAudio(pcmBase64) {
    try {
      // Decode pcm length and raw bytes
      const pcmBinary = atob(pcmBase64);
      const pcmLength = pcmBinary.length;

      // Generate standard 44-byte WAV header
      const headerBuffer = this.get44ByteWavHeader(pcmLength);
      const headerView = new Uint8Array(headerBuffer);

      // Concatenate WAV header and PCM byte array safely in memory
      const combined = new Uint8Array(44 + pcmLength);
      combined.set(headerView, 0);
      for (let i = 0; i < pcmLength; i++) {
        combined[44 + i] = pcmBinary.charCodeAt(i);
      }

      // Encode combined bytes to safe base64
      const completeWavBase64 = this.arrayBufferToBase64(combined.buffer);
      
      const fileUri = `${FileSystem.documentDirectory}live_reply_${Date.now()}_${Math.floor(Math.random()*1000)}.wav`;
      
      // Write the complete playable WAV file to disk
      await FileSystem.writeAsStringAsync(fileUri, completeWavBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      this.playbackQueue.push(fileUri);
      this.playQueue();

    } catch (err) {
      console.error('[GEMINI MANAGER ERROR] Error loading incoming audio chunk:', err);
    }
  }

  /**
   * Sequentially plays through the temporary audio chunk queue.
   */
  async playQueue() {
    if (this.activeSound || this.playbackQueue.length === 0) return;

    const uri = this.playbackQueue.shift();

    try {
      store.dispatch(setIsSpeaking(true));
      
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      
      this.activeSound = sound;

      sound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.didJustFinish) {
          // Playback finished cleanly
          this.activeSound = null;
          await sound.unloadAsync();
          
          // Clean up temp file
          await FileSystem.deleteAsync(uri, { idempotent: true });

          if (this.playbackQueue.length === 0) {
            store.dispatch(setIsSpeaking(false));
            store.dispatch(setIsListening(true));
          } else {
            // Keep playing next items in the queue
            this.playQueue();
          }
        }
      });

    } catch (err) {
      console.error('[GEMINI MANAGER ERROR] Playback queue crash:', err);
      this.activeSound = null;
      this.playQueue();
    }
  }

  /**
   * User voice override (Barge-In) or manual interruption. Stops current voice output immediately.
   */
  async handleInterruption() {
    if (!this.activeSound && this.playbackQueue.length === 0) return;

    console.log('[GEMINI MANAGER] Interruption triggered! Clearing playback queue and stopping speaker.');
    
    try {
      // Tell backend to cancel active Gemini Live audio output
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'interrupt' }));
      }

      // Stop active speaker sound
      if (this.activeSound) {
        const sound = this.activeSound;
        this.activeSound = null;
        await sound.stopAsync();
        await sound.unloadAsync();
      }

      // Clear pending queue files
      while (this.playbackQueue.length > 0) {
        const uri = this.playbackQueue.shift();
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }

      store.dispatch(setIsSpeaking(false));
      store.dispatch(setIsListening(true));

    } catch (err) {
      console.error('[GEMINI MANAGER ERROR] Interruption failed:', err);
    }
  }

  /**
   * Mutes or unmutes the local microphone recording stream.
   */
  toggleMute(isMuted) {
    this.isMuted = isMuted;
    if (this.isMuted) {
      console.log('[GEMINI MANAGER] Microphone MUTED.');
      if (this.currentRecording) {
        this.currentRecording.stopAndUnloadAsync().then(() => {
          this.currentRecording = null;
        });
      }
    } else {
      console.log('[GEMINI MANAGER] Microphone UNMUTED.');
      if (this.isRecordingActive) {
        this.startStreaming();
      }
    }
  }

  /**
   * Micro-animation amplitude simulator for beautiful waveform bars.
   */
  startAmplitudeSimulator() {
    this.amplitudeInterval = setInterval(() => {
      const state = store.getState().liveAgent;
      let min = 2;
      let max = 6;
      
      if (state.isSpeaking) {
        min = 10;
        max = 40;
      } else if (state.isListening && !state.isMuted) {
        // Very subtle resting breathing or listening amplitudes
        min = 4;
        max = 12;
      }
      
      const newLevels = Array(15).fill(0).map(() => 
        Math.floor(Math.random() * (max - min + 1) + min)
      );
      
      store.dispatch(updateWaveformLevels(newLevels));
    }, 120);
  }

  /**
   * Graceful and safe session exit, cleaning up recorders, sound vectors, and WS ports.
   */
  cleanup() {
    console.log('[GEMINI MANAGER] Triggering deep audio and socket cleanup...');
    this.isRecordingActive = false;
    
    if (this.amplitudeInterval) {
      clearInterval(this.amplitudeInterval);
      this.amplitudeInterval = null;
    }

    if (this.recordInterval) {
      clearInterval(this.recordInterval);
      this.recordInterval = null;
    }

    if (this.currentRecording) {
      // Null the ref FIRST so the recordNextChunk loop cannot also try to stop it.
      const recToStop = this.currentRecording;
      this.currentRecording = null;
      recToStop.stopAndUnloadAsync().catch(() => {});
    }

    if (this.activeSound) {
      const sound = this.activeSound;
      this.activeSound = null;
      sound.stopAsync().then(() => sound.unloadAsync()).catch(err => {});
    }

    // Delete all temporary wav audio cache files
    while (this.playbackQueue.length > 0) {
      const uri = this.playbackQueue.shift();
      FileSystem.deleteAsync(uri, { idempotent: true }).catch(err => {});
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch (err) {}
      this.ws = null;
    }
  }

  /**
   * Stops the voice assistant completely and syncs final states.
   */
  stopSession() {
    this.cleanup();
    store.dispatch(endVoiceSession());
  }
}

const geminiLiveManager = new GeminiLiveManager();
export default geminiLiveManager;
