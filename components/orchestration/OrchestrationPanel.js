import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  FlatList, Platform, Animated
} from 'react-native';
import { useSelector } from 'react-redux';
import { MotiView, AnimatePresence } from 'moti';
import {
  Cpu, Activity, CheckCircle, Clock, Database,
  Layers, Terminal, Zap, ChevronDown, ChevronUp,
  ShieldCheck, Search, MessageCircle, Handshake,
  Send, List, HardDrive, XCircle, AlertTriangle,
} from 'lucide-react-native';
import PipelineGraph from './PipelineGraph';

// ─────────────────────────────────────────────────────────────
//  AGENT REGISTRY
//  stateKey must match exactly what backend emits as agent name
// ─────────────────────────────────────────────────────────────
const AGENT_META = {
  supervisor:        { name: 'Supervisor',   stateKey: 'supervisor',           icon: Cpu,         desc: 'Workflow Controller'  },
  intent:            { name: 'Intent',       stateKey: 'intent',               icon: Zap,         desc: 'Goal Classification'  },
  extraction:        { name: 'Extraction',   stateKey: 'extraction',           icon: Search,      desc: 'Entity Parsing'       },
  memory:            { name: 'Memory',       stateKey: 'memory',               icon: Terminal,    desc: 'Context Recovery'     },
  knowledge:         { name: 'Retrieval',    stateKey: 'knowledge',            icon: Database,    desc: 'Knowledge RAG'        },
  matching:          { name: 'Matching',     stateKey: 'matching',             icon: Layers,      desc: 'Candidate Scoring'    },
  negotiation:       { name: 'Negotiation',  stateKey: 'negotiation',          icon: Handshake,   desc: 'Dynamic Pricing'      },
  request_creation:  { name: 'Proposal',     stateKey: 'request_creation',     icon: Send,        desc: 'Offer Generation'     },
  booking:           { name: 'Booking',      stateKey: 'booking',              icon: ShieldCheck, desc: 'Transaction Engine'   },
  scheduling:        { name: 'Scheduling',   stateKey: 'scheduling',           icon: Clock,       desc: 'Timeline Management'  },
  communication:     { name: 'Frontier',     stateKey: 'communication',        icon: MessageCircle, desc: 'User Interaction'   },
};

// Backend emits node names like 'intent', 'memory', etc.
// This helper resolves status regardless of capitalisation / spacing variants
const resolveStatus = (activeAgents, meta) => {
  return (
    activeAgents[meta.stateKey] ||
    activeAgents[meta.stateKey?.toLowerCase()] ||
    activeAgents[meta.name] ||
    activeAgents[meta.name?.toLowerCase()] ||
    activeAgents[`${meta.name} Agent`] ||
    'idle'
  );
};

// ─────────────────────────────────────────────────────────────
//  DERIVED OUTPUT from sharedState per agent
// ─────────────────────────────────────────────────────────────
const getAgentOutput = (agentKey, sharedState) => {
  switch (agentKey) {
    case 'intent':
      return sharedState.intent?.value
        ? `Intent → ${sharedState.intent.value.toUpperCase()}`
        : null;
    case 'extraction': {
      const e = sharedState.entities || {};
      const keys = Object.keys(e);
      return keys.length > 0 ? `Entities: ${keys.join(' · ')}` : null;
    }
    case 'knowledge': {
      const svcs = sharedState.metadata?.available_services || [];
      return svcs.length > 0 ? `${svcs.length} service categories found` : null;
    }
    case 'matching': {
      const p = sharedState.shortlisted_providers || [];
      return p.length > 0 ? `${p.length} providers shortlisted` : null;
    }
    case 'booking': {
      const o = sharedState.booking_outcome || {};
      if (o.booking_success) return `Confirmed · ID ${o.booking_id?.slice(0, 8)}`;
      if (o.booking_failure) return `Rejected · ${o.booking_failure_reason}`;
      return null;
    }
    case 'request_creation':
      return sharedState.active_request_id
        ? `Request · ${sharedState.active_request_id.slice(0, 8)}`
        : null;
    case 'negotiation':
      return sharedState.latest_request_status
        ? `Status → ${sharedState.latest_request_status.toUpperCase()}`
        : null;
    case 'memory':
      // Only show if explicitly resumed — not on fresh sessions
      return sharedState.metadata?.is_resumed === true
        ? 'Context restored from memory'
        : null;
    case 'communication':
      return sharedState.frontier_response
        ? `"${sharedState.frontier_response.slice(0, 72)}…"`
        : null;
    default:
      return null;
  }
};

