import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  Alert
} from "react-native";
import { Eye, EyeOff, ArrowRight } from "lucide-react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Linking from 'expo-linking';
import supabase from "../../components/Supabase.js"; // Adjust path as needed
import * as WebBrowser from "expo-web-browser";
WebBrowser.maybeCompleteAuthSession();
import { useEffect } from "react";

// Constants
const HEADER_H = 64;
const langs = ["اردو", "Roman Urdu", "English", "Code-switch", "Noisy input"];
const stats = [
  { label: "Providers", value: "1,240+", sub: "Active in G-13, F-7", subColor: "#4ade80" },
  { label: "Match time", value: "< 3s", sub: "6-factor ranking", subColor: "rgba(255,255,255,0.3)" },
  { label: "Completion", value: "94%", sub: "↑ On-time rate", subColor: "#38bdf8" },
];
const steps = [
  { icon: "🌐", title: "Multilingual intent", desc: 'Urdu, Roman Urdu, English & code-switching', badge: "Live", badgeColor: "green", bg: "rgba(124,58,237,0.12)" },
  { icon: "⚙️", title: "Smart provider matching", desc: "Rating, distance, availability, specialization", badge: "Live", badgeColor: "green", bg: "rgba(13,148,136,0.12)" },
  { icon: "🧾", title: "Dynamic pricing", desc: "Urgency, surge, loyalty discount", badge: "Live", badgeColor: "green", bg: "rgba(217,119,6,0.12)" },
  { icon: "📅", title: "Scheduling & booking", desc: "Double-booking prevention, reminders", badge: "Beta", badgeColor: "muted", bg: "rgba(2,132,199,0.12)" },
  { icon: "🛡️", title: "Dispute & feedback", desc: "No-show, quality complaint, refund", badge: "Beta", badgeColor: "muted", bg: "rgba(225,29,72,0.12)" },
];

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(true);
  const router = useRouter();
  const { redirectTo = "/" } = useLocalSearchParams();
  const { width, height } = useWindowDimensions();
  const isDesktop = width > 768;

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  

  const notify = (msg, variant) => Alert.alert(variant === "error" ? "Error" : "Info", msg);

 useEffect(() => {
  const {
    data: listener,
  } =
    supabase.auth.onAuthStateChange(
      async (
        event,
        session
      ) => {
        if (!session?.user)
          return;

        try {
          const response =
            await fetch(
              `http://192.168.0.102:5000/user/${session.user.id}`
            );

          const data =
            await response.json();

          // EXISTING USER
          if (data?.user) {
            router.replace("/");
          }

          // NEW USER
          else {
            router.replace({
              pathname:
                "/onboarding",
              params: {
                supabase_id:
                  session.user.id,
                email:
                  session.user.email,
              },
            });
          }
        } catch (err) {
          console.log(err);
        }
      }
    );

  return () => {
    listener.subscription.unsubscribe();
  };
}, []);
  const handleForgetPassword = async () => {
    if (!formData.email) {
      notify("Enter your email first to reset password.", "warning");
      return;
    }

    setLoading(true);

    try {
      const redirectUrl = Linking.createURL("UpdatePassword");

      const { error } = await supabase.auth.resetPasswordForEmail(
        formData.email,
        {
          redirectTo: redirectUrl,
        }
      );

      if (error) throw error;

      notify("Password reset link sent! Check your email.", "success");
    } catch (error) {
      notify(error.message || "An error occurred.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (
  provider
) => {
  try {
    const redirectUrl =
      Linking.createURL("/");

    const { data, error } =
      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo:
            redirectUrl,
          skipBrowserRedirect:
            true,
        },
      });

    if (error) throw error;

    if (data?.url) {
      const result =
        await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

      if (
        result.type ===
        "success"
      ) {
        const {
          data: { session },
        } =
          await supabase.auth.getSession();

        if (session?.user) {
          router.replace({
            pathname:
              "/onboarding",
            params: {
              supabase_id:
                session.user.id,
              email:
                session.user.email,
            },
          });
        }
      }
    }
  } catch (error) {
    notify(
      error.message ||
        "OAuth error occurred.",
      "error"
    );
  }
};


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
            params: {
              supabase_id: data.user.id,
              email: data.user.email,
            },
          });
        }
        notify("Account created! Check your email to confirm.", "success");
      } else {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email: formData.email,
            password: formData.password,
          });

        if (error) throw error;

        notify(
          "Signed in successfully!",
          "success"
        );

        router.replace({
          pathname: "/onboarding",
          params: {
            supabase_id:
              data.user.id,
            email:
              data.user.email,
          },
        });
      }
    } catch (error) {
      notify(error.message || "An error occurred.", "error");
    } finally {
      setLoading(false);
    }
  };



  return (
    <View className="flex-row flex-1" style={{ minHeight: height - HEADER_H }}>
      {/* ══ LEFT PANEL ══ */}
      <ScrollView className={`bg-[#fafaf8] ${isDesktop ? 'w-[42%]' : 'w-full'} flex-shrink-0 relative`}>
        <View className="px-11 pt-11 pb-12 flex-1 min-h-full">
          <Text className="text-[29px] text-[#111] mb-[6px] font-serif tracking-tight">
            {isSignUp ? "Create account" : "Welcome back"}
          </Text>
          <Text className="text-[13px] text-[#888] mb-[26px]">
            {isSignUp ? "Start managing services with AI today" : "Sign in to your AI service dashboard"}
          </Text>

          {/* Google OAuth
          <TouchableOpacity className="w-full h-[42px] border border-[#e5e5e3] bg-white rounded-xl flex-row items-center justify-center mb-5 gap-[9px]" onPress={() => handleOAuth('google')}>
           
            <Text className="text-[13px] font-medium text-[#333]">Continue with Google</Text>
          </TouchableOpacity>

          <View className="flex-row items-center gap-3 mb-5">
            <View className="flex-1 h-px bg-[#ebebea]" />
            <Text className="text-[11px] text-[#bbb] uppercase tracking-widest">or email</Text>
            <View className="flex-1 h-px bg-[#ebebea]" />
          </View> */}

          {/* Form */}
          <View className="flex-col gap-[14px] mb-5">
            <View>
              <Text className="text-[10px] font-semibold text-[#aaa] uppercase tracking-widest mb-[6px]">Email</Text>
              <TextInput
                className="w-full h-[42px] px-[14px] rounded-xl border border-[#e5e5e3] bg-white text-[#111] text-[13px]"
                placeholder="you@company.com"
                placeholderTextColor="#ccc"
                value={formData.email}
                onChangeText={(text) => setFormData(p => ({ ...p, email: text }))}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View>
              <View className="flex-row justify-between items-center mb-[6px]">
                <Text className="text-[10px] font-semibold text-[#aaa] uppercase tracking-widest">Password</Text>
                {!isSignUp && (
                  <TouchableOpacity onPress={handleForgetPassword} disabled={loading}>
                    <Text className="text-[11px] text-[#aaa]">Forgot password?</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View className="relative justify-center">
                <TextInput
                  className="w-full h-[42px] pl-[14px] pr-[42px] rounded-xl border border-[#e5e5e3] bg-white text-[#111] text-[13px]"
                  placeholder="Enter your password"
                  placeholderTextColor="#ccc"
                  secureTextEntry={!showPassword}
                  value={formData.password}
                  onChangeText={(text) => setFormData(p => ({ ...p, password: text }))}
                />
                <TouchableOpacity
                  className="absolute right-[12px]"
                  onPress={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} color="#bbb" /> : <Eye size={16} color="#bbb" />}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            className="w-full h-[42px] bg-[#111] rounded-xl flex-row items-center justify-center gap-[7px] mb-4"
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text className="text-white text-[13px] font-semibold">{isSignUp ? "Create Account" : "Sign In"}</Text>
                <ArrowRight size={15} color="#fff" strokeWidth={2.5} />
              </>
            )}
          </TouchableOpacity>

          <View className="flex-row justify-center items-center">
            <Text className="text-[12.5px] text-[#999]">
              {isSignUp ? "Already have an account? " : "Don't have an account? "}
            </Text>
            <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
              <Text className="text-[#111] font-semibold text-[12.5px] underline">
                {isSignUp ? "Sign in" : "Sign up"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* ══ RIGHT PANEL (Hidden on Mobile) ══ */}
      {isDesktop && (
        <View className="flex-1 bg-[#0a0a0a] relative">
          <ScrollView contentContainerStyle={{ paddingVertical: 36, paddingHorizontal: 30, flexGrow: 1 }}>
            <View className="flex-row items-center gap-[7px] mb-[10px]">
              <View className="w-[7px] h-[7px] rounded-full bg-[#22c55e]" />
              <Text className="text-[10px] text-white/30 uppercase tracking-[0.1em]">AI Service Orchestrator</Text>
            </View>

            <Text className="text-[26px] text-white leading-tight mb-2 font-serif">
              Service milao.{"\n"}
              <Text className="text-white/30">Kaam karwao.</Text>
            </Text>
            <Text className="text-[12px] text-white/30 leading-[20px] max-w-[300px] mb-5">
              Plumbers, electricians, AC technicians, tutors — AI finds, matches, and books the right provider in seconds.
            </Text>

            <View className="flex-row flex-wrap gap-2 mb-5">
              {stats.map(s => (
                <View key={s.label} className="bg-white/5 border border-white/10 rounded-xl px-[13px] py-[11px] w-[31%]">
                  <Text className="text-[10px] text-white/30 uppercase tracking-widest mb-[3px]">{s.label}</Text>
                  <Text className="text-[19px] font-medium text-white mb-[2px] font-serif">{s.value}</Text>
                  <Text className="text-[10px] leading-[14px]" style={{ color: s.subColor }}>{s.sub}</Text>
                </View>
              ))}
            </View>

            <Text className="text-[10px] text-white/20 uppercase tracking-widest mb-[10px]">End-to-end workflow</Text>

            <View className="flex-col gap-[6px]">
              {steps.map(s => (
                <View key={s.title} className="flex-row items-start gap-[10px] p-[10px] bg-white/5 border border-white/10 rounded-xl">
                  <View className="w-[30px] h-[30px] rounded-lg items-center justify-center mt-[1px]" style={{ backgroundColor: s.bg }}>
                    <Text className="text-[14px]">{s.icon}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-[12px] font-medium text-white/80 mb-[2px]">{s.title}</Text>
                    <Text className="text-[11px] text-white/30 leading-[16px]">{s.desc}</Text>
                  </View>
                  <View className={`px-[8px] py-[2px] rounded-full border mt-[2px] ${s.badgeColor === 'green' ? 'bg-[#4ade80]/10 border-[#4ade80]/20' : 'bg-white/5 border-white/10'}`}>
                    <Text className={`text-[10px] font-medium ${s.badgeColor === 'green' ? 'text-[#4ade80]' : 'text-white/30'}`}>{s.badge}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View className="flex-row flex-wrap gap-[6px] mt-4">
              {langs.map(l => (
                <View key={l} className="px-[10px] py-[3px] rounded-full border border-white/10 bg-white/5">
                  <Text className="text-[10px] text-white/30">{l}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}
