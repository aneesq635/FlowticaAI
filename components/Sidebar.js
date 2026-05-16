import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { MessageSquare, Plus, Users, History, Settings, Bot, Edit2, Check, X, Trash2 } from 'lucide-react-native';
import { useSelector, useDispatch } from 'react-redux';
import { useRouter, usePathname } from 'expo-router';
import { setActiveConversation, addConversation, setConversations, updateConversationTitle } from '../store/chatSlice';
import { useAuth } from './AuthContext';

const SidebarItem = ({ icon: Icon, label, active, onPress, onRename, isEditing, editValue, setEditValue, onSaveRename, onCancelRename, onDelete }) => (
  <View style={[styles.itemContainer, active && styles.activeItem]}>
    <TouchableOpacity 
      style={styles.itemMain} 
      onPress={onPress}
    >
      <Icon size={18} color={active ? '#3b82f6' : '#94a3b8'} />
      {isEditing ? (
        <TextInput
          style={styles.editInput}
          value={editValue}
          onChangeText={setEditValue}
          autoFocus
          onSubmitEditing={onSaveRename}
        />
      ) : (
        <Text numberOfLines={1} style={[styles.itemLabel, { color: active ? '#fff' : '#94a3b8' }]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
    
    {active && !isEditing && (
      <View style={{flexDirection: 'row'}}>
        <TouchableOpacity onPress={onRename} style={styles.iconAction}>
          <Edit2 size={14} color="#94a3b8" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={styles.iconAction}>
          <Trash2 size={14} color="#ef4444" />
        </TouchableOpacity>
      </View>
    )}

    {isEditing && (
      <View style={styles.editActions}>
        <TouchableOpacity onPress={onSaveRename} style={styles.iconAction}>
          <Check size={14} color="#10b981" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancelRename} style={styles.iconAction}>
          <X size={14} color="#ef4444" />
        </TouchableOpacity>
      </View>
    )}
  </View>
);

const Sidebar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();
  const { user } = useAuth();
  const { conversations, activeConversationId } = useSelector(state => state.chat);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  const fetchConversations = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`http://192.168.0.102:5000/conversations/${user.id}`);
      const data = await res.json();
      if (data.success) {
        dispatch(setConversations(data.conversations));
      }
    } catch (err) {
      console.error("Fetch Error:", err);
    }
  };

  useEffect(() => {
    if (user?.id && conversations.length === 0) {
      fetchConversations();
    }
  }, [user]);

  const handleCreateNew = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const res = await fetch('http://192.168.0.102:5000/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, title: `Conversation ${conversations.length + 1}` })
      });
      const data = await res.json();
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

  const startRenaming = (id, title) => {
    setEditingId(id);
    setEditValue(title);
  };

  const saveRename = async (id) => {
    if (!editValue.trim()) return;
    try {
      const res = await fetch(`http://192.168.0.102:5000/conversations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editValue })
      });
      const data = await res.json();
      if (data.success) {
        dispatch(updateConversationTitle({ id, title: editValue }));
        setEditingId(null);
      }
    } catch (err) {
      console.error("Rename Error:", err);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`http://192.168.0.102:5000/conversations/${id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        import('../store/chatSlice').then(module => {
          dispatch(module.deleteConversation(id));
        });
        if (conversations.length <= 1) {
          router.push('/');
        }
      }
    } catch (err) {
      console.error("Delete Error:", err);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.logoIcon}>
          <Bot size={24} color="#3b82f6" />
        </View>
        <Text style={styles.logoText}>FLOWTICA AI</Text>
      </View>

      <TouchableOpacity 
        style={styles.newChatButton} 
        onPress={handleCreateNew}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Plus size={20} color="#fff" />
            <Text style={styles.newChatText}>New Conversation</Text>
          </>
        )}
      </TouchableOpacity>

      <ScrollView style={styles.menu}>
        <Text style={styles.sectionTitle}>CONVERSATIONS</Text>
        {conversations.map((conv) => (
          <SidebarItem 
            key={conv._id || conv.id}
            icon={MessageSquare} 
            label={conv.title} 
            active={activeConversationId === (conv._id || conv.id)} 
            onPress={() => {
              dispatch(setActiveConversation(conv._id || conv.id));
              router.push({
                pathname: '/orchestrator',
                params: { id: conv._id || conv.id }
              });
            }}
            onRename={() => startRenaming(conv._id || conv.id, conv.title)}
            isEditing={editingId === (conv._id || conv.id)}
            editValue={editValue}
            setEditValue={setEditValue}
            onSaveRename={() => saveRename(conv._id || conv.id)}
            onCancelRename={() => setEditingId(null)}
            onDelete={() => handleDelete(conv._id || conv.id)}
          />
        ))}
        
        <View style={styles.divider} />
        
        <Text style={styles.sectionTitle}>CUSTOM AGENTS</Text>
        <SidebarItem icon={Users} label="Local Electricians" />
        <SidebarItem icon={Users} label="AI Strategy Team" />
        
        <TouchableOpacity style={styles.addAgentButton}>
          <Plus size={16} color="#3b82f6" />
          <Text style={styles.addAgentText}>Add Agent</Text>
        </TouchableOpacity>

        <View style={styles.divider} />
        
        <Text style={styles.sectionTitle}>SYSTEM</Text>
        <SidebarItem icon={History} label="Workflow History" />
        <SidebarItem icon={Settings} label="Settings" />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 260,
    backgroundColor: '#0f172a',
    padding: 20,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.05)',
    height: '100%',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  logoIcon: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 8,
    borderRadius: 12,
    marginRight: 12,
  },
  logoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1.5,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    marginBottom: 24,
  },
  newChatText: {
    color: '#fff',
    marginLeft: 12,
    fontWeight: '600',
  },
  menu: {
    flex: 1,
  },
  sectionTitle: {
    color: '#475569',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 4,
    paddingRight: 8,
  },
  itemMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  activeItem: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  itemLabel: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  editInput: {
    marginLeft: 12,
    fontSize: 14,
    color: '#fff',
    flex: 1,
    padding: 0,
  },
  editActions: {
    flexDirection: 'row',
  },
  iconAction: {
    padding: 4,
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 16,
  },
  addAgentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingLeft: 10,
  },
  addAgentText: {
    color: '#3b82f6',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  }
});

export default Sidebar;
