import { SafeAreaView } from 'react-native-safe-area-context';
import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { 
  GitMerge, 
  Search, 
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
  Sparkles,
  Lock,
  ArrowLeft
} from 'lucide-react-native';
import { useSelector } from 'react-redux';
import { MotiView } from 'moti';
import { Typography } from '../../../components/ui/Typography';
import { Card } from '../../../components/ui/Card';

const TechCard = ({ title, subtitle, icon: Icon, description, delay = 0 }) => {
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';
  return (
    <MotiView
      from={{ opacity: 0, translateY: 15 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 800, delay }}
      className="mb-5"
    >
      <Card className={`p-6 border ${isDark ? 'bg-slate-900 border-slate-800/80' : 'bg-white border-slate-150'}`}>
        <View className="flex-row items-center mb-4">
          <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <Icon size={22} color={isDark ? '#ffffff' : '#0f172a'} />
          </View>
          <View className="flex-1">
            <Typography variant="h3" className="text-sm font-black tracking-tight">{title}</Typography>
            <Typography variant="xs" className={`uppercase tracking-widest font-black ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</Typography>
          </View>
        </View>
        <Typography variant="body" className={`text-xs leading-5 ${isDark ? 'text-slate-350' : 'text-slate-600'}`}>{description}</Typography>
      </Card>
    </MotiView>
  );
};

const SectionHeader = ({ title, subtitle }) => {
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';
  return (
    <View className="mb-8 mt-12">
      <Typography variant="h2" className="mb-2 tracking-tight text-xl font-black">{title}</Typography>
      <Typography variant="body" className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{subtitle}</Typography>
    </View>
  );
};

export default function AboutScreen() {
  const router = useRouter();
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';

  return (
    <SafeAreaView 
      className={`flex-1 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}
      edges={['bottom']}
    >
      <ScrollView 
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <View className="pt-10">
          <MotiView
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 1000 }}
          >
            <View className={`inline-flex self-start flex-row items-center px-4 py-2 rounded-full border mb-6 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <Zap size={14} color={isDark ? '#fff' : '#0f172a'} />
              <Typography variant="xs" className={`ml-2 font-black uppercase tracking-widest ${isDark ? 'text-white' : 'text-slate-950'}`}>Architectural Blueprint</Typography>
            </View>
            <Typography variant="h1" className="mb-6 tracking-tighter text-3xl font-black leading-10">Engineered for {"\n"}Agentic Orchestration</Typography>
            <Typography variant="body" className={`text-sm leading-6 ${isDark ? 'text-slate-350' : 'text-slate-650'}`}>
              Flowtica AI represents a paradigm shift in marketplace design—orchestrating service providers, consumers, and localized workflows through a fully deterministic multi-agent state graph.
            </Typography>
          </MotiView>

          {/* 1. Core Technical Components */}
          <SectionHeader 
            title="Systems Architecture" 
            subtitle="The core machinery behind autonomous coordination" 
          />

          <TechCard 
            title="MongoDB Atlas RAG Pipeline" 
            subtitle="Context-Aware Provider Retrieval"
            icon={Database}
            description="Our Retrieval-Augmented Generation engine bypasses standard databases. It utilizes high-dimensional MongoDB Atlas Vector Search indexing to match buyer requests against a dynamic matrix of provider expertise, geographical indices, and rating metrics in sub-50ms cycles."
            delay={100}
          />

          <TechCard 
            title="Bi-Directional Sockets (Socket.io)" 
            subtitle="Real-Time Orchestration Fabric"
            icon={Clock}
            description="Continuous collaborative coordination. The platform utilizes low-latency WebSocket interfaces to stream state modifications instantly between buyer dashboards, provider endpoints, and the server orchestrator, keeping all views in complete telemetry."
            delay={200}
          />

          <TechCard 
            title="Transactional Request Lifecycles" 
            subtitle="State Locking & Negotiations"
            icon={Lock}
            description="From initial quote extraction to booking completion, every request undergoes validated state changes: Pending, Counter-offering, Locking, and Early Execution. Distributed transactions are protected with strict optimistic concurrency checks."
            delay={300}
          />

          <TechCard 
            title="Cyclic Graph Orchestration" 
            subtitle="LangGraph-Driven Workflows"
            icon={Workflow}
            description="Powered by a cyclic state-machine. Unlike linear bots, our LangGraph-inspired routing system enables agents to recursively evaluate, self-correct, check availability, negotiate prices, and write to a shared memory pool."
            delay={400}
          />

          {/* 2. LangGraph Workflow Visualization info */}
          <SectionHeader 
            title="The Multi-Agent Pipeline" 
            subtitle="Isolated systems operating on a shared memory pool" 
          />
          <Card className={`mb-8 p-6 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <View className="space-y-6">
              <View className="flex-row items-start mb-4">
                <Search size={22} color={isDark ? '#fff' : '#0f172a'} className="mr-4 mt-0.5" />
                <View className="flex-1">
                  <Typography variant="h4" className="mb-1 text-sm font-black">1. Intent & Named Entity Parsing</Typography>
                  <Typography variant="body" className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Translates Urdu/English queries into structured requirements, specifying skill, schedule, and budgetary boundaries.
                  </Typography>
                </View>
              </View>

              <View className="flex-row items-start mb-4">
                <GitMerge size={22} color={isDark ? '#fff' : '#0f172a'} className="mr-4 mt-0.5" />
                <View className="flex-1">
                  <Typography variant="h4" className="mb-1 text-sm font-black">2. RAG & Matching Criteria</Typography>
                  <Typography variant="body" className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Queries database embeddings for semantic relevance, score-matching providers using dynamic historical factors.
                  </Typography>
                </View>
              </View>

              <View className="flex-row items-start">
                <Activity size={22} color={isDark ? '#fff' : '#0f172a'} className="mr-4 mt-0.5" />
                <View className="flex-1">
                  <Typography variant="h4" className="mb-1 text-sm font-black">3. Observability & Traces</Typography>
                  <Typography variant="body" className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    Exposes direct reasoning steps and real-time backend engine traces, ensuring high reliability and diagnostic auditability.
                  </Typography>
                </View>
              </View>
            </View>
          </Card>

          {/* Vision Badges */}
          <View className="flex-row flex-wrap justify-between mt-8">
            {[
              { i: Globe, l: "Global Telemetry" },
              { i: ShieldCheck, l: "Cryptographic Trust" },
              { i: Star, l: "Deterministic Logic" },
              { i: Code, l: "Clean Microservices" }
            ].map((item, index) => (
              <View key={index} className="w-[48%] mb-4">
                <Card className={`items-center py-6 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-150'}`}>
                  <item.i size={26} color={isDark ? '#fff' : '#0f172a'} />
                  <Typography variant="xs" className="mt-3 text-center font-black uppercase tracking-wider">{item.l}</Typography>
                </Card>
              </View>
            ))}
          </View>

          {/* Call to action */}
          <MotiView
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 1000, delay: 500 }}
            className={`mt-12 p-8 rounded-[40px] border items-center ${isDark ? 'bg-white border-slate-800 shadow-2xl' : 'bg-slate-950 border-slate-900 shadow-lg'}`}
          >
            <Sparkles size={36} color={isDark ? '#0f172a' : '#ffffff'} className="mb-4" />
            <Typography variant="h2" className={`text-center mb-2 font-black tracking-tight text-xl ${isDark ? 'text-slate-950' : 'text-white'}`}>Deploying the Future</Typography>
            <Typography className={`text-center text-xs font-semibold mb-8 max-w-[240] ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>
              Connect to the live orchestration gateway and request your custom agent workflows now.
            </Typography>
            <TouchableOpacity 
              onPress={() => router.push('/conversations')}
              className={`px-8 py-4 rounded-2xl flex-row items-center ${isDark ? 'bg-slate-950' : 'bg-white'}`}
            >
              <Typography variant="h4" className={`mr-2 font-black ${isDark ? 'text-white' : 'text-slate-950'}`}>Go to Console</Typography>
              <ChevronRight size={18} color={isDark ? '#ffffff' : '#0f172a'} />
            </TouchableOpacity>
          </MotiView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}