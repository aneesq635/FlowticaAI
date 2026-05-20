import { configureStore } from '@reduxjs/toolkit';
import orchestrationReducer from './orchestrationSlice';
import chatReducer from './chatSlice';
import liveAgentReducer from './liveAgentSlice';

export const store = configureStore({
  reducer: {
    orchestration: orchestrationReducer,
    chat: chatReducer,
    liveAgent: liveAgentReducer,
  },
});

export default store;
