import React from "react";
import { View, Text, TouchableOpacity, ScrollView, useWindowDimensions, Image } from "react-native";
import { useRouter } from "expo-router";
import { ArrowRight, Sparkles, Zap, ShieldCheck } from "lucide-react-native";

export default function LandingPage() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const features = [
    {
      title: "Multilingual AI intent",
      desc: "Understand natural language across multiple dialects including Roman Urdu, English, and more.",
      icon: <Sparkles size={24} color="#8b5cf6" />,
      bg: "bg-violet-100 dark:bg-violet-900/20",
    },
    {
      title: "Smart Matching",
      desc: "Connects users to the perfect service provider using dynamic algorithms.",
      icon: <Zap size={24} color="#10b981" />,
      bg: "bg-emerald-100 dark:bg-emerald-900/20",
    },
    {
      title: "Secure Verification",
      desc: "Top-tier identity verification and escrow payment capabilities.",
      icon: <ShieldCheck size={24} color="#3b82f6" />,
      bg: "bg-blue-100 dark:bg-blue-900/20",
    },
  ];

  return (
    <ScrollView className="flex-1 bg-white dark:bg-[#0a0a0a]">
      {/* Hero Section */}
      <View className="items-center px-6 py-20 lg:py-32">
        <View className="mb-6 rounded-full bg-blue-50 dark:bg-blue-900/20 px-4 py-1.5 border border-blue-100 dark:border-blue-800/30">
          <Text className="text-blue-600 dark:text-blue-400 font-medium text-sm">
            🚀 The future of service orchestration
          </Text>
        </View>
        <Text className="text-5xl lg:text-7xl font-bold text-center text-gray-900 dark:text-white tracking-tight mb-6 max-w-4xl">
          Automate Service Delivery with <Text className="text-blue-600 dark:text-blue-500">AI Precision</Text>
        </Text>
        <Text className="text-lg lg:text-xl text-center text-gray-600 dark:text-gray-400 max-w-2xl mb-10">
          Flowtica leverages advanced AI to instantly connect customers with vetted service providers, removing friction and automating the entire process.
        </Text>
        <View className="flex-row gap-4 flex-wrap justify-center">
          <TouchableOpacity 
            onPress={() => router.push("/auth")}
            className="bg-black dark:bg-white px-8 py-4 rounded-xl flex-row items-center gap-2"
          >
            <Text className="text-white dark:text-black font-semibold text-lg">Get Started Free</Text>
            <ArrowRight size={20} color="gray" />
          </TouchableOpacity>
          <TouchableOpacity 
            className="bg-gray-100 dark:bg-[#1a1a1a] px-8 py-4 rounded-xl flex-row items-center border border-transparent dark:border-white/10"
          >
            <Text className="text-gray-900 dark:text-white font-semibold text-lg">Book Demo</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Features Section */}
      <View className="px-6 py-20 bg-gray-50 dark:bg-[#111] border-y border-gray-100 dark:border-white/5">
        <View className="max-w-6xl mx-auto">
          <View className="mb-16">
            <Text className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white text-center mb-4">
              Everything you need to orchestrate
            </Text>
            <Text className="text-gray-600 dark:text-gray-400 text-center text-lg max-w-2xl mx-auto">
              Built from the ground up to solve complex routing and verification challenges automatically.
            </Text>
          </View>
          
          <View className={`flex-row flex-wrap justify-center gap-6 ${isDesktop ? '' : 'flex-col'}`}>
            {features.map((feature, idx) => (
              <View 
                key={idx} 
                className={`p-8 bg-white dark:bg-[#1a1a1a] rounded-3xl border border-gray-100 dark:border-white/5 ${isDesktop ? 'flex-1' : 'w-full'}`}
              >
                <View className={`w-14 h-14 rounded-2xl items-center justify-center mb-6 ${feature.bg}`}>
                  {feature.icon}
                </View>
                <Text className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                  {feature.title}
                </Text>
                <Text className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  {feature.desc}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* How it Works Section */}
      <View className="px-6 py-20 lg:py-32 items-center">
        <Text className="text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white text-center mb-16">
          How Flowtica Works
        </Text>
        <View className="max-w-4xl mx-auto w-full">
          {[
            { step: "01", title: "User speaks or types their problem", desc: "No restrictive forms. Our AI processes the context and language instantly." },
            { step: "02", title: "AI classifies and ranks providers", desc: "Real-time matching based on location, availability, and historical rating." },
            { step: "03", title: "Job executed with escrow", desc: "Payments are held securely and released upon mutual job completion." }
          ].map((item, idx) => (
            <View key={idx} className="flex-row gap-6 mb-10 items-start">
              <View className="w-12 h-12 rounded-full bg-blue-600 items-center justify-center shrink-0">
                <Text className="text-white font-bold">{item.step}</Text>
              </View>
              <View className="flex-1 pt-2">
                <Text className="text-xl font-bold text-gray-900 dark:text-white mb-2">{item.title}</Text>
                <Text className="text-gray-600 dark:text-gray-400">{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Call to Action */}
      <View className="px-6 py-24 bg-blue-600 items-center">
        <Text className="text-3xl lg:text-5xl font-bold text-white text-center mb-6">
          Ready to scale your services?
        </Text>
        <Text className="text-blue-100 text-lg text-center mb-10 max-w-xl">
          Join Flowtica today and experience the next generation of AI-driven service orchestration.
        </Text>
        <TouchableOpacity 
          onPress={() => router.push("/auth")}
          className="bg-white px-10 py-4 rounded-xl"
        >
          <Text className="text-blue-600 font-bold text-lg">Create Account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}