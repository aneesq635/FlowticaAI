import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { MotiView } from 'moti';
import { ChevronDown } from 'lucide-react-native';

const PipelineNode = ({ name, active, completed }) => {
  return (
    <View style={styles.nodeContainer}>
      <MotiView
        animate={{
          backgroundColor: active ? '#3b82f6' : completed ? '#1e293b' : 'rgba(30, 41, 59, 0.3)',
          borderColor: active ? '#60a5fa' : completed ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
          scale: active ? 1.05 : 1,
        }}
        style={styles.node}
      >
        <Text style={[
          styles.nodeText,
          { color: active || completed ? '#fff' : '#475569' }
        ]}>
          {name}
        </Text>
        {active && (
          <MotiView
            from={{ opacity: 0.3, scale: 1 }}
            animate={{ opacity: 0, scale: 1.5 }}
            transition={{ loop: true, duration: 1500, type: 'timing' }}
            style={styles.pulse}
          />
        )}
      </MotiView>
      <View style={styles.connector}>
        <ChevronDown size={16} color="rgba(255, 255, 255, 0.1)" />
      </View>
    </View>
  );
};

const PipelineGraph = () => {
  const { pipeline, activeAgents } = useSelector(state => state.orchestration);

  const nodes = [
    { id: 'intent', label: 'Intent Agent' },
    { id: 'extraction', label: 'Extraction Agent' },
    { id: 'matching', label: 'Matching Agent' },
    { id: 'pricing', label: 'Pricing Agent' },
    { id: 'scheduling', label: 'Scheduling Agent' },
    { id: 'booking', label: 'Booking Agent' },
    { id: 'followup', label: 'Follow-up Agent' },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LIVE PIPELINE</Text>
      <View style={styles.graph}>
        {nodes.map((node, index) => (
          <PipelineNode 
            key={node.id}
            name={node.label}
            active={pipeline === node.id}
            completed={activeAgents[node.id] === 'completed'}
          />
        ))}
        <View style={styles.finalNode}>
          <Text style={styles.finalNodeText}>User Satisfaction</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 24,
  },
  title: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#94a3b8',
    letterSpacing: 2,
    marginBottom: 20,
    textAlign: 'center',
  },
  graph: {
    alignItems: 'center',
  },
  nodeContainer: {
    alignItems: 'center',
    width: '100%',
  },
  node: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  nodeText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  pulse: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  connector: {
    paddingVertical: 8,
  },
  finalNode: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  finalNodeText: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: 'bold',
  }
});

export default PipelineGraph;
