import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, 
  GitMerge, 
  Search, 
  Calculator, 
  CalendarCheck, 
  Bot, 
  Database, 
  Zap, 
  ShieldCheck, 
  Workflow, 
  Layers, 
  Activity,
  Code,
  Globe,
  Star,
  Clock,
  ChevronRight,
  Sparkles
} from 'lucide-react-native';
import { useSelector } from 'react-redux';
import { MotiView } from 'moti';
import { Typography } from '../../../components/ui/Typography';
import { Card } from '../../../components/ui/Card';

const AgentCard = ({ name, role, icon: Icon, description, delay = 0 }) => {
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';
  return (
    <MotiView
      from={{ opacity: 0, translateX: -20 }}
      animate={{ opacity: 1, translateX: 0 }}
      transition={{ type: 'timing', duration: 800, delay }}
      className="mb-4"
    >
      <Card className="flex-row items-center p-4">
        <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${isDark ? 'bg-blue-600/10' : 'bg-blue-50'}`}>
          <Icon size={20} color="#3b82f6" />
        </View>
        <View className="flex-1">
          <Typography variant="h4" className="text-sm">{name}</Typography>
          <Typography variant="xs" className="text-blue-600 mb-1">{role}</Typography>
          <Typography variant="body" className="text-xs opacity-60">{description}</Typography>
        </View>
      </Card>
    </MotiView>
  );
};

const SectionHeader = ({ title, subtitle }) => (
  <View className="mb-8 mt-12">
    <Typography variant="h2" className="mb-2">{title}</Typography>
    <Typography variant="body" className="opacity-60">{subtitle}</Typography>
  </View>
);

export default function AboutScreen() {
  const router = useRouter();
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';

  return (
    <SafeAreaView 
      className={`flex-1 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}
      edges={['bottom']}
    >
      {/* Header handled by root layout, but we can add a local one if needed or just use scroll space */}
      
      <ScrollView 
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
      >
        <View className="pt-10 pb-20">
          <MotiView
            from={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 1000 }}
          >
            <View className={`inline-flex self-start flex-row items-center px-4 py-2 rounded-full border mb-6 ${isDark ? 'bg-blue-600/10 border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}>
              <Zap size={14} color="#3b82f6" />
              <Typography variant="xs" className="text-blue-600 ml-2 font-black">Architecture Deep-Dive</Typography>
            </View>
            <Typography variant="h1" className="mb-6">The Future of {"\n"}Agentic Commerce</Typography>
            <Typography variant="body" className="opacity-70 leading-7">
              Flowtica AI isn't just a marketplace; it's a multi-agent orchestration engine that transforms how services are discovered, quoted, and booked.
            </Typography>
          </MotiView>

          {/* Core Agents Section */}
          <SectionHeader 
            title="The Multi-Agent Pipeline" 
            subtitle="Specialized agents working in a shared state workflow." 
          />
          <AgentCard 
            name="Intent Extraction Agent" 
            role="Natural Language Processor"
            icon={Search}
            description="Parses complex queries in Urdu, English, and more to extract structured intent data."
            delay={100}
          />
          <AgentCard 
            name="Knowledge Agent (RAG)" 
            role="Data Specialist"
            icon={Database}
            description="Performs semantic search across the MongoDB Atlas collection to retrieve best-fit providers."
            delay={200}
          />
          <AgentCard 
            name="Matching Agent" 
            role="Decision Logic"
            icon={GitMerge}
            description="Applies multi-criteria scoring based on skills, location, and provider reliability."
            delay={300}
          />
          <AgentCard 
            name="Pricing Agent" 
            role="Financial Strategist"
            icon={Calculator}
            description="Calculates real-time quotes using service complexity and provider history."
            delay={400}
          />
          <AgentCard 
            name="Booking Agent" 
            role="Orchestrator"
            icon={CalendarCheck}
            description="Handles scheduling conflicts and finalizes the reservation workflow."
            delay={500}
          />

          {/* Workflow Architecture */}
          <SectionHeader 
            title="Agentic Workflow" 
            subtitle="The underlying technology stack." 
          />
          <Card className="mb-8">
            <View className="space-y-6">
              <View className="flex-row items-start">
                <Workflow size={24} color="#3b82f6" className="mr-4" />
                <View className="flex-1">
                  <Typography variant="h4" className="mb-2">LangGraph Orchestration</Typography>
                  <Typography variant="body" className="text-sm opacity-60">
                    A cyclic graph architecture that allows agents to re-route, self-correct, and maintain a consistent conversation state.
                  </Typography>
                </View>
              </View>
              <View className="flex-row items-start">
                <Layers size={24} color="#3b82f6" className="mr-4" />
                <View className="flex-1">
                  <Typography variant="h4" className="mb-2">Shared State System</Typography>
                  <Typography variant="body" className="text-sm opacity-60">
                    A centralized memory pool where every agent reads from and writes to, ensuring total pipeline synchronization.
                  </Typography>
                </View>
              </View>
              <View className="flex-row items-start">
                <Activity size={24} color="#3b82f6" className="mr-4" />
                <View className="flex-1">
                  <Typography variant="h4" className="mb-2">Real-time Reasoning Traces</Typography>
                  <Typography variant="body" className="text-sm opacity-60">
                    Deep observability into the AI's "thought process" through live execution logs and state snapshots.
                  </Typography>
                </View>
              </View>
            </View>
          </Card>

          {/* Integration & Vision */}
          <SectionHeader 
            title="The Antigravity Integration" 
            subtitle="Bridging the gap between code and AI." 
          />
          <Typography variant="body" className="mb-8 opacity-70 leading-7">
            Flowtica is built to showcase the power of the Antigravity orchestration framework. 
            By combining real-time socket communication with persistent LangGraph state, 
            we've created a system that feels alive and perfectly predictable.
          </Typography>

          {/* Vision Badges */}
          <View className="flex-row flex-wrap justify-between">
            {[
              { i: Globe, l: "Global Scale" },
              { i: ShieldCheck, l: "Trust & Safety" },
              { i: Star, l: "Premium Quality" },
              { i: Code, l: "Open Standard" }
            ].map((item, index) => (
              <View key={index} className="w-[48%] mb-4">
                <Card className="items-center py-6">
                  <item.i size={32} color="#3b82f6" />
                  <Typography variant="xs" className="mt-4 text-center">{item.l}</Typography>
                </Card>
              </View>
            ))}
          </View>

          {/* Call to action */}
          <View className="mt-12 mb-20 p-8 rounded-[40px] bg-blue-600 shadow-2xl shadow-blue-500/40 items-center">
            <Sparkles size={40} color="#fff" className="mb-4" />
            <Typography variant="h2" className="text-white text-center mb-2">Join the Revolution</Typography>
            <Typography className="text-blue-100 text-center mb-8">Ready to experience the future of AI commerce?</Typography>
            <TouchableOpacity 
              onPress={() => router.push('/conversations')}
              className="bg-white px-8 py-4 rounded-2xl flex-row items-center"
            >
              <Typography variant="h4" className="text-blue-600 mr-2">Try Flowtica</Typography>
              <ChevronRight size={18} color="#2563eb" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}