import React, { useState, useEffect } from 'react';
import { View, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { MotiView } from 'moti';
import {
  Bot,
  Sparkles,
  Search,
  Users,
  Languages,
  Calendar,
  DollarSign,
  CheckCircle,
  Activity,
  ArrowRight,
  Shield,
  Zap,
  ChevronRight,
} from 'lucide-react-native';
import { useSelector } from 'react-redux';
import { useAuth } from '../../components/AuthContext';
import { Button } from '../../components/ui/Button';
import { Typography } from '../../components/ui/Typography';
import { useDbUser } from '../../components/UserContext';

// ─── Small top badge ──────────────────────────────────────────────────────────
const Badge = ({ label, isDark }) => (
  <View className={`self-start flex-row items-center px-3 py-1.5 rounded-full mb-5
    ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`}>
    <Sparkles size={11} color={isDark ? '#94a3b8' : '#64748b'} />
    <Typography variant="xs" className={`ml-1.5 font-semibold tracking-widest uppercase
      ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
      {label}
    </Typography>
  </View>
);

// ─── Animated agent activity ticker ──────────────────────────────────────────
const AGENT_STEPS = [
  'Scanning service providers…',
  'Matching skills to request…',
  'Checking availability…',
  'Generating real-time quote…',
  'Confirming booking slot…',
  'Encrypting transaction…',
];

const AgentTicker = ({ isDark }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIndex(i => (i + 1) % AGENT_STEPS.length), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <View className={`rounded-3xl overflow-hidden border
      ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}
      style={{ shadowColor: '#000', shadowOpacity: isDark ? 0.35 : 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 5 } }}>

      {/* animated progress bar */}
      <View className={`h-1 w-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
        <MotiView
          key={index}
          from={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ type: 'timing', duration: 2200 }}
          className={`h-full rounded-full ${isDark ? 'bg-slate-400' : 'bg-slate-700'}`}
        />
      </View>

      <View className="p-5 flex-row items-center">
        {/* Bot icon with slow spin */}
        <MotiView
          animate={{ rotate: ['0deg', '360deg'] }}
          transition={{ loop: true, duration: 20000, type: 'timing' }}
        >
          <View className={`w-14 h-14 rounded-2xl items-center justify-center
            ${isDark ? 'bg-slate-700' : 'bg-slate-900'}`}>
            <Bot size={30} color="#fff" />
          </View>
        </MotiView>

        <View className="ml-4 flex-1">
          <View className="flex-row items-center mb-1">
            {/* live dot */}
            <MotiView
              from={{ opacity: 0.3 }}
              animate={{ opacity: 1 }}
              transition={{ loop: true, duration: 800, type: 'timing' }}
              className={`w-2 h-2 rounded-full mr-2 ${isDark ? 'bg-slate-300' : 'bg-slate-700'}`}
            />
            <Typography variant="xs" className={`font-semibold uppercase tracking-widest
              ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Agent Active
            </Typography>
          </View>

          {/* cycling step text */}
          <MotiView
            key={index}
            from={{ opacity: 0, translateY: 6 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 350 }}
          >
            <Typography variant="h4">{AGENT_STEPS[index]}</Typography>
          </MotiView>
        </View>
      </View>

      {/* step dots */}
      <View className="flex-row px-5 pb-4 items-center">
        {AGENT_STEPS.map((_, i) => (
          <MotiView
            key={i}
            animate={{ opacity: i === index ? 1 : 0.25, scale: i === index ? 1.2 : 1 }}
            transition={{ type: 'timing', duration: 300 }}
            className={`mr-1.5 rounded-full ${i === index ? 'w-4 h-1.5' : 'w-1.5 h-1.5'}
              ${isDark ? 'bg-slate-300' : 'bg-slate-700'}`}
          />
        ))}
      </View>
    </View>
  );
};

// ─── Horizontal swipeable feature pills ──────────────────────────────────────
const FeaturePill = ({ icon: Icon, label, isDark, delay }) => (
  <MotiView
    from={{ opacity: 0, translateX: 16 }}
    animate={{ opacity: 1, translateX: 0 }}
    transition={{ type: 'timing', duration: 500, delay }}
  >
    <View className={`flex-row items-center px-4 py-3 rounded-2xl mr-3
      ${isDark ? 'bg-slate-800/80 border border-slate-700/60' : 'bg-white border border-slate-100'}`}
      style={{ shadowColor: '#000', shadowOpacity: isDark ? 0.25 : 0.05, shadowRadius: 6 }}>
      <View className={`w-7 h-7 rounded-xl items-center justify-center mr-2.5
        ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
        <Icon size={14} color={isDark ? '#e2e8f0' : '#334155'} />
      </View>
      <Typography variant="xs" className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
        {label}
      </Typography>
    </View>
  </MotiView>
);

// ─── How it works step ────────────────────────────────────────────────────────
const HowStep = ({ num, title, description, isDark, isLast }) => (
  <View className="flex-row">
    {/* number + connector line */}
    <View className="items-center mr-4">
      <View className={`w-8 h-8 rounded-full items-center justify-center
        ${isDark ? 'bg-slate-700' : 'bg-slate-900'}`}>
        <Typography variant="xs" className="text-white font-bold">{num}</Typography>
      </View>
      {!isLast && (
        <View className={`w-px flex-1 mt-2 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
      )}
    </View>
    {/* content */}
    <View className={`flex-1 ${isLast ? 'pb-0' : 'pb-6'}`}>
      <Typography variant="h4" className="mb-1">{title}</Typography>
      <Typography variant="body" className={`text-xs leading-5 ${isDark ? 'opacity-50' : 'opacity-60'}`}>
        {description}
      </Typography>
    </View>
  </View>
);