// ─────────────────────────────────────────────────────────────
//  STATUS DOT
// ─────────────────────────────────────────────────────────────
const StatusDot = ({ status }) => {
  const color =
    status === 'running'   ? 'bg-white'       :
    status === 'completed' ? 'bg-emerald-400'  :
    status === 'failed'    ? 'bg-red-400'      :
    'bg-slate-600';

  return (
    <View className={`w-1.5 h-1.5 rounded-full ${color}`} />
  );
};

// ─────────────────────────────────────────────────────────────
//  RUNTIME AGENT LIST (left column)
// ─────────────────────────────────────────────────────────────
const AgentStatusList = ({ activeAgents, isDark }) => (
  <View className={`rounded-2xl p-4 border ${
    isDark ? 'bg-white/[0.02] border-white/5' : 'bg-white border-slate-100'
  }`}>
    <View className="flex-row items-center gap-2 mb-3">
      <List size={10} color="#64748b" />
      <Text className="text-[9px] font-black tracking-[2px] text-slate-500">AGENT PIPELINE</Text>
    </View>

    {Object.entries(AGENT_META).map(([key, meta]) => {
      const status = resolveStatus(activeAgents, meta);
      const labelColor =
        status === 'running'   ? (isDark ? 'text-white'         : 'text-slate-900') :
        status === 'completed' ? 'text-emerald-400'                                  :
        status === 'failed'    ? 'text-red-400'                                      :
        (isDark ? 'text-slate-500' : 'text-slate-400');

      const badgeColor =
        status === 'running'   ? 'text-white'       :
        status === 'completed' ? 'text-emerald-400'  :
        status === 'failed'    ? 'text-red-400'      :
        'text-slate-600';

      return (
        <View key={key} className={`flex-row items-center justify-between py-2 border-b ${
          isDark ? 'border-white/[0.03]' : 'border-slate-50'
        }`}>
          <View className="flex-row items-center gap-2.5">
            <StatusDot status={status} />
            <Text className={`text-[11px] font-semibold ${labelColor}`}>{meta.name}</Text>
          </View>
          <Text className={`text-[8px] font-black tracking-wider ${badgeColor}`}>
            {status.toUpperCase()}
          </Text>
        </View>
      );
    })}
  </View>
);

// ─────────────────────────────────────────────────────────────
//  SHARED STATE PANEL (left column, collapsible)
// ─────────────────────────────────────────────────────────────
const CORE_KEYS = [
  'workflow_stage', 'conversation_stage',
  'latest_request_status', 'retrieval_confidence',
  'iteration_count', 'active_request_id',
];

