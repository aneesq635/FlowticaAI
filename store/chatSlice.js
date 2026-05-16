import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  conversations: [],
  activeConversationId: null,
  isTyping: false,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addMessage: (state, action) => {
      const { conversationId, message } = action.payload;
      const conv = state.conversations.find(c => (c.id === conversationId || c._id === conversationId));
      if (conv) {
        if (!conv.messages) conv.messages = [];
        conv.messages.push(message);
      }
    },
    setTyping: (state, action) => {
      state.isTyping = action.payload;
    },
    setActiveConversation: (state, action) => {
      state.activeConversationId = action.payload;
    },
    addConversation: (state, action) => {
      state.conversations.unshift(action.payload);
      state.activeConversationId = action.payload.id || action.payload._id;
    },
    setConversations: (state, action) => {
      state.conversations = action.payload;
      if (!state.activeConversationId && action.payload.length > 0) {
        state.activeConversationId = action.payload[0]._id || action.payload[0].id;
      }
    },
    updateConversationTitle: (state, action) => {
      const { id, title } = action.payload;
      const conv = state.conversations.find(c => (c._id === id || c.id === id));
      if (conv) {
        conv.title = title;
      }
    },
    setMessages: (state, action) => {
      const { conversationId, messages } = action.payload;
      const conv = state.conversations.find(c => (c._id === conversationId || c.id === conversationId));
      if (conv) {
        conv.messages = messages;
      }
    },
    deleteConversation: (state, action) => {
      const id = action.payload;
      state.conversations = state.conversations.filter(c => c._id !== id && c.id !== id);
      if (state.activeConversationId === id) {
        state.activeConversationId = state.conversations.length > 0 ? (state.conversations[0]._id || state.conversations[0].id) : null;
      }
    }
  },
});

export const { addMessage, setTyping, setActiveConversation, addConversation, setConversations, updateConversationTitle, setMessages, deleteConversation } = chatSlice.actions;
export default chatSlice.reducer;
