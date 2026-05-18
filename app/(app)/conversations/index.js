import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { Plus, MessageSquare, ChevronRight, Clock, Bot, Loader2, Trash2 } from 'lucide-react-native';
import { MotiView } from 'moti';
import { addConversation, setConversations, deleteConversation } from '../../../store/chatSlice';
import { useAuth } from '../../../components/AuthContext';
import api from '../../../services/api';

export default function ConversationsList() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { conversations } = useSelector(state => state.chat);
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

  const renderItem = ({ item }) => (
  <MotiView
    from={{ opacity: 0, translateY: 8 }}
    animate={{ opacity: 1, translateY: 0 }}
    style={styles.convItemWrapper}
  >
    <TouchableOpacity
      style={styles.convItem}
      onPress={() => router.push({
        pathname: '/orchestrator',
        params: { id: item._id || item.id }
      })}
    >
      <View style={styles.convIcon}>
        <MessageSquare size={20} color="#3b82f6" />
      </View>
      <View style={styles.convInfo}>
        <Text style={styles.convTitle}>{item.title}</Text>
        <View style={styles.convMeta}>
          <Clock size={12} color="#475569" />
          <Text style={styles.convTime}>
            {new Date(item.timestamp || Date.now()).toLocaleDateString()}
          </Text>
        </View>
      </View>
      <ChevronRight size={20} color="#334155" />
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() => handleDelete(item._id || item.id)}
    >
      <Trash2 size={18} color="#ef4444" />
    </TouchableOpacity>
  </MotiView>
);

  return (
    <View style={styles.container}>
      <View style={[styles.content, { width: isDesktop ? 600 : '100%' }]}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Conversations</Text>
            <Text style={styles.subtitle}>Select an orchestration thread to continue</Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={handleCreateNew}>
            <Plus size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.emptyState}>
            <Loader2 size={32} color="#3b82f6" className="animate-spin" />
          </View>
        ) : conversations.length === 0 ? (
          <View style={styles.emptyState}>
            <Bot size={48} color="#1e293b" />
            <Text style={styles.emptyText}>No active orchestrations</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={handleCreateNew}>
              <Text style={styles.emptyButtonText}>Start First Orchestration</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList 
            data={conversations}
            keyExtractor={item => item._id || item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    paddingTop: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  addButton: {
    backgroundColor: '#3b82f6',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  listContent: {
    paddingBottom: 40,
  },
  convItem: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: 'rgba(30, 41, 59, 0.5)',
  padding: 16,
  flex: 1,
},
  convIcon: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 10,
    borderRadius: 12,
    marginRight: 16,
  },
  convInfo: {
    flex: 1,
  },
  convTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  convMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  convTime: {
    fontSize: 12,
    color: '#475569',
    marginLeft: 6,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -100,
  },
  emptyText: {
    color: '#475569',
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  emptyButtonText: {
    color: '#3b82f6',
    fontWeight: 'bold',
  },
  convItemWrapper: {
  flexDirection: 'row',
  alignItems: 'stretch',
  marginBottom: 12,
  borderRadius: 16,
  overflow: 'hidden',
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.05)',
},
  deleteButton: {
  backgroundColor: 'rgba(239, 68, 68, 0.08)',
  paddingHorizontal: 16,
  justifyContent: 'center',
  alignItems: 'center',
  borderLeftWidth: 1,
  borderLeftColor: 'rgba(239, 68, 68, 0.15)',
},
});
