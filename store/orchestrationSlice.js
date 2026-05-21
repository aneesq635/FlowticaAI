import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  activeAgents: {
    'Supervisor': 'idle',
    'Intent Agent': 'idle',
    'Extraction Agent': 'idle',
    'Matching Agent': 'idle',
    'Pricing Agent': 'idle',
    'Scheduling Agent': 'idle',
    'Booking Agent': 'idle',
    'Knowledge Agent': 'idle',
    'Follow-up Agent': 'idle',
    'Dispute Resolution Agent': 'idle',
  },
  pipeline: 'intent',
  logs: [],
  traces: [],
  sharedState: {},
  toolLogs: [],
  isWorkflowRunning: false,
  isChatVisible: true,
  userRole: 'Customer', // 'Customer' | 'Provider' | null
  messages: [
    { id: '1', sender: 'ai', text: 'Hi! I am your AI Orchestrator. What service do you need today?', timestamp: Date.now() }
  ],
  orchestrationState: {
    activeAgent: null, // 'Intent', 'Extraction', 'Matching', 'Pricing', 'Booking', 'Idle'
    logs: [],
    extractedData: null,
    recommendedProviders: [],
  },
  currentBooking: null,
  providerProfile: {
    name: 'Ali Technician',
    service: 'AC Repair',
    rating: 4.8,
    availability: true,
  },
  theme: 'dark', // 'light' | 'dark'
  isEngineExpanded: false,
  unreadNotificationsCount: 0,
};

const orchestrationSlice = createSlice({
  name: 'orchestration',
  initialState,
  reducers: {
    toggleEngine: (state) => {
      state.isEngineExpanded = !state.isEngineExpanded;
    },
    setEngineExpanded: (state, action) => {
      state.isEngineExpanded = action.payload;
    },
    setAgentStatus: (state, action) => {
      const { agent, status } = action.payload;
      state.activeAgents[agent] = status;
    },
    updatePipeline: (state, action) => {
      state.pipeline = action.payload;
    },
    addLog: (state, action) => {
      state.logs.push(action.payload);
    },
    addTrace: (state, action) => {
      state.traces.push(action.payload);
    },
    updateSharedState: (state, action) => {
      state.sharedState = { ...state.sharedState, ...action.payload };
    },
    addToolLog: (state, action) => {
      state.toolLogs.push(action.payload);
    },
    startWorkflow: (state) => {
      state.isWorkflowRunning = true;
      state.logs = [];
      state.traces = [];
      // Reset agent statuses to idle/waiting
      Object.keys(state.activeAgents).forEach(k => state.activeAgents[k] = 'idle');
    },
    completeWorkflow: (state) => {
      state.isWorkflowRunning = false;
    },
    toggleChat: (state) => {
      state.isChatVisible = !state.isChatVisible;
    },
    setChatVisibility: (state, action) => {
      state.isChatVisible = action.payload;
    },
    hydrateState: (state, action) => {
      const { shared_state, logs, traces, active_agent } = action.payload;
      state.sharedState = shared_state || {};
      state.logs = logs || [];
      state.traces = traces || [];
      // Mark all agents in the restored state as completed if they are not the active one
      if (active_agent) {
        state.activeAgents[active_agent] = 'completed';
      }
    },
    setUserRole: (state, action) => {
      state.userRole = action.payload;
    },
    addMessage: (state, action) => {
      state.messages.push(action.payload);
    },
    setOrchestrationState: (state, action) => {
      state.orchestrationState = { ...state.orchestrationState, ...action.payload };
    },
    setBooking: (state, action) => {
      state.currentBooking = action.payload;
    },
    setProviderProfile: (state, action) => {
      state.providerProfile = action.payload;
    },
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
    },
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    setUnreadCount: (state, action) => {
      state.unreadNotificationsCount = action.payload;
    }
  },
});

export const {
  setAgentStatus,
  updatePipeline,
  addLog,
  addTrace,
  updateSharedState,
  addToolLog,
  startWorkflow,
  completeWorkflow,
  toggleChat,
  setChatVisibility,
  hydrateState,
  setUserRole,
  addMessage,
  setOrchestrationState,
  setBooking,
  setProviderProfile,
  toggleTheme,
  setTheme,
  setUnreadCount,
  toggleEngine,
  setEngineExpanded
} = orchestrationSlice.actions;

export default orchestrationSlice.reducer;
