import React from 'react';
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useSelector } from 'react-redux';
import { MotiView, AnimatePresence } from 'moti';
import { 
  Activity, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Zap, 
  Database, 
  Cpu, 
  MessageSquare, 
  Settings,
  ArrowRight,
  Terminal,
  Layers,
  ChevronRight
} from 'lucide-react-native';

const { width } = Dimensions.get('window');

const AGENT_CONFIG = {
  'supervisor': { name: 'Supervisor Agent', desc: 'System brain — orchestrates the entire workflow', icon: Cpu, color: '#f87171' },
  'intent': { name: 'Intent Agent', desc: 'Classifies user intent & goals', icon: Cpu, color: '#f87171' },
  'extraction': { name: 'Extraction Agent', desc: 'Extracts structured entities from chat', icon: Settings, color: '#60a5fa' },
  'memory': { name: 'Memory Agent', desc: 'Syncs user profile & preferences', icon: Database, color: '#fbbf24' },
  'knowledge': { name: 'Knowledge Agent', desc: 'Retrieves providers from MongoDB RAG', icon: Layers, color: '#38bdf8' },
  'matching': { name: 'Matching Agent', desc: 'Ranks candidates via scoring engine', icon: Database, color: '#c084fc' },
  'booking': { name: 'Booking Agent', desc: 'Finalizes service transactions', icon: CheckCircle, color: '#2dd4bf' },
  'scheduling': { name: 'Scheduling Agent', desc: 'Configures automated follow-ups', icon: Clock, color: '#4ade80' },
  'communication': { name: 'Frontier Agent', desc: 'Dedicated user communication interface', icon: MessageSquare, color: '#f472b6' },
};

const AgentCard = ({ agentKey, status, trace }) => {
  const config = AGENT_CONFIG[agentKey] || { name: agentKey, desc: 'AI Orchestration Agent', icon: Cpu, color: '#94a3b8' };
  const Icon = config.icon;

  const getStatusDisplay = () => {
    switch (status) {
      case 'running': return { label: 'RUNNING', color: '#fbbf24', icon: Activity };
      case 'completed': return { label: 'COMPLETED', color: '#10b981', icon: CheckCircle };
      case 'failed': return { label: 'FAILED', color: '#ef4444', icon: AlertTriangle };
      default: return { label: 'IDLE', color: '#64748b', icon: Clock };
    }
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay.icon;

  return (
    <MotiView 
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 400 }}
      style={[
        styles.agentCard, 
        status === 'running' && styles.agentCardRunning,
        status === 'completed' && styles.agentCardCompleted
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.agentIconContainer, { backgroundColor: config.color + '15' }]}>
          <Icon size={20} color={config.color} />
          {status === 'running' && (
            <MotiView
              from={{ scale: 0.8, opacity: 0.3 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ loop: true, duration: 1500, type: 'timing' }}
              style={[styles.pulseCircle, { backgroundColor: config.color }]}
            />
          )}
        </View>

        <View style={styles.agentInfo}>
          <Text style={[styles.agentName, { color: status === 'completed' ? '#10b981' : '#e2e8f0' }]}>
            {config.name}
            {status === 'completed' && "  ✓"}
          </Text>
          <Text style={styles.agentDesc}>{config.desc}</Text>
        </View>

        <View style={[
          styles.statusBadge, 
          { backgroundColor: statusDisplay.color + '20', borderColor: statusDisplay.color + '40', borderWidth: 1 }
        ]}>
          <StatusIcon size={12} color={statusDisplay.color} style={{ marginRight: 4 }} />
          <Text style={[styles.statusBadgeText, { color: statusDisplay.color, fontWeight: '700' }]}>
            {statusDisplay.label}
          </Text>
        </View>
      </View>

      {status === 'completed' && trace && (
        <MotiView 
          from={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          style={styles.traceContainer}
        >
          <View style={styles.traceHeader}>
            <View style={styles.traceLine} />
            <Text style={styles.traceHeaderText}>Execution Trace</Text>
          </View>
          <Text style={styles.traceContent} numberOfLines={4}>{trace.reasoning}</Text>
        </MotiView>
      )}
    </MotiView>
  );
};

