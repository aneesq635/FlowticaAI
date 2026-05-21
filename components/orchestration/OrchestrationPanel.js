import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { useSelector } from 'react-redux';
import { MotiView, AnimatePresence } from 'moti';
import {
  Cpu, Activity, CheckCircle, Clock, AlertTriangle,
  Database, MessageSquare, Settings, Layers,
  Terminal, Zap, ChevronDown, ChevronUp, Box,
  Code, Info, Activity as TraceIcon
} from 'lucide-react-native';
import PipelineGraph from './PipelineGraph';
import { ShieldCheck } from 'lucide-react-native';
import { Search
  , Calculator,MessageCircle,AlertCircle
 } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AGENT_META = {
  'supervisor': { name: 'Supervisor', stateKey: 'Supervisor', icon: Cpu, desc: 'Workflow Controller' },
  'intent': { name: 'Intent', stateKey: 'Intent Agent', icon: Zap, desc: 'Goal Classification' },
  'extraction': { name: 'Extraction', stateKey: 'Extraction Agent', icon: Search, desc: 'Entity Parsing' },
  'knowledge': { name: 'Retrieval', stateKey: 'Knowledge Agent', icon: Database, desc: 'Knowledge RAG' },
  'matching': { name: 'Matching', stateKey: 'Matching Agent', icon: Layers, desc: 'Candidate Scoring' },
  'pricing': { name: 'Pricing', stateKey: 'Pricing Agent', icon: Calculator, desc: 'Cost Estimation' },
  'booking': { name: 'Service', stateKey: 'Booking Agent', icon: ShieldCheck, desc: 'Transaction Engine' },
  'scheduling': { name: 'Scheduling', stateKey: 'Scheduling Agent', icon: Clock, desc: 'Timeline Management' },
  'followup': { name: 'Frontier', stateKey: 'Follow-up Agent', icon: MessageCircle, desc: 'User Communication' },
  'dispute': { name: 'Dispute', stateKey: 'Dispute Resolution Agent', icon: AlertCircle, desc: 'Conflict Handling' },
};

const ReasoningBlock = ({ label, content, icon: Icon }) => (
  <View style={styles.reasoningBlock}>
    <View style={styles.reasoningHeader}>
      <Icon size={12} color="#475569" strokeWidth={2.5} />
      <Text style={styles.reasoningLabel}>{label}</Text>
    </View>
    <Text style={styles.reasoningText}>{content}</Text>
  </View>
);

