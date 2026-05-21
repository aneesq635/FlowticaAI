import React, { useEffect, useRef } from 'react';
import { View, Text, ScrollView, Animated, Easing, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { MotiView, AnimatePresence } from 'moti';
import {
  User, Cpu, Zap, Database, Layers,
  CheckCircle, MessageSquare, ArrowRight, ShieldCheck,
  Search, Calculator, Clock, MessageCircle, AlertCircle
} from 'lucide-react-native';

const NODE_WIDTH = 140;
const CONNECTOR_WIDTH = 60;

const AnimatedPath = ({ active }) => {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (active) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 2,
            duration: 0,
            useNativeDriver: true,
          })
        ])
      ).start();
    } else {
      pulseAnim.setValue(0);
    }
  }, [active]);

  const translateX = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-CONNECTOR_WIDTH, CONNECTOR_WIDTH],
  });

  return (
    <View style={styles.connectorContainer}>
      <View style={[styles.connectorLine, { backgroundColor: active ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)' }]} />
      {active && (
        <Animated.View
          style={[
            styles.pulseContainer,
            { transform: [{ translateX }] }
          ]}
        >
          <View style={styles.pulseNode} />
        </Animated.View>
      )}
    </View>
  );
};

const PipelineNode = ({ name, icon: Icon, active, completed, isDark, type = 'agent' }) => {
  const isBoundary = type === 'boundary';

  const bgColor = active
    ? (isDark ? '#0f172a' : '#f8fafc')
    : completed
      ? (isDark ? '#021e16' : '#ecfdf5')
      : (isDark ? 'rgba(15,23,42,0.6)' : '#ffffff');

  const borderColor = active
    ? '#ffffff'
    : completed
      ? '#10b981'
      : (isDark ? 'rgba(255,255,255,0.1)' : '#e2e8f0');

  return (
    <View style={styles.nodeWrapper}>
      <MotiView
        animate={{
          scale: active ? 1.05 : 1,
          borderColor: borderColor,
        }}
        transition={{ type: 'timing', duration: 400 }}
        style={[
          styles.nodeCircle,
          {
            backgroundColor: bgColor,
            borderWidth: 1.5,
            width: isBoundary ? 60 : 100,
            height: isBoundary ? 60 : 100,
            borderRadius: isBoundary ? 30 : 20,
          }
        ]}
      >
        <Icon size={isBoundary ? 24 : 32} color={active ? '#fff' : (completed ? '#10b981' : '#475569')} />

        {active && (
          <MotiView
            from={{ opacity: 0.5, scale: 1 }}
            animate={{ opacity: 0, scale: 1.4 }}
            transition={{ loop: true, duration: 2000, type: 'timing' }}
            style={[StyleSheet.absoluteFill, styles.activeGlow, { borderRadius: isBoundary ? 30 : 20 }]}
          />
        )}
      </MotiView>
      <Text
        numberOfLines={1}
        style={[
          styles.nodeLabel,
          { color: active ? '#fff' : (isDark ? '#94a3b8' : '#475569') }
        ]}
      >
        {name.toUpperCase()}
      </Text>
      {active && (
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={styles.activeTag}
        >
          <Text style={styles.activeText}>RUNNING</Text>
        </MotiView>
      )}
    </View>
  );
};

const PipelineGraph = () => {
  const { pipeline, activeAgents } = useSelector(state => state.orchestration);
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';

  // Comprehensive Agent List mapped to Redux State Keys
  const agents = [
    { id: 'supervisor', stateKey: 'Supervisor', label: 'Supervisor', icon: Cpu },
    { id: 'intent', stateKey: 'Intent Agent', label: 'Intent', icon: Zap },
    { id: 'extraction', stateKey: 'Extraction Agent', label: 'Extraction', icon: Search },
    { id: 'knowledge', stateKey: 'Knowledge Agent', label: 'Knowledge', icon: Database },
    { id: 'matching', stateKey: 'Matching Agent', label: 'Matching', icon: Layers },
    { id: 'pricing', stateKey: 'Pricing Agent', label: 'Pricing', icon: Calculator },
    { id: 'booking', stateKey: 'Booking Agent', label: 'Booking', icon: ShieldCheck },
    { id: 'scheduling', stateKey: 'Scheduling Agent', label: 'Scheduling', icon: Clock },
    { id: 'followup', stateKey: 'Follow-up Agent', label: 'Support', icon: MessageCircle },
  ];

  const getAgentStatus = (agent) => {
    // Check both lowercase and exact state key
    return activeAgents[agent.stateKey] || activeAgents[agent.id] || 'idle';
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? 'rgba(2,6,23,0.3)' : '#f1f5f9' }]}>
      <View style={styles.header}>
        <View style={styles.headerDot} />
        <Text style={styles.headerTitle}>ORCHESTRATION ENGINE NODES</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* User Input Boundary */}
        <PipelineNode
          name="User"
          icon={User}
          type="boundary"
          completed={Object.values(activeAgents).some(v => v === 'completed' || v === 'running')}
          isDark={isDark}
        />

        <AnimatedPath active={getAgentStatus(agents[0]) === 'running' || pipeline === agents[0].id} />

        {/* Dynamic Agent Nodes */}
        {agents.map((agent, index) => {
          const status = getAgentStatus(agent);
          const nextAgent = agents[index + 1];
          const isActive = pipeline === agent.id || status === 'running';

          return (
            <React.Fragment key={agent.id}>
              <PipelineNode
                name={agent.label}
                icon={agent.icon}
                active={isActive}
                completed={status === 'completed'}
                isDark={isDark}
              />
              {index < agents.length - 1 && (
                <AnimatedPath
                  active={
                    (status === 'completed' && getAgentStatus(nextAgent) === 'running') ||
                    (pipeline === nextAgent.id)
                  }
                />
              )}
            </React.Fragment>
          );
        })}

        <AnimatedPath active={getAgentStatus(agents[agents.length - 1]) === 'completed'} />

        {/* Output Boundary */}
        <PipelineNode
          name="Result"
          icon={CheckCircle}
          type="boundary"
          completed={getAgentStatus(agents[agents.length - 1]) === 'completed'}
          isDark={isDark}
        />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    gap: 10,
  },
  headerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    shadowColor: '#fff',
    shadowRadius: 10,
    shadowOpacity: 0.5,
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94a3b8',
    letterSpacing: 2,
  },
  scrollContent: {
    alignItems: 'center',
    paddingRight: 40,
  },
  nodeWrapper: {
    alignItems: 'center',
    width: 100,
  },
  nodeCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  activeGlow: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  nodeLabel: {
    marginTop: 12,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  activeTag: {
    position: 'absolute',
    top: -24,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeText: {
    fontSize: 8,
    fontWeight: '900',
    color: '#0f172a',
  },
  connectorContainer: {
    width: CONNECTOR_WIDTH,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: -10,
  },
  connectorLine: {
    width: '100%',
    height: 2,
    borderRadius: 1,
  },
  pulseContainer: {
    position: 'absolute',
    width: CONNECTOR_WIDTH,
    height: 10,
    justifyContent: 'center',
  },
  pulseNode: {
    width: 8,
    height: 2,
    backgroundColor: '#fff',
    borderRadius: 1,
    shadowColor: '#fff',
    shadowRadius: 10,
    shadowOpacity: 1,
  },
});

export default PipelineGraph;