const SharedStatePanel = ({ state, isDark }) => {
  const [open, setOpen] = useState(true);

  const fmt = (v) => {
    if (v === undefined || v === null) return '—';
    if (typeof v === 'object') return Array.isArray(v) ? `[${v.length}]` : '{…}';
    return String(v);
  };

  return (
    <View className={`rounded-2xl p-4 border ${
      isDark ? 'bg-white/[0.02] border-white/5' : 'bg-white border-slate-100'
    }`}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setOpen(o => !o)}
        className="flex-row items-center gap-2"
      >
        <HardDrive size={10} color="#64748b" />
        <Text className="text-[9px] font-black tracking-[2px] text-slate-500 flex-1">
          SHARED STATE
        </Text>
        {open
          ? <ChevronUp size={10} color="#64748b" />
          : <ChevronDown size={10} color="#64748b" />}
      </TouchableOpacity>

      <AnimatePresence>
        {open && (
          <MotiView
            from={{ opacity: 0, translateY: -4 }}
            animate={{ opacity: 1, translateY: 0 }}
            exit={{ opacity: 0, translateY: -4 }}
            transition={{ type: 'timing', duration: 180 }}
            className="mt-3 gap-2"
          >
            {CORE_KEYS.map(k => (
              <View key={k} className="flex-row justify-between gap-3">
                <Text
                  className="text-[9px] text-slate-600"
                  style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
                >
                  {k}
                </Text>
                <Text
                  className="text-[9px] text-slate-400 font-semibold flex-1 text-right"
                  numberOfLines={1}
                  style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
                >
                  {fmt(state[k])}
                </Text>
              </View>
            ))}
            <View className={`h-px my-1 ${isDark ? 'bg-white/[0.03]' : 'bg-slate-100'}`} />
            <Text className="text-[8px] text-slate-600 italic text-center">
              +{Object.keys(state).length} parameters in state
            </Text>
          </MotiView>
        )}
      </AnimatePresence>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
//  AGENT EXECUTION CARD (right column)
// ─────────────────────────────────────────────────────────────
const AgentCard = ({ agentKey, meta, status, trace, output, isDark }) => {
  const Icon = meta.icon || Cpu;
  const isRunning   = status === 'running';
  const isCompleted = status === 'completed';
  const isFailed    = status === 'failed';

  // Only render if there is something to show
  if (status === 'idle' && !output && !trace?.reasoning) return null;

  const ts = trace?.timestamp
    ? new Date(trace.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 220 }}
      className={`rounded-2xl border mb-3 overflow-hidden ${
        isRunning
          ? 'border-white bg-white/5'
          : isDark
            ? 'border-white/5 bg-white/[0.02]'
            : 'border-slate-100 bg-white'
      }`}
    >
      {/* Card header */}
      <View className="flex-row items-center justify-between px-4 pt-3.5 pb-2">
        <View className="flex-row items-center gap-3">
          {/* Icon */}
          <View className={`w-8 h-8 rounded-xl items-center justify-center ${
            isRunning ? 'bg-white' : isDark ? 'bg-white/5' : 'bg-slate-50'
          }`}>
            <Icon
              size={15}
              color={isRunning ? '#0f172a' : isCompleted ? '#34d399' : '#64748b'}
              strokeWidth={isRunning ? 2.5 : 2}
            />
          </View>
          {/* Name + status */}
          <View>
            <View className="flex-row items-center gap-1.5">
              <Text className={`text-[12px] font-black ${
                isDark ? 'text-slate-100' : 'text-slate-900'
              }`}>
                {meta.name}
              </Text>
              {isCompleted && <CheckCircle size={9} color="#34d399" />}
              {isFailed    && <XCircle    size={9} color="#f87171" />}
              {isRunning   && (
                <View className="w-1 h-1 rounded-full bg-white animate-pulse" />
              )}
            </View>
            <Text className={`text-[8px] font-bold tracking-wider mt-0.5 ${
              isRunning   ? 'text-white/60'  :
              isCompleted ? 'text-emerald-400' :
              isFailed    ? 'text-red-400'   :
              'text-slate-500'
            }`}>
              {status.toUpperCase()} · {meta.desc}
            </Text>
          </View>
        </View>

        {ts && (
          <Text
            className="text-[8px] text-slate-600"
            style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
          >
            {ts}
          </Text>
        )}
      </View>

      {/* Output box */}
      {(output || trace?.reasoning) && (
        <View className={`mx-3 mb-3 px-3 py-2.5 rounded-xl ${
          isDark ? 'bg-black/20' : 'bg-slate-50'
        }`}>
          <View className="flex-row items-center gap-1.5 mb-1.5">
            <Activity size={8} color="#475569" />
            <Text className="text-[7px] font-black tracking-[1.5px] text-slate-500">OUTPUT</Text>
          </View>
          <Text className={`text-[11px] leading-[17px] font-medium ${
            isDark ? 'text-slate-300' : 'text-slate-600'
          }`}>
            {output || trace?.reasoning}
          </Text>
        </View>
      )}
    </MotiView>
  );
};

