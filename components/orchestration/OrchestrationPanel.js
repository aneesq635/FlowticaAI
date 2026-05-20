import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useSelector } from 'react-redux';
import { MotiView } from 'moti';
import {
  Activity, CheckCircle, Clock, AlertTriangle,
  Database, Cpu, MessageSquare, Settings,
  Terminal, Layers
} from 'lucide-react-native';

const AGENT_CONFIG = {
  'supervisor':    { name: 'Supervisor Agent',   desc: 'System brain — orchestrates the entire workflow', icon: Cpu,          color: '#f87171' },
  'intent':        { name: 'Intent Agent',        desc: 'Classifies user intent & goals',                 icon: Cpu,          color: '#f87171' },
  'extraction':    { name: 'Extraction Agent',    desc: 'Extracts structured entities from chat',         icon: Settings,     color: '#60a5fa' },
  'memory':        { name: 'Memory Agent',        desc: 'Syncs user profile & preferences',               icon: Database,     color: '#fbbf24' },
  'knowledge':     { name: 'Knowledge Agent',     desc: 'Retrieves providers from MongoDB RAG',           icon: Layers,       color: '#38bdf8' },
  'matching':      { name: 'Matching Agent',      desc: 'Ranks candidates via scoring engine',            icon: Database,     color: '#c084fc' },
  'booking':       { name: 'Booking Agent',       desc: 'Finalizes service transactions',                 icon: CheckCircle,  color: '#2dd4bf' },
  'scheduling':    { name: 'Scheduling Agent',    desc: 'Configures automated follow-ups',                icon: Clock,        color: '#4ade80' },
  'communication': { name: 'Frontier Agent',      desc: 'Dedicated user communication interface',         icon: MessageSquare,color: '#f472b6' },
};

const AgentCard = ({ agentKey, status, trace, isDark }) => {
  const config = AGENT_CONFIG[agentKey] || { name: agentKey, desc: 'AI Orchestration Agent', icon: Cpu, color: '#94a3b8' };
  const Icon = config.icon;

  const getStatusDisplay = () => {
    switch (status) {
      case 'running':   return { label: 'RUNNING',   color: '#fbbf24', icon: Activity      };
      case 'completed': return { label: 'COMPLETED', color: '#10b981', icon: CheckCircle   };
      case 'failed':    return { label: 'FAILED',    color: '#ef4444', icon: AlertTriangle };
      default:          return { label: 'IDLE',      color: '#64748b', icon: Clock         };
    }
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay.icon;

  const cardBg    = status === 'running'
    ? (isDark ? 'rgba(245,158,11,0.05)' : 'rgba(245,158,11,0.04)')
    : status === 'completed'
      ? (isDark ? 'transparent' : 'rgba(16,185,129,0.03)')
      : (isDark ? 'rgba(15,23,42,0.6)' : '#ffffff');

  const cardBorder = status === 'running'
    ? (isDark ? '#f59e0b' : '#fbbf24')
    : status === 'completed'
      ? (isDark ? '#10b981' : '#6ee7b7')
      : (isDark ? '#1e293b' : '#e2e8f0');

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 400 }}
      className="rounded-2xl p-4 mb-4"
      style={{ backgroundColor: cardBg, borderWidth: 1, borderColor: cardBorder }}
    >
      {/* Card Header */}
      <View className="flex-row items-center">
        {/* Icon */}
        <View
          className="w-10 h-10 rounded-xl items-center justify-center"
          style={{ backgroundColor: config.color + '18', position: 'relative' }}
        >
          <Icon size={20} color={config.color} />
          {status === 'running' && (
            <MotiView
              from={{ scale: 0.8, opacity: 0.3 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ loop: true, duration: 1500, type: 'timing' }}
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                borderRadius: 10, backgroundColor: config.color,
              }}
            />
          )}
        </View>

        {/* Info */}
        <View className="flex-1 ml-3">
          <Text
            className="text-sm font-bold tracking-wide"
            style={{ color: status === 'completed' ? '#10b981' : (isDark ? '#e2e8f0' : '#0f172a') }}
          >
            {config.name}{status === 'completed' ? '  ✓' : ''}
          </Text>
          <Text
            className="text-xs mt-0.5"
            style={{ color: isDark ? '#475569' : '#94a3b8' }}
          >
            {config.desc}
          </Text>
        </View>

        {/* Status Badge */}
        <View
          className="flex-row items-center px-2 py-1 rounded-lg gap-1"
          style={{
            backgroundColor: statusDisplay.color + '20',
            borderWidth: 1,
            borderColor: statusDisplay.color + '40',
          }}
        >
          <StatusIcon size={11} color={statusDisplay.color} />
          <Text className="text-xs font-bold" style={{ color: statusDisplay.color }}>
            {statusDisplay.label}
          </Text>
        </View>
      </View>

      {/* Trace */}
      {status === 'completed' && trace && (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 rounded-xl p-3"
          style={{
            backgroundColor: isDark ? '#0f172a' : '#f8fafc',
            borderWidth: 1,
            borderColor: isDark ? '#1e293b' : '#e2e8f0',
          }}
        >
          <Text className="text-xs font-semibold mb-2" style={{ color: '#10b981' }}>
            Execution Trace
          </Text>
          <Text className="text-xs leading-5" style={{ color: isDark ? '#94a3b8' : '#64748b' }} numberOfLines={4}>
            {trace.reasoning}
          </Text>
        </MotiView>
      )}
    </MotiView>
  );
};

