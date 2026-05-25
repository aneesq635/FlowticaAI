import React, { useRef, useMemo, useEffect } from 'react';
import {
  View, Text, Animated, StyleSheet, Dimensions, useWindowDimensions,
} from 'react-native';
import { useSelector } from 'react-redux';
import { MotiView } from 'moti';
import {
  Cpu, Zap, Database, Layers, ShieldCheck,
  Search, Clock, MessageCircle, Terminal, Handshake, Send,
  Activity,
} from 'lucide-react-native';

const { width: SW } = Dimensions.get('window');
const NODE_W   = 80;   // clickable node width
const SPACING  = 130;  // distance between node centres

const AGENTS = [
  { id: 'supervisor',       stateKey: 'supervisor',           label: 'Supervisor', icon: Cpu          },
  { id: 'intent',           stateKey: 'intent',               label: 'Intent',     icon: Zap          },
  { id: 'extraction',       stateKey: 'extraction',           label: 'Extraction', icon: Search       },
  { id: 'memory',           stateKey: 'memory',               label: 'Memory',     icon: Terminal     },
  { id: 'knowledge',        stateKey: 'knowledge',            label: 'Retrieval',  icon: Database     },
  { id: 'matching',         stateKey: 'matching',             label: 'Matching',   icon: Layers       },
  { id: 'negotiation',      stateKey: 'negotiation',          label: 'Negotiation',icon: Handshake    },
  { id: 'request_creation', stateKey: 'request_creation',     label: 'Proposal',   icon: Send         },
  { id: 'booking',          stateKey: 'booking',              label: 'Booking',    icon: ShieldCheck  },
  { id: 'scheduling',       stateKey: 'scheduling',           label: 'Scheduling', icon: Clock        },
  { id: 'communication',    stateKey: 'communication',        label: 'Frontier',   icon: MessageCircle},
];

// ── Connector line between two nodes ────────────────────────
const Connector = ({ done, active }) => (
  <View className="justify-center items-center" style={{ width: SPACING - NODE_W, marginHorizontal: -6 }}>
    {/* Base line */}
    <View
      className={`rounded-full ${done ? 'bg-emerald-400' : 'bg-white/5'}`}
      style={{ width: '100%', height: done ? 2 : 1 }}
    />
    {/* Moving pulse */}
    {active && (
      <MotiView
        from={{ left: -24, opacity: 0 }}
        animate={{ left: SPACING - NODE_W - 16, opacity: 1 }}
        transition={{ loop: true, type: 'timing', duration: 1200 }}
        style={{
          position: 'absolute',
          width: 24, height: 2,
          borderRadius: 1,
          backgroundColor: '#fff',
          shadowColor: '#fff',
          shadowRadius: 6,
          shadowOpacity: 1,
        }}
      />
    )}
  </View>
);

// ── Single pipeline node ─────────────────────────────────────
const PipelineNode = ({ agent, status, isActive, isDark }) => {
  const Icon        = agent.icon;
  const isRunning   = isActive || status === 'running';
  const isCompleted = status === 'completed';

  return (
    <View className="items-center" style={{ width: NODE_W }}>
      <MotiView
        animate={{
          scale:      isRunning ? 1.18 : 1,
          translateY: isRunning ? -8    : 0,
          opacity:    isRunning || isCompleted ? 1 : 0.4,
        }}
        transition={{ type: 'spring', damping: 14, stiffness: 160 }}
        className={`w-[54px] h-[54px] rounded-[18px] items-center justify-center border-2 ${
          isRunning
            ? 'bg-white border-white'
            : isCompleted
              ? 'border-emerald-400'
              : 'border-white/10'
        } ${!isRunning && !isCompleted ? (isDark ? 'bg-white/[0.04]' : 'bg-white') : ''}`}
        style={isRunning ? {
          shadowColor: '#fff',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.25,
          shadowRadius: 12,
          elevation: 8,
        } : isCompleted ? {
          shadowColor: '#34d399',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 4,
        } : {}}
      >
        <Icon
          size={22}
          color={isRunning ? '#0f172a' : isCompleted ? '#34d399' : '#64748b'}
          strokeWidth={isRunning ? 2.5 : 2}
        />
      </MotiView>

      {/* Label */}
      <MotiView
        animate={{ opacity: isRunning ? 1 : 0.6, translateY: isRunning ? -4 : 0 }}
        transition={{ type: 'timing', duration: 200 }}
        className="items-center mt-2.5"
      >
        <Text
          className={`text-[9px] tracking-[0.8px] ${
            isRunning
              ? 'font-black text-white'
              : isCompleted
                ? 'font-bold text-emerald-400'
                : isDark ? 'font-semibold text-slate-500' : 'font-semibold text-slate-400'
          }`}
        >
          {agent.label.toUpperCase()}
        </Text>
        {isRunning && (
          <Text className="text-[7px] font-black text-white/50 tracking-widest mt-0.5">
            ACTIVE
          </Text>
        )}
      </MotiView>
    </View>
  );
};

// ── Main Pipeline Graph ──────────────────────────────────────
const PipelineGraph = () => {
  const { activeAgents, theme } = useSelector(s => s.orchestration);
  const isDark   = theme === 'dark';
  const { width } = useWindowDimensions();
  const listRef   = useRef(null);
  const scrollX   = useRef(new Animated.Value(0)).current;

  // Find the running agent index
  const activeIndex = useMemo(() => {
    const idx = AGENTS.findIndex(a =>
      activeAgents[a.stateKey] === 'running' ||
      activeAgents[a.id]       === 'running'
    );
    return idx === -1 ? 0 : idx;
  }, [activeAgents]);

  // Auto-scroll to active node
  useEffect(() => {
    if (listRef.current) {
      try {
        listRef.current.scrollToIndex({
          index:        activeIndex,
          animated:     true,
          viewPosition: 0.5,
        });
      } catch (_) { /* guard against not-yet-mounted */ }
    }
  }, [activeIndex]);

  const renderItem = ({ item, index }) => {
    const status      = activeAgents[item.stateKey] || activeAgents[item.id] || 'idle';
    const isActive    = index === activeIndex;
    const isDone      = status === 'completed' || index < activeIndex;

    return (
      <View className="flex-row items-center" style={{ width: SPACING }}>
        <PipelineNode agent={item} status={status} isActive={isActive} isDark={isDark} />
        {index < AGENTS.length - 1 && <Connector done={isDone} active={isActive} />}
      </View>
    );
  };

  return (
    <View
      className={`border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}
      style={{ height: 180, justifyContent: 'center' }}
    >
      {/* Header row */}
      <View className="flex-row items-center gap-2 px-5 mb-5">
        <Activity size={10} color="#64748b" />
        <Text className="text-[9px] font-black tracking-[2.5px] text-slate-500">
          ORCHESTRATION ENGINE RUNTIME
        </Text>
      </View>

      <Animated.FlatList
        ref={listRef}
        data={AGENTS}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: width / 2 - NODE_W / 2, alignItems: 'center' }}
        snapToInterval={SPACING}
        decelerationRate="fast"
        scrollEventThrottle={16}
        initialScrollIndex={activeIndex}
        getItemLayout={(_, index) => ({ length: SPACING, offset: SPACING * index, index })}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
      />
    </View>
  );
};

export default PipelineGraph;