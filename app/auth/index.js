import React, { useState, useEffect } from "react";
import { View, ScrollView, useWindowDimensions, ActivityIndicator, Alert, TouchableOpacity } from "react-native";
import { Eye, EyeOff, ArrowRight, Mail, Lock, Sparkles, CheckCircle, ShieldCheck, Zap } from "lucide-react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Linking from 'expo-linking';
import supabase from "../../components/Supabase.js";
import * as WebBrowser from "expo-web-browser";
import { useSelector } from "react-redux";
import { Typography } from "../../components/ui/Typography";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";

WebBrowser.maybeCompleteAuthSession();

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isDesktop = width > 768;
  const isDark = useSelector(state => state.orchestration.theme) === 'dark';
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://172.25.2.90:5000';

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });

  const notify = (msg, variant) => Alert.alert(variant === "error" ? "Error" : "Info", msg);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!session?.user) return;
      try {
        const response = await fetch(`${backendUrl}/user/${session.user.id}`);
        const data = await response.json();
        if (data?.user) {
          router.replace("/");
        } else {
          router.replace({
            pathname: "/onboarding",
            params: { supabase_id: session.user.id, email: session.user.email },
          });
        }
      } catch (err) {
        console.error(err);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const handleAuth = async () => {
    if (!formData.email || !formData.password) return notify("Please fill in all fields.", "warning");
    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({ email: formData.email, password: formData.password });
        if (error) throw error;
        if (data?.user) {
          router.replace({
            pathname: "/onboarding",
            params: { supabase_id: data.user.id, email: data.user.email },
          });
        }
        notify("Check your email to confirm your account.", "success");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (error) throw error;
        router.replace("/");
      }
    } catch (error) {
      notify(error.message || "An error occurred.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className={`flex-1 flex-row ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
      {/* Left Panel - Auth Form */}
      <ScrollView 
        className={`${isDesktop ? 'w-[45%]' : 'w-full'}`}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-10 pt-16 pb-20 justify-center flex-1">
          <View className="mb-10">
            <Typography variant="h1" className="mb-2">
              {isSignUp ? "Join Flowtica" : "Welcome Back"}
            </Typography>
            <Typography variant="body" className="opacity-60">
              {isSignUp ? "Create an account to start orchestrating services." : "Sign in to access your AI service hub."}
            </Typography>
          </View>

          <Input 
            label="Email Address"
            placeholder="name@example.com"
            value={formData.email}
            onChangeText={(t) => setFormData(p => ({ ...p, email: t }))}
            icon={Mail}
            autoCapitalize="none"
          />

          <View className="relative">
            <Input 
              label="Password"
              placeholder="••••••••"
              value={formData.password}
              onChangeText={(t) => setFormData(p => ({ ...p, password: t }))}
              secureTextEntry={!showPassword}
              icon={Lock}
            />
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-11"
            >
              {showPassword ? <EyeOff size={18} color="#94a3b8" /> : <Eye size={18} color="#94a3b8" />}
            </TouchableOpacity>
          </View>

          {!isSignUp && (
            <TouchableOpacity className="self-end mb-8">
              <Typography variant="xs" className="text-blue-600 font-black">Forgot Password?</Typography>
            </TouchableOpacity>
          )}

          <Button 
            title={loading ? "Processing..." : (isSignUp ? "Create Account" : "Sign In")}
            onPress={handleAuth}
            disabled={loading}
            size="lg"
            icon={ArrowRight}
            iconPosition="right"
            className="mb-8"
          />

          <View className="flex-row justify-center items-center">
            <Typography variant="body" className="opacity-60 mr-2">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}
            </Typography>
            <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
              <Typography variant="body" className="text-blue-600 font-black">
                {isSignUp ? "Sign In" : "Sign Up"}
              </Typography>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Right Panel - Features (Desktop Only) */}
      {isDesktop && (
        <View className="flex-1 bg-slate-900 justify-center px-20">
          <View className="absolute top-0 right-0 left-0 bottom-0 opacity-20">
            {/* Background pattern placeholder */}
          </View>
          
          <View className="mb-12">
            <View className="flex-row items-center mb-6">
              <View className="w-12 h-12 bg-blue-600 rounded-2xl items-center justify-center mr-4">
                <Sparkles size={24} color="#fff" />
              </View>
              <Typography variant="h3" className="text-white">Orchestrated Excellence</Typography>
            </View>
            <Typography variant="h1" className="text-white text-5xl leading-[60px] mb-6">
              Service milao. {"\n"}
              <Text className="text-blue-500">Kaam karwao.</Text>
            </Typography>
            <Typography variant="body" className="text-slate-400 text-lg">
              The world's first AI-driven service marketplace. Plumbers, technicians, and specialists at your fingertips.
            </Typography>
          </View>

          <View className="space-y-6">
            {[
              { t: "Multi-Agent Workflow", d: "Parallel execution for speed and accuracy.", i: Zap },
              { t: "Verified Providers", d: "Only the best professionals in your area.", i: CheckCircle },
              { t: "Secure Payments", d: "Safe and transparent transaction layer.", i: ShieldCheck }
            ].map((item, i) => (
              <View key={i} className="flex-row items-center p-4 rounded-3xl bg-white/5 border border-white/10">
                <View className="w-10 h-10 rounded-xl bg-blue-500/20 items-center justify-center mr-4">
                  <item.i size={20} color="#3b82f6" />
                </View>
                <View>
                  <Typography variant="h4" className="text-white text-sm">{item.t}</Typography>
                  <Typography variant="body" className="text-slate-500 text-xs">{item.d}</Typography>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
