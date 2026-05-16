import { configureStore } from '@reduxjs/toolkit';
import orchestrationReducer from './orchestrationSlice';
import chatReducer from './chatSlice';

export const store = configureStore({
  reducer: {
    orchestration: orchestrationReducer,
    chat: chatReducer,
  },
});

export default store;