const AgentCard = ({ agentKey, meta, status, trace, isDark }) => {
  const [expanded, setExpanded] = useState(status === 'running');
  const Icon = meta.icon || Cpu;

  const isRunning = status === 'running';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';

  const statusColor = isRunning ? '#fff' : (isCompleted ? '#10b981' : (isFailed ? '#ef4444' : '#475569'));

  return (
    <View style={[styles.agentCard, isRunning && styles.cardActive, { borderColor: isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0' }]}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setExpanded(!expanded)}
        style={styles.cardHeader}
      >
        <View style={styles.cardInfo}>
          <View style={[styles.iconContainer, isRunning && styles.iconActive]}>
            <Icon size={18} color={statusColor} />
          </View>
          <View>
            <Text style={[styles.agentName, { color: isDark ? '#f8fafc' : '#0f172a' }]}>{meta.name.toUpperCase()}</Text>
            <Text style={styles.agentDesc}>{meta.desc}</Text>
          </View>
        </View>

        <View style={styles.cardStatus}>
          {isRunning && (
            <MotiView
              from={{ opacity: 0.3 }}
              animate={{ opacity: 1 }}
              transition={{ loop: true, duration: 800, type: 'timing' }}
            >
              <Activity size={14} color="#fff" />
            </MotiView>
          )}
          {isCompleted && <CheckCircle size={14} color="#10b981" />}
          {isFailed && <AlertTriangle size={14} color="#ef4444" />}
          <View style={styles.chevron}>
            {expanded ? <ChevronUp size={14} color="#475569" /> : <ChevronDown size={14} color="#475569" />}
          </View>
        </View>
      </TouchableOpacity>

      <AnimatePresence>
        {expanded && (
          <MotiView
            from={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={styles.cardDetails}
          >
            {trace ? (
              <View style={styles.traceContainer}>
                {trace.planning && <ReasoningBlock label="PLANNING" content={trace.planning} icon={Info} />}
                {trace.reasoning && <ReasoningBlock label="REASONING" content={trace.reasoning} icon={TraceIcon} />}
                {trace.decision && <ReasoningBlock label="DECISION" content={trace.decision} icon={Code} />}
                {trace.action && <ReasoningBlock label="ACTION" content={trace.action} icon={Activity} />}
              </View>
            ) : (
              <Text style={styles.emptyTrace}>_ no reasoning data available for this cycle</Text>
            )}
          </MotiView>
        )}
      </AnimatePresence>
    </View>
  );
};

const ExecutionTerminal = ({ logs, isDark }) => {
  return (
    <View style={[styles.terminal, { backgroundColor: isDark ? '#020617' : '#0f172a' }]}>
      <View style={styles.terminalHeader}>
        <Terminal size={14} color="#475569" />
        <Text style={styles.terminalTitle}>SYSTEM KERNEL LOGS</Text>
      </View>
      <ScrollView
        style={styles.terminalScroll}
        contentContainerStyle={styles.terminalContent}
        nestedScrollEnabled
      >
        {logs.length === 0 ? (
          <Text style={styles.terminalEmpty}>_ awaiting orchestration triggers...</Text>
        ) : (
          logs.map((log, i) => (
            <View key={i} style={styles.logLine}>
              <Text style={styles.logPrompt}>{'>'}</Text>
              <Text style={styles.logText}>
                {log.agent && <Text style={styles.logAgent}>[{log.agent.toUpperCase()}] </Text>}
                {log.message}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const OrchestrationPanel = () => {
  const { activeAgents, logs, traces, theme } = useSelector(state => state.orchestration);
  const isDark = theme === 'dark';

  const agentKeys = Object.keys(AGENT_META);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: isDark ? '#020617' : '#f8fafc' }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <PipelineGraph />

      <View style={styles.sectionHeader}>
        <Layers size={16} color="#475569" />
        <Text style={styles.sectionTitle}>AGENT STACK</Text>
      </View>

      <View style={styles.stack}>
        {agentKeys.map(key => {
          const meta = AGENT_META[key];
          const status = activeAgents[meta.stateKey] || activeAgents[key] || 'idle';
          const trace = traces.find(t => t.agent === key || t.agent === meta.stateKey);

          return (
            <AgentCard
              key={key}
              agentKey={key}
              meta={meta}
              status={status}
              trace={trace}
              isDark={isDark}
            />
          );
        })}
      </View>

      <ExecutionTerminal logs={logs} isDark={isDark} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 60,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#475569',
    letterSpacing: 2,
  },
  stack: {
    gap: 12,
    marginBottom: 32,
  },
  agentCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardActive: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  cardInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  iconActive: {
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  agentName: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  agentDesc: {
    fontSize: 10,
    color: '#475569',
    marginTop: 2,
  },
  cardStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chevron: {
    marginLeft: 4,
  },
  cardDetails: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  traceContainer: {
    padding: 16,
    gap: 20,
  },
  reasoningBlock: {
    gap: 6,
  },
  reasoningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reasoningLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#475569',
    letterSpacing: 1,
  },
  reasoningText: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
    paddingLeft: 18,
  },
  emptyTrace: {
    padding: 16,
    fontSize: 10,
    color: '#334155',
    fontStyle: 'italic',
  },
  terminal: {
    borderRadius: 16,
    height: 240,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  terminalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  terminalTitle: {
    fontSize: 9,
    fontWeight: '900',
    color: '#475569',
    letterSpacing: 1.5,
  },
  terminalScroll: {
    flex: 1,
  },
  terminalContent: {
    padding: 16,
  },
  terminalEmpty: {
    fontSize: 11,
    color: '#1e293b',
    fontStyle: 'italic',
  },
  logLine: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  logPrompt: {
    fontSize: 11,
    color: '#475569',
    fontWeight: 'bold',
  },
  logText: {
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
    flex: 1,
  },
  logAgent: {
    color: '#64748b',
    fontWeight: '900',
  },
});

export default OrchestrationPanel;