const OrchestrationPanel = () => {
  const { activeAgents, logs, sharedState, traces, isWorkflowRunning, theme } = useSelector(state => state.orchestration);
  const isDark = theme === 'dark';

  const activeAgentOrder = [
    'supervisor', 'intent', 'extraction', 'memory',
    'knowledge', 'matching', 'booking', 'scheduling', 'communication',
  ];

  return (
    <ScrollView
      className={`flex-1 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}
      contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View className="flex-row items-center mb-3">
        <Cpu size={22} color="#a78bfa" />
        <Text
          className="text-xl font-black ml-3 tracking-tight"
          style={{ color: isDark ? '#f8fafc' : '#0f172a' }}
        >
          Agent Pipeline
        </Text>
      </View>

      {/* Divider */}
      <View
        className="h-px mb-5"
        style={{ backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }}
      />

      {/* Section Label */}
      <Text
        className="text-xs font-black tracking-widest mb-4 ml-1"
        style={{ color: isDark ? '#475569' : '#94a3b8' }}
      >
        LIVE AGENT STATUS
      </Text>

      {/* Agent Cards */}
      {activeAgentOrder.map((key) => {
        const status = activeAgents[key] || 'idle';
        const trace  = traces.find(t => t.agent === key);
        return (
          <AgentCard key={key} agentKey={key} status={status} trace={trace} isDark={isDark} />
        );
      })}

      {/* Empty State */}
      {!isWorkflowRunning && Object.values(activeAgents).every(v => v === 'idle') && (
        <View className="h-36 items-center justify-center">
          <View className={`w-14 h-14 rounded-2xl items-center justify-center mb-3 ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
            <Clock size={28} color={isDark ? '#1e293b' : '#cbd5e1'} />
          </View>
          <Text
            className="text-sm"
            style={{ color: isDark ? '#475569' : '#94a3b8' }}
          >
            Waiting for orchestration input...
          </Text>
        </View>
      )}

      {/* Execution Log */}
      <View className="flex-row items-center mt-8 mb-4 gap-2">
        <Terminal size={16} color={isDark ? '#475569' : '#94a3b8'} />
        <Text
          className="text-xs font-black tracking-widest"
          style={{ color: isDark ? '#475569' : '#94a3b8' }}
        >
          EXECUTION LOG
        </Text>
      </View>
      <View
        className="rounded-xl p-4"
        style={{
          backgroundColor: isDark ? '#020617' : '#ffffff',
          borderWidth: 1,
          borderColor: isDark ? '#1e293b' : '#e2e8f0',
        }}
      >
        {logs.length === 0 ? (
          <Text className="text-xs italic" style={{ color: isDark ? '#475569' : '#94a3b8' }}>
            No execution events recorded.
          </Text>
        ) : (
          logs.map((log, index) => (
            <View key={index} className="flex-row mb-2">
              <Text className="font-bold mr-2" style={{ color: '#fbbf24' }}>{'>'}</Text>
              <View className="flex-row flex-wrap flex-1">
                <Text className="text-xs font-bold" style={{ color: '#a78bfa' }}>
                  {log.agent || 'SYSTEM'}:{' '}
                </Text>
                <Text className="text-xs" style={{ color: isDark ? '#cbd5e1' : '#334155' }}>
                  {log.message}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Shared State */}
      <View className="flex-row items-center mt-8 mb-4 gap-2">
        <Layers size={16} color={isDark ? '#475569' : '#94a3b8'} />
        <Text
          className="text-xs font-black tracking-widest"
          style={{ color: isDark ? '#475569' : '#94a3b8' }}
        >
          SHARED STATE (LANGGRAPH)
        </Text>
      </View>
      <View
        className="rounded-xl p-4"
        style={{
          backgroundColor: isDark ? 'rgba(30,41,59,0.3)' : '#f1f5f9',
          borderWidth: 1,
          borderColor: isDark ? '#1e293b' : '#e2e8f0',
        }}
      >
        <Text
          className="text-xs"
          style={{ color: isDark ? '#60a5fa' : '#3b82f6', fontFamily: 'monospace' }}
        >
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

export default OrchestrationPanel;