import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { Plus, MessageSquare, ChevronRight, Clock, Bot, Loader2, Trash2 } from 'lucide-react-native';
import { MotiView } from 'moti';
import { addConversation, setConversations, deleteConversation } from '../../../store/chatSlice';
import { useAuth } from '../../../components/AuthContext';
import api from '../../../services/api';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ConversationsList() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { conversations } = useSelector(state => state.chat);
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const fetchConversations = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await api.get(`/conversations/${user.id}`);
      if (data.success) {
        dispatch(setConversations(data.conversations));
      }
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [user]);

  const handleDelete = async (id) => {
  try {
    const data = await api.delete(`/conversations/${id}`);
    if (data.success) {
      dispatch(deleteConversation(id));
    }
  } catch (err) {
    console.error("Delete Error:", err);
  }
};
  const handleCreateNew = async () => {
    console.log("user",user);
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await api.post('/conversations', { user_id: user.id, title: `Conversation ${conversations.length + 1}` });
      console.log("data",data);
      if (data.success) {
        dispatch(addConversation(data.conversation));
        router.push({
          pathname: '/orchestrator',
          params: { id: data.conversation._id }
        });
      }
    } catch (err) {
      console.error("Create Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item, index }) => (
  <MotiView
    from={{ opacity: 0, translateY: 10, scale: 0.98 }}
    animate={{ opacity: 1, translateY: 0, scale: 1 }}
    transition={{ type: 'timing', duration: 400, delay: index * 100 }}
    style={[
      styles.convItemWrapper,
      { 
        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : '#ffffff',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
        shadowColor: isDark ? '#000' : '#cbd5e1',
        shadowOpacity: isDark ? 0.3 : 0.1,
        elevation: isDark ? 0 : 2,
      }
    ]}
  >
    <TouchableOpacity
      style={styles.convItem}
      activeOpacity={0.7}
      onPress={() => router.push({
        pathname: '/orchestrator',
        params: { id: item._id || item.id }
      })}
    >
      <View style={[styles.convIcon, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff' }]}>
        <MessageSquare size={20} color="#3b82f6" />
      </View>
      <View style={styles.convInfo}>
        <Text style={[styles.convTitle, { color: isDark ? '#f1f5f9' : '#0f172a' }]}>{item.title}</Text>
        <View style={styles.convMeta}>
          <Clock size={12} color={isDark ? '#475569' : '#94a3b8'} />
          <Text style={[styles.convTime, { color: isDark ? '#64748b' : '#64748b' }]}>
            {new Date(item.timestamp || Date.now()).toLocaleDateString()}
          </Text>
        </View>
      </View>
      <ChevronRight size={20} color={isDark ? '#334155' : '#cbd5e1'} />
    </TouchableOpacity>

    <TouchableOpacity
      style={[styles.deleteButton, { borderLeftColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)' }]}
      activeOpacity={0.7}
      onPress={() => handleDelete(item._id || item.id)}
    >
      <Trash2 size={18} color="#ef4444" />
    </TouchableOpacity>
  </MotiView>
);

 return (
  <SafeAreaView className={`flex-1 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
    <View className="flex-1 items-center pt-10">
      <View className="flex-1 w-full px-5" style={{ maxWidth: isDesktop ? 600 : '100%' }}>

        {/* Header */}
        <View className="flex-row justify-between items-center mb-8">
          <View>
            <MotiView from={{ opacity: 0, translateY: -8 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 500 }}>
              <View className={`self-start flex-row items-center px-3 py-1.5 rounded-full border mb-3 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                <MessageSquare size={12} color={isDark ? '#94a3b8' : '#64748b'} />
                <Text className={`ml-2 text-xs font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Orchestration Threads</Text>
              </View>
            </MotiView>
            <Text className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>Conversations</Text>
            <Text className={`text-sm mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Select a thread to continue</Text>
          </View>

          <MotiView from={{ scale: 1 }} animate={{ scale: loading ? 0.9 : 1 }} transition={{ type: 'spring', damping: 10, stiffness: 200 }}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleCreateNew}
              className={`w-12 h-12 rounded-2xl items-center justify-center border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-950 border-slate-800'}`}
            >
              <Plus size={22} color="#fff" />
            </TouchableOpacity>
          </MotiView>
        </View>

        {/* Body */}
        {loading ? (
          <View className="flex-1 items-center justify-center" style={{ marginTop: -80 }}>
            <Loader2 size={28} color={isDark ? '#334155' : '#cbd5e1'} />
          </View>
        ) : conversations.length === 0 ? (
          <View className="flex-1 items-center justify-center" style={{ marginTop: -80 }}>
            <View className={`w-16 h-16 rounded-3xl items-center justify-center mb-4 ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
              <Bot size={32} color={isDark ? '#334155' : '#94a3b8'} />
            </View>
            <Text className={`text-base font-bold mb-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>No active orchestrations</Text>
            <Text className={`text-xs mb-6 ${isDark ? 'text-slate-700' : 'text-slate-300'}`}>Start by creating a new thread</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleCreateNew}
              className={`flex-row items-center px-5 py-3 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
            >
              <Plus size={16} color={isDark ? '#fff' : '#0f172a'} />
              <Text className={`ml-2 text-sm font-black ${isDark ? 'text-white' : 'text-slate-950'}`}>Start First Orchestration</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={item => item._id || item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            renderItem={({ item, index }) => (
              <MotiView
                from={{ opacity: 0, translateY: 10, scale: 0.98 }}
                animate={{ opacity: 1, translateY: 0, scale: 1 }}
                transition={{ type: 'timing', duration: 400, delay: index * 80 }}
                className={`flex-row items-stretch mb-3 rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
              >
                <TouchableOpacity
                  className="flex-1 flex-row items-center p-4"
                  activeOpacity={0.7}
                  onPress={() => router.push({ pathname: '/orchestrator', params: { id: item._id || item.id } })}
                >
                  <View className={`w-10 h-10 rounded-xl items-center justify-center mr-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <MessageSquare size={18} color={isDark ? '#64748b' : '#94a3b8'} />
                  </View>
                  <View className="flex-1">
                    <Text className={`text-sm font-bold mb-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{item.title}</Text>
                    <View className="flex-row items-center">
                      <Clock size={11} color={isDark ? '#475569' : '#94a3b8'} />
                      <Text className={`text-xs ml-1.5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                        {new Date(item.timestamp || Date.now()).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={18} color={isDark ? '#334155' : '#cbd5e1'} />
                </TouchableOpacity>

                <TouchableOpacity
                  className={`px-4 items-center justify-center border-l ${isDark ? 'border-slate-800' : 'border-slate-100'}`}
                  style={{ backgroundColor: isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)' }}
                  activeOpacity={0.7}
                  onPress={() => handleDelete(item._id || item.id)}
                >
                  <Trash2 size={16} color="#ef4444" />
                </TouchableOpacity>
              </MotiView>
            )}
          />
        )}
      </View>
    </View>
  </SafeAreaView>
);
}