// ─────────────────────────────────────────────────────────────
//  EXECUTION TERMINAL (bottom)
// ─────────────────────────────────────────────────────────────
const ExecutionTerminal = ({ logs, isDark }) => {
  const scrollRef = useRef(null);

  // Backend sends: { level, message } or { agent, action, reasoning, timestamp }
  const normalizeLog = (log) => {
    if (log.message) return { time: log.timestamp, agent: log.agent, text: log.message, level: log.level };
    if (log.action)  return { time: log.timestamp, agent: log.agent, text: `${log.action}: ${log.reasoning}`, level: 'info' };
    return { time: log.timestamp, agent: null, text: JSON.stringify(log), level: 'info' };
  };

  const levelColor = (lvl) => {
    switch (lvl) {
      case 'success': return 'text-emerald-400';
      case 'error':   return 'text-red-400';
      case 'warning': return 'text-amber-400';
      default:        return 'text-slate-400';
    }
  };

  return (
    <View className={`rounded-2xl overflow-hidden border ${
      isDark ? 'bg-[#020617] border-white/5' : 'bg-slate-900 border-transparent'
    }`} style={{ height: 220 }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.02]">
        <View className="flex-row items-center gap-2">
          <Terminal size={11} color="#64748b" />
          <Text className="text-[9px] font-black tracking-[2px] text-slate-500">
            KERNEL LOGS
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <Text className="text-[8px] font-black text-emerald-400 tracking-wider">LIVE</Text>
        </View>
      </View>

      {/* Logs */}
      <ScrollView
        ref={scrollRef}
        className="flex-1"
        contentContainerStyle={{ padding: 12 }}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {logs.length === 0 ? (
          <Text
            className="text-[10px] text-slate-700"
            style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
          >
            {'> Awaiting orchestration events...'}
          </Text>
        ) : (
          logs.map((raw, i) => {
            const log = normalizeLog(raw);
            return (
              <View key={i} className="flex-row gap-2.5 mb-1.5">
                {log.time && (
                  <Text
                    className="text-[8px] text-slate-600 mt-0.5"
                    style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
                  >
                    {new Date(log.time).toLocaleTimeString([], {
                      hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })}
                  </Text>
                )}
                <Text
                  className={`text-[10px] flex-1 ${levelColor(log.level)}`}
                  style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
                >
                  {log.agent && (
                    <Text className="text-white font-black">{log.agent.toUpperCase()} </Text>
                  )}
                  {log.text}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────
//  MAIN ORCHESTRATION PANEL
// ─────────────────────────────────────────────────────────────
const OrchestrationPanel = () => {
  const { activeAgents, logs, traces, theme, sharedState } = useSelector(
    s => s.orchestration
  );
  const isDark = theme === 'dark';

  const sortedTraces = useMemo(
    () => [...traces].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    [traces]
  );

  const agentKeys = Object.keys(AGENT_META);

  return (
    <ScrollView
      className={`flex-1 ${isDark ? 'bg-[#020617]' : 'bg-slate-50'}`}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      {/* ── Pipeline strip ── */}
      <PipelineGraph />

      {/* ── Two-column layout ── */}
      <View className="px-4 gap-4">

        {/* LEFT: Agent list + shared state */}
        <View className="gap-3">
          <AgentStatusList activeAgents={activeAgents} isDark={isDark} />
          <SharedStatePanel state={sharedState} isDark={isDark} />
        </View>

        {/* RIGHT: Execution stack */}
        <View>
          <View className="flex-row items-center gap-2 mb-3">
            <Layers size={10} color="#64748b" />
            <Text className="text-[9px] font-black tracking-[2px] text-slate-500">
              EXECUTION STACK
            </Text>
          </View>

          {agentKeys.map(key => {
            const meta   = AGENT_META[key];
            const status = resolveStatus(activeAgents, meta);
            const trace  = sortedTraces.find(
              t =>
                t.agent === key ||
                t.agent === meta.stateKey ||
                t.agent?.toLowerCase() === meta.name.toLowerCase()
            );
            const output = getAgentOutput(key, sharedState);

            return (
              <AgentCard
                key={key}
                agentKey={key}
                meta={meta}
                status={status}
                trace={trace}
                output={output}
                isDark={isDark}
              />
            );
          })}

          {/* Empty state */}
          {sortedTraces.length === 0 && (
            <View className="h-40 items-center justify-center gap-3">
              <Activity size={28} color={isDark ? '#1e293b' : '#e2e8f0'} />
              <Text className="text-[11px] text-slate-600 italic">
                Awaiting pipeline execution…
              </Text>
            </View>
          )}
        </View>

        {/* BOTTOM: Kernel logs */}
        <ExecutionTerminal logs={logs} isDark={isDark} />

      </View>
    </ScrollView>
  );
};

export default OrchestrationPanel;