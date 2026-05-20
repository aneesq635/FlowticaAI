import React from 'react';
import { View, Text } from 'react-native';
import { useSelector } from 'react-redux';
import { MotiView } from 'moti';
import { ChevronDown, Zap } from 'lucide-react-native';

const PipelineNode = ({ name, active, completed, isDark, isLast }) => {
  const bgColor = active
    ? (isDark ? '#1e3a5f' : '#eff6ff')
    : completed
      ? (isDark ? '#0d2b1f' : '#f0fdf4')
      : (isDark ? 'rgba(30,41,59,0.4)' : 'rgba(241,245,249,0.9)');

  const borderColor = active
    ? '#3b82f6'
    : completed
      ? '#10b981'
      : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)');

  const textColor = active
    ? (isDark ? '#93c5fd' : '#1d4ed8')
    : completed
      ? '#10b981'
      : (isDark ? '#475569' : '#94a3b8');

  return (
    <View className="items-center w-full">
      <MotiView
        animate={{ scale: active ? 1.02 : 1 }}
        transition={{ type: 'timing', duration: 300 }}
        className="w-full rounded-xl py-3 px-4 items-center justify-center"
        style={{ backgroundColor: bgColor, borderWidth: 1, borderColor, position: 'relative', overflow: 'hidden' }}
      >
        <Text className="text-sm font-semibold tracking-wide" style={{ color: textColor }}>
          {name}{completed ? '  ✓' : ''}
        </Text>

        {active && (
          <MotiView
            from={{ opacity: 0.4, scale: 1 }}
            animate={{ opacity: 0, scale: 1.6 }}
            transition={{ loop: true, duration: 1500, type: 'timing' }}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              borderRadius: 12, borderWidth: 2, borderColor: '#3b82f6',
            }}
          />
        )}
      </MotiView>

      {!isLast && (
        <View className="py-1.5">
          <ChevronDown size={15} color={isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'} />
        </View>
      )}
    </View>
  );
};

const PipelineGraph = () => {
  const { pipeline, activeAgents } = useSelector(state => state.orchestration);
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';

  const nodes = [
    { id: 'intent',      label: 'Intent Agent'      },
    { id: 'extraction',  label: 'Extraction Agent'  },
    { id: 'matching',    label: 'Matching Agent'     },
    { id: 'pricing',     label: 'Pricing Agent'      },
    { id: 'scheduling',  label: 'Scheduling Agent'   },
    { id: 'booking',     label: 'Booking Agent'      },
    { id: 'followup',    label: 'Follow-up Agent'    },
  ];

  return (
    <View
      className="mb-6 p-5 rounded-2xl"
      style={{
        backgroundColor: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(248,250,252,0.9)',
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)',
      }}
    >
      {/* Header Badge */}
      <View
        className="self-start flex-row items-center px-3 py-1.5 rounded-full mb-5"
        style={{
          backgroundColor: isDark ? '#0f172a' : '#f1f5f9',
          borderWidth: 1,
          borderColor: isDark ? '#1e293b' : '#e2e8f0',
        }}
      >
        <Zap size={12} color={isDark ? '#94a3b8' : '#64748b'} />
        <Text
          className="ml-2 text-xs font-black uppercase tracking-widest"
          style={{ color: isDark ? '#64748b' : '#94a3b8' }}
        >
          Live Pipeline
        </Text>
      </View>

      {/* Nodes */}
      <View className="items-center w-full">
        {nodes.map((node, index) => (
          <PipelineNode
            key={node.id}
            name={node.label}
            active={pipeline === node.id}
            completed={activeAgents[node.id] === 'completed'}
            isDark={isDark}
            isLast={index === nodes.length - 1}
          />
        ))}

        {/* Final Node */}
        <View className="mt-3">
          <View
            className="px-5 py-2 rounded-full"
            style={{
              backgroundColor: isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.08)',
              borderWidth: 1,
              borderColor: isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.25)',
            }}
          >
            <Text className="text-xs font-black" style={{ color: '#10b981' }}>
              User Satisfaction
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default PipelineGraph;