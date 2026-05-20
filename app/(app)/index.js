import React from 'react';
import { View, ScrollView, useWindowDimensions, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView, MotiText } from 'moti';
import {
  Bot,
  Sparkles,
  Zap,
  Shield,
  ChevronRight,
  Search,
  Users,
  Languages,
  Calendar,
  DollarSign,
  CheckCircle,
  Activity,
  ArrowRight,
  Briefcase
} from 'lucide-react-native';
import { useSelector } from 'react-redux';
import { useAuth } from '../../components/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Typography } from '../../components/ui/Typography';
import { useDbUser } from '../../components/UserContext';

const FeatureCard = ({ icon: Icon, title, description, delay = 0 }) => {
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';
  return (
    <Card className={`w-[300px] m-2 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 1000, delay }}
      >
        {/* ✅ Dark mode: light bg + white icon */}
        <View className={`w-14 h-14 rounded-2xl items-center justify-center mb-6 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
          <Icon size={28} color={isDark ? '#f1f5f9' : '#0f172a'} />
        </View>
        <Typography variant="h4" className="mb-3">{title}</Typography>
        <Typography variant="body" className="text-sm opacity-70 leading-relaxed">{description}</Typography>
      </MotiView>
    </Card>
  );
};

export default function LandingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  const isDark = useSelector(state => state.orchestration.theme) === 'dark';
  const { userLoading, dbUser } = useDbUser();
  console.log("DBUSER: ", dbUser);

  return (
    <ScrollView
      className={`flex-1 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Section */}
      <View className="px-6 pt-20 pb-32 items-center overflow-hidden relative">
        {/* Animated Background Blobs — toned down in dark mode */}
        <MotiView
          animate={{ scale: [1, 1.2, 1], rotate: ['0deg', '90deg', '0deg'] }}
          transition={{ loop: true, duration: 10000, type: 'timing' }}
          className={`absolute -top-20 -right-20 w-96 h-96 rounded-full blur-3xl ${isDark ? 'bg-slate-800/20' : 'bg-blue-600/10'}`}
        />
        <MotiView
          animate={{ scale: [1, 1.3, 1], rotate: ['0deg', '-90deg', '0deg'] }}
          transition={{ loop: true, duration: 15000, type: 'timing' }}
          className={`absolute -bottom-20 -left-20 w-80 h-80 rounded-full blur-3xl ${isDark ? 'bg-slate-700/20' : 'bg-purple-600/10'}`}
        />

        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 800 }}
          className="items-center z-10"
        >
          <View className={`flex-row items-center px-4 py-2 rounded-full border mb-8 
  ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-slate-100 border-slate-200'}`}>
            <Sparkles size={14} color={isDark ? '#f1f5f9' : '#0f172a'} />
            <Typography variant="xs" className={`ml-2 font-black ${isDark ? 'text-slate-100' : 'text-slate-700'}`}>
              AI Marketplace v2.0
            </Typography>
          </View>

          <Typography variant="h1" className="text-center mb-6 px-4">
            Next-Gen {"\n"}
            <Typography variant="h1" className={isDark ? 'text-slate-300' : 'text-slate-800'}>
              AI Service
            </Typography>{' '}
            Orchestrator
          </Typography>

          <Typography variant="body" className="text-center max-w-2xl px-6 mb-12 opacity-80">
            The world's first multi-agent service marketplace. Connect with verified human providers
            through an autonomous AI orchestration engine that handles everything from discovery to
            final booking.
          </Typography>

          {/* ✅ Button logic: customer → Find Services, provider → Provider Hub, guest → Get Started */}
          <View className={`flex-row space-x-4 ${isDesktop ? '' : 'flex-col space-x-0 space-y-4'}`}>
            {!user ? (
              <Button
                title="Get Started Now"
                size="lg"
                icon={ArrowRight}
                iconPosition="right"
                onPress={() => router.push('/auth')}
              />
            ) : userLoading ? (
              <View className="h-12 w-40 rounded-full bg-slate-300 opacity-50" />
            ) : dbUser?.user_type === 'customer' ? (
              <Button
                title="Find Services"
                size="lg"
                icon={Search}
                onPress={() => router.push('/conversations')}
              />
            ) : (
              <Button
                title="Provider Hub"
                variant="secondary"
                size="lg"
                icon={Briefcase}
                onPress={() => router.push('/provider')}
              />
            )}
          </View>
        </MotiView>
      </View>

      {/* Feature Showcase */}
      <View className="px-6 pb-20">
        <View className="items-center mb-16">
          <Typography variant="h2" className="text-center mb-4">Autonomous Intelligence</Typography>
          <Typography variant="body" className="text-center opacity-60">
            Powered by advanced Multi-Agent Orchestration
          </Typography>
        </View>

        {/* ✅ Fixed card layout — wrapping rows */}
        <View className="flex-row flex-wrap justify-center">
          <FeatureCard
            icon={Search}
            title="AI Discovery"
            description="Our RAG-powered Knowledge Agents scan the marketplace to find the perfect service matches for your specific needs."
            delay={100}
          />
          <FeatureCard
            icon={Users}
            title="Smart Matching"
            description="Proprietary matching logic pairs you with providers based on skill, location, availability, and historical performance."
            delay={200}
          />
          <FeatureCard
            icon={Languages}
            title="Multilingual Support"
            description="Agents communicate fluently in English, Urdu, Punjabi, and Pashto to ensure seamless interaction across cultures."
            delay={300}
          />
          <FeatureCard
            icon={Calendar}
            title="Auto-Scheduling"
            description="The Scheduling Agent manages provider calendars and your preferences to find the optimal appointment window."
            delay={400}
          />
          <FeatureCard
            icon={DollarSign}
            title="Dynamic Pricing"
            description="Real-time quote generation based on service complexity, urgency, and market demand for total transparency."
            delay={500}
          />
          <FeatureCard
            icon={Activity}
            title="Live Orchestration"
            description="Watch the agents collaborate in real-time. Transparent execution logs show every step of the reasoning process."
            delay={600}
          />
        </View>
      </View>

      {/* Why Flowtica Section */}
      <View className={`px-6 py-20 mb-20 ${isDark ? 'bg-slate-950' : 'bg-blue-50/50'}`}>
        <View className={`flex-row items-center ${isDesktop ? 'space-x-20' : 'flex-col space-y-12'}`}>
          <View className="flex-1">
            <Typography variant="h2" className="mb-6">Why Flowtica AI?</Typography>
            <View className="space-y-6">
              {[
                { t: "Verified Human Network", d: "Every provider is vetted for quality and reliability." },
                { t: "Autonomous Workflows", d: "No more searching. Tell the AI what you need and let it work." },
                { t: "Secure Transactions", d: "End-to-end encryption for all bookings and coordination." },
              ].map((item, i) => (
                <View key={i} className="flex-row items-start">
                  <View className={`rounded-full p-1 mt-1 mr-4 ${isDark ? 'bg-slate-600' : 'bg-slate-800'}`}>
                    <CheckCircle size={16} color="#fff" />
                  </View>
                  <View>
                    <Typography variant="h4">{item.t}</Typography>
                    <Typography variant="body" className="text-sm opacity-60">{item.d}</Typography>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className={`flex-1 items-center justify-center ${isDesktop ? '' : 'w-full'}`}>
            <MotiView
              from={{ rotate: '0deg' }}
              animate={{ rotate: '360deg' }}
              transition={{ loop: true, duration: 20000, type: 'timing' }}
              className={`w-64 h-64 border-2 border-dashed rounded-full items-center justify-center ${isDark ? 'border-slate-700' : 'border-slate-300'}`}
            >
              <View className={`w-48 h-48 rounded-full items-center justify-center shadow-2xl 
  ${isDark ? 'bg-slate-600' : 'bg-slate-800'}`}>
                <Bot size={80} color="#fff" />
              </View>
            </MotiView>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View className={`px-6 py-12 items-center border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
        <Typography variant="h4" className="mb-4">Flowtica AI</Typography>
        <Typography variant="xs" className="text-center opacity-40">
          Built with Antigravity • Orchestrated by LangGraph {"\n"}
          © 2026 Flowtica AI. All rights reserved.
        </Typography>
      </View>
    </ScrollView>
  );
}