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

const SOCKET_URL = 'http://192.168.0.102:5000'; // Match your backend IP

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect() {
    this.socket = io(SOCKET_URL, {
      transports: ['polling'],   // Use polling to avoid WebSocket 500 error on Werkzeug
      forceNew: true,
      timeout: 10000
    });

    this.socket.on('connect', () => {
      console.log('Connected to Orchestration Socket:', SOCKET_URL);
    });

    this.socket.on('workflow_started', (data) => {
      store.dispatch(startWorkflow());
      store.dispatch(addLog({ type: 'info', message: 'Workflow Started', data }));
    });

    this.socket.on('workflow_update', (payload) => {
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

    this.socket.on('workflow_completed', (data) => {
      store.dispatch(completeWorkflow());
      store.dispatch(addLog({ type: 'success', message: 'Workflow Completed', data }));
    });

    this.socket.on('chat_message', (payload) => {
      console.log('Received chat message:', JSON.stringify(payload));
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
  }

  sendMessage(text, conversationId) {
    if (this.socket) {
      this.socket.emit('user_message', { text, conversation_id: conversationId });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

const socketService = new SocketService();
export default socketService;