// ─── Feature row card ─────────────────────────────────────────────────────────
const FeatureRow = ({ icon: Icon, title, description, isDark, delay }) => (
  <MotiView
    from={{ opacity: 0, translateY: 10 }}
    animate={{ opacity: 1, translateY: 0 }}
    transition={{ type: 'timing', duration: 500, delay }}
  >
    <View className={`flex-row items-start p-4 rounded-2xl mb-3
      ${isDark ? 'bg-slate-800/50 border border-slate-700/40' : 'bg-white border border-slate-100'}`}
      style={{ shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6 }}>
      <View className={`w-10 h-10 rounded-xl items-center justify-center mr-4 mt-0.5
        ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
        <Icon size={18} color={isDark ? '#e2e8f0' : '#0f172a'} />
      </View>
      <View className="flex-1">
        <Typography variant="h4" className="mb-1">{title}</Typography>
        <Typography variant="body" className={`text-xs leading-5 ${isDark ? 'opacity-50' : 'opacity-60'}`}>
          {description}
        </Typography>
      </View>
    </View>
  </MotiView>
);

// ─── Section header ───────────────────────────────────────────────────────────
const SectionHeader = ({ title, sub, isDark }) => (
  <View className="mb-5">
    <Typography variant="h3" className="mb-1">{title}</Typography>
    {sub && (
      <Typography variant="body" className={`text-xs ${isDark ? 'opacity-40' : 'opacity-50'}`}>
        {sub}
      </Typography>
    )}
  </View>
);

// ─── Divider ──────────────────────────────────────────────────────────────────
const Divider = ({ isDark }) => (
  <View className={`mx-5 mb-8 h-px ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} />
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';
  const { userLoading, dbUser } = useDbUser();

  const bg = isDark ? 'bg-slate-950' : 'bg-slate-50';
  const divider = isDark ? 'border-slate-800' : 'border-slate-100';
  

  return (
    <ScrollView
      className={`flex-1 ${bg}`}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      {/* ── HERO ──────────────────────────────────────────────────── */}
      <View className="px-5 pt-14 pb-8">
        <Badge label="AI Marketplace v2.0" isDark={isDark} />

        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 600 }}
        >
          <Typography variant="h1" className="mb-3 leading-tight">
            Flowtica AI
          </Typography>
          <Typography variant="body" className={`text-sm leading-6 max-w-xs
            ${isDark ? 'opacity-50' : 'opacity-60'}`}>
            Tell the AI what service you need. It finds, matches, schedules, and books — autonomously.
          </Typography>
        </MotiView>

        {/* CTA — only "Get Started" or "Find Services"; no Provider Hub */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'timing', duration: 600, delay: 250 }}
          className="mt-7"
        >
          {!user ? (
            <Button
              title="Get Started"
              size="lg"
              icon={ArrowRight}
              iconPosition="right"
              onPress={() => router.push('/auth')}
            />
          ) : userLoading ? (
            <View className={`h-12 w-40 rounded-2xl opacity-40
              ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
          ) : dbUser?.user_type === 'customer' ? (
            <Button
              title="Find Services"
              size="lg"
              icon={Search}
              onPress={() => router.push('/conversations')}
            />
          ) : null}
        </MotiView>
      </View>

      {/* ── AGENT TICKER CARD ─────────────────────────────────────── */}
      <MotiView
        from={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'timing', duration: 700, delay: 150 }}
        className="mx-5 mb-8"
      >
        <AgentTicker isDark={isDark} />
      </MotiView>

      {/* ── FEATURE PILLS (horizontal scroll) ─────────────────────── */}
      <View className="mb-8">
        <View className="px-5 mb-4">
          <SectionHeader title="What it does" isDark={isDark} />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4 }}
        >
          <FeaturePill icon={Search}     label="AI Discovery"    isDark={isDark} delay={0} />
          <FeaturePill icon={Users}      label="Smart Matching"  isDark={isDark} delay={70} />
          <FeaturePill icon={Calendar}   label="Scheduling"      isDark={isDark} delay={140} />
          <FeaturePill icon={DollarSign} label="Live Pricing"    isDark={isDark} delay={210} />
          <FeaturePill icon={Languages}  label="Multilingual"    isDark={isDark} delay={280} />
          <FeaturePill icon={Activity}   label="Agent Logs"      isDark={isDark} delay={350} />
        </ScrollView>
      </View>

      <Divider isDark={isDark} />

      {/* ── HOW IT WORKS ──────────────────────────────────────────── */}
      <View className="px-5 mb-8">
        <SectionHeader
          title="How it works"
          sub="Three steps. Fully automated."
          isDark={isDark}
        />
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 600, delay: 100 }}
        >
          <View className={`p-5 rounded-3xl border
            ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
            style={{ shadowColor: '#000', shadowOpacity: isDark ? 0.3 : 0.06, shadowRadius: 14 }}>
            <HowStep
              num="1" title="Describe your need"
              description="Type what service you're looking for in plain language. Any language."
              isDark={isDark}
            />
            <HowStep
              num="2" title="AI does the work"
              description="Agents scan providers, compare options, check schedules, and generate a quote."
              isDark={isDark}
            />
            <HowStep
              num="3" title="Confirm & done"
              description="Review the match and confirm. The orchestrator handles the rest end-to-end."
              isDark={isDark} isLast
            />
          </View>
        </MotiView>
      </View>

      <Divider isDark={isDark} />

      {/* ── CAPABILITIES ──────────────────────────────────────────── */}
      <View className="px-5 mb-8">
        <SectionHeader
          title="Intelligent by design"
          sub="Powered by multi-agent orchestration"
          isDark={isDark}
        />
        <FeatureRow icon={Search}     title="RAG-Powered Discovery"   description="Knowledge agents scan the marketplace to surface the most relevant providers for your request."   isDark={isDark} delay={0} />
        <FeatureRow icon={Users}      title="Precision Matching"       description="Paired by skill, location, availability, and track record — not just keyword overlap."             isDark={isDark} delay={80} />
        <FeatureRow icon={Calendar}   title="Calendar Orchestration"   description="The scheduling agent reads provider availability and fits appointments around your preferences."   isDark={isDark} delay={160} />
        <FeatureRow icon={DollarSign} title="Transparent Pricing"      description="Quotes generated in real-time, factoring complexity, urgency, and market conditions."             isDark={isDark} delay={240} />
        <FeatureRow icon={Languages}  title="Multilingual Agents"      description="Communicate in English, Urdu, Punjabi, or Pashto. The agents adapt to you."                      isDark={isDark} delay={320} />
        <FeatureRow icon={Shield}     title="Secure by Default"        description="End-to-end encryption across all bookings, messages, and transactions."                          isDark={isDark} delay={400} />
      </View>

      <Divider isDark={isDark} />

      {/* ── WHY FLOWTICA ──────────────────────────────────────────── */}
      <View className="px-5 mb-8">
        <SectionHeader title="Why Flowtica?" isDark={isDark} />
        {[
          { t: "Verified Human Network",  d: "Every provider vetted for quality and reliability before going live." },
          { t: "Autonomous Workflows",    d: "No searching, no back-and-forth. Tell the AI once, it handles everything." },
          { t: "Zero Hidden Fees",        d: "Quotes are generated up-front. What you see is what you pay." },
        ].map((item, i) => (
          <MotiView
            key={i}
            from={{ opacity: 0, translateX: -8 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'timing', duration: 500, delay: i * 100 }}
          >
            <View className={`flex-row items-start mb-3 p-4 rounded-2xl
              ${isDark ? 'bg-slate-800/50 border border-slate-700/40' : 'bg-white border border-slate-100'}`}>
              <View className={`rounded-full p-1 mt-0.5 mr-3 ${isDark ? 'bg-slate-600' : 'bg-slate-900'}`}>
                <CheckCircle size={14} color="#fff" />
              </View>
              <View className="flex-1">
                <Typography variant="h4" className="mb-0.5">{item.t}</Typography>
                <Typography variant="body" className={`text-xs leading-5 ${isDark ? 'opacity-50' : 'opacity-60'}`}>
                  {item.d}
                </Typography>
              </View>
            </View>
          </MotiView>
        ))}
      </View>

      {/* ── FOOTER ────────────────────────────────────────────────── */}
      <View className={`mx-5 pt-6 border-t ${divider} items-center`}>
        <Typography variant="h4" className="mb-2">Flowtica AI</Typography>
        <Typography variant="xs" className={`text-center ${isDark ? 'opacity-25' : 'opacity-35'}`}>
          Built with Antigravity · Orchestrated by LangGraph{"\n"}© 2026 Flowtica AI. All rights reserved.
        </Typography>
      </View>
    </ScrollView>
  );
}