const OrchestrationPanel = () => {
  const { activeAgents, logs, sharedState, traces, isWorkflowRunning } = useSelector(state => state.orchestration);

  const activeAgentOrder = [
    'supervisor', 'intent', 'extraction', 'memory', 
    'knowledge', 'matching', 'booking', 'scheduling', 'communication'
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <View style={styles.mainHeader}>
        <Cpu size={24} color="#a78bfa" />
        <Text style={styles.headerText}>Agent Pipeline</Text>
      </View>
      
      <View style={styles.pipelineDivider} />

      <Text style={styles.sectionTitle}>LIVE AGENT STATUS</Text>
      
      {activeAgentOrder.map((key) => {
        const status = activeAgents[key] || 'idle';
        const trace = traces.find(t => t.agent === key);
        
        return (
          <AgentCard 
            key={key} 
            agentKey={key} 
            status={status} 
            trace={trace}
          />
        );
      })}

      {!isWorkflowRunning && Object.values(activeAgents).every(v => v === 'idle') && (
        <View style={styles.emptyState}>
          <Clock size={48} color="#1e293b" />
          <Text style={styles.emptyText}>Waiting for orchestration input...</Text>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Terminal size={18} color="#94a3b8" />
        <Text style={styles.sectionTitle}>EXECUTION LOG</Text>
      </View>
      <View style={styles.logContainer}>
        {logs.length === 0 ? (
          <Text style={styles.logPlaceholder}>No execution events recorded.</Text>
        ) : (
          logs.map((log, index) => (
            <View key={index} style={styles.logLine}>
              <Text style={styles.logPrompt}>{'>'}</Text>
              <View style={styles.logContent}>
                <Text style={styles.logAgent}>{log.agent || 'SYSTEM'}: </Text>
                <Text style={styles.logMessage}>{log.message}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={styles.sectionHeader}>
        <Layers size={18} color="#94a3b8" />
        <Text style={styles.sectionTitle}>SHARED STATE (LANGGRAPH)</Text>
      </View>
      <View style={styles.stateContainer}>
        <Text style={styles.stateText}>
          {JSON.stringify(sharedState, (key, value) => {
            if (key === 'embedding' || key === 'embeddings') return '[Filtered: Vector Embedding Array]';
            if (Array.isArray(value) && value.length > 50 && typeof value[0] === 'number') return `[Float Array length ${value.length}]`;
            if (typeof value === 'string' && value.length > 100) return value.substring(0, 100) + '...';
            return value;
          }, 2)}
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617', // Deeper black/navy
  },
  mainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginLeft: 12,
    letterSpacing: 0.5,
  },
  pipelineDivider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 1.5,
    marginBottom: 16,
    marginLeft: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 16,
    gap: 8,
  },
  agentCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  agentCardRunning: {
    borderColor: '#fbbf24',
    backgroundColor: 'rgba(251, 191, 36, 0.05)',
  },
  agentCardCompleted: {
    borderColor: '#10b981',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  agentIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  agentName: {
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  agentDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  traceContainer: {
    marginTop: 16,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  traceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  traceHeaderText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
  },
  traceContent: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
  },
  runningIndicator: {
    marginTop: 12,
    alignItems: 'center',
  },
  runningText: {
    fontSize: 10,
    color: '#fbbf24',
    fontStyle: 'italic',
  },
  logContainer: {
    backgroundColor: '#020617',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  logLine: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  logPrompt: {
    color: '#fbbf24',
    fontWeight: 'bold',
    marginRight: 8,
  },
  logContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
  },
  logAgent: {
    color: '#a78bfa',
    fontSize: 12,
    fontWeight: 'bold',
  },
  logMessage: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  logPlaceholder: {
    color: '#475569',
    fontSize: 12,
    fontStyle: 'italic',
  },
  stateContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.3)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  stateText: {
    color: '#60a5fa',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  emptyState: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#475569',
    marginTop: 12,
    fontSize: 14,
  },
});

export default OrchestrationPanel;
