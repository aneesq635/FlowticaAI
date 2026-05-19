import { io } from 'socket.io-client';
import store from '../store';
import { 
  setAgentStatus, 
  updatePipeline, 
  addLog, 
  addTrace, 
  updateSharedState, 
  startWorkflow, 
  completeWorkflow 
} from '../store/orchestrationSlice';
import { addMessage } from '../store/chatSlice';

const DEFAULT_BASE_URL = 'http://10.73.21.96:5000';
const SOCKET_URL = process.env.EXPO_PUBLIC_BACKEND_URL || DEFAULT_BASE_URL;

class SocketService {
  constructor() {
    this.socket = null;
    console.log(`[SOCKET SERVICE] Initialized with target URL: ${SOCKET_URL}`);
  }

  connect() {
    console.log(`\n[SOCKET SERVICE] === ATTEMPTING CONNECTION ===`);
    console.log(`[SOCKET SERVICE] URL: ${SOCKET_URL}`);
    
    try {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'], // Allow both transports for reliability
        forceNew: true,
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      // --- LIFECYCLE EVENT HANDLERS ---
      
      this.socket.on('connect', () => {
        const transportName = this.socket.io?.engine?.transport?.name || 'unknown';
        console.log(`[SOCKET SUCCESS] Connected successfully! Session ID: ${this.socket.id}`);
        console.log(`[SOCKET SUCCESS] Active transport protocol: ${transportName}`);
        
        store.dispatch(addLog({ 
          level: 'success', 
          message: `Live Sync Connected (Protocol: ${transportName.toUpperCase()})` 
        }));
      });

      this.socket.on('connect_error', (err) => {
        console.error(`[SOCKET ERROR] Connection failed!`);
        console.error(`[SOCKET ERROR] Error Message: ${err.message}`);
        console.error(`[SOCKET ERROR] Error Context:`, err.context || 'None');
        console.error(`[SOCKET ERROR] Full Error:`, err);
        
        store.dispatch(addLog({ 
          level: 'error', 
          message: `Live Sync Connection Error: ${err.message}` 
        }));
      });

      this.socket.on('disconnect', (reason) => {
        console.warn(`[SOCKET DISCONNECT] Lost connection. Reason: ${reason}`);
        
        store.dispatch(addLog({ 
          level: 'warning', 
          message: `Live Sync Disconnected (${reason})` 
        }));
      });

      this.socket.on('reconnect_attempt', (attempt) => {
        console.log(`[SOCKET RECONNECT] Reconnection attempt #${attempt}...`);
      });

      this.socket.on('reconnect', (attempt) => {
        console.log(`[SOCKET RECONNECT SUCCESS] Reconnected after ${attempt} attempts!`);
      });

      // --- BUSINESS LOGIC EVENT HANDLERS ---

      this.socket.on('workflow_started', (data) => {
        console.log('[SOCKET EVENT] workflow_started payload:', JSON.stringify(data));
        store.dispatch(startWorkflow());
        store.dispatch(addLog({ type: 'info', message: 'Workflow Started', data }));
      });

      this.socket.on('workflow_update', (payload) => {
        console.log('[SOCKET EVENT] workflow_update type:', payload?.type);
        const { type, data } = payload;
        
        switch (type) {
          case 'agent_started':
            store.dispatch(setAgentStatus({ agent: data.agent, status: 'running' }));
            store.dispatch(updatePipeline(data.agent));
            break;
          case 'agent_completed':
            store.dispatch(setAgentStatus({ agent: data.agent, status: 'completed' }));
            break;
          case 'state_updated':
            store.dispatch(updateSharedState(data.diff));
            break;
          case 'trace_created':
            store.dispatch(addTrace({ agent: data.agent, reasoning: data.reasoning }));
            break;
          case 'execution_log':
            store.dispatch(addLog({ level: data.level, message: data.message }));
            break;
          default:
            break;
        }
      });

      this.socket.on('request_updated', (data) => {
        console.log('[SOCKET EVENT] request_updated payload:', JSON.stringify(data));
        store.dispatch(updateSharedState({
          latest_request_status: data.status,
          booking_details: {
            request_id: data.request_id,
            status: data.status,
            offered_price: data.offered_price,
            requested_date: data.requested_date,
            requested_time: data.requested_time,
            provider_note: data.provider_note
          }
        }));
        store.dispatch(addLog({ 
          level: 'success', 
          message: `Realtime Request Synchronized: status is now ${data.status.toUpperCase()}`
        }));
      });

      this.socket.on('workflow_completed', (data) => {
        console.log('[SOCKET EVENT] workflow_completed payload:', JSON.stringify(data));
        store.dispatch(completeWorkflow());
        store.dispatch(addLog({ type: 'success', message: 'Workflow Completed', data }));
      });

      this.socket.on('chat_message', (payload) => {
        console.log('[SOCKET EVENT] chat_message payload:', JSON.stringify(payload));
        const state = store.getState();
        const activeId = state.chat.activeConversationId;
        
        // Use the conversation_id from payload, fallback to active conversation
        const targetConversationId = payload.conversation_id || activeId;
        
        store.dispatch(addMessage({ 
          conversationId: targetConversationId, 
          message: {
            role: payload.role,
            content: payload.content,
            agent: payload.agent
          } 
        }));
      });

    } catch (err) {
      console.error('[SOCKET SERVICE] Critical exception inside connect():', err);
    }
  }

  sendMessage(text, conversationId) {
    console.log(`\n[SOCKET SEND] Requesting transmission: "${text.substring(0, 60)}..."`);
    console.log(`[SOCKET SEND] Target Conversation ID: ${conversationId}`);

    if (!this.socket) {
      console.warn('[SOCKET SEND WARNING] Socket instance is null! Attempting lazy-connection...');
      this.connect();
    }

    if (this.socket && this.socket.connected) {
      console.log(`[SOCKET SEND SUCCESS] Emitting 'user_message' event payload.`);
      this.socket.emit('user_message', { text, conversation_id: conversationId });
    } else {
      const socketState = this.socket ? 'DISCONNECTED' : 'NULL';
      console.error(`[SOCKET SEND FAILURE] Cannot emit. Socket state is: ${socketState}`);
      
      store.dispatch(addLog({ 
        level: 'error', 
        message: 'Silent Failure Prevented: Send failed because socket is offline. Reconnecting...' 
      }));
      
      // Attempt immediate manual connection recovery
      if (this.socket) {
        this.socket.connect();
      }
    }
  }

  disconnect() {
    console.log('[SOCKET SERVICE] Manual disconnect requested.');
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

const socketService = new SocketService();
export default socketService;
