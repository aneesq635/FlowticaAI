import React, { useState, useEffect } from "react";
import { View, ScrollView, TouchableOpacity, Text, TextInput, Alert, ActivityIndicator, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../../components/AuthContext";
import { Typography } from "../../../components/ui/Typography";
import { useSelector } from "react-redux";
import { ArrowLeft, User, Phone, MapPin, Mail, Save } from "lucide-react-native";

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const reduxTheme = useSelector(state => state.orchestration.theme);
  const isDark = reduxTheme === 'dark';
  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://172.25.2.90:5000';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: "",
    phone: "",
    location: "",
    avatar_url: "",
    email: "",
    user_type: "buyer"
  });

  const fetchProfile = async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const res = await fetch(`${backendUrl}/update-user`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supabase_id: user.id })
      });
      const data = await res.json();
      if (data.success && data.user) {
        setProfile({
          name: data.user.name || "",
          phone: data.user.phone || "",
          location: data.user.location || "",
          avatar_url: data.user.avatar_url || "",
          email: data.user.email || user.email || "",
          user_type: data.user.user_type || "buyer"
        });
      }
    } catch (e) {
      console.error("[PROFILE] Failed to fetch profile details", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!profile.name.trim()) {
      Alert.alert("Required Field", "Please enter your name.");
      return;
    }
    try {
      setSaving(true);
      const res = await fetch(`${backendUrl}/update-user`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supabase_id: user.id, ...profile })
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert("Success", "Profile updated successfully!");
        fetchProfile();
      } else {
        Alert.alert("Error", data.error || "Failed to update profile.");
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Server connection issue.");
    } finally {
      setSaving(false);
    }
  };

  return (
    // ✅ plain View with manual insets — no SafeAreaView className conflict
    <View
      style={{
        flex: 1,
        paddingTop: insets.top,
        backgroundColor: isDark ? '#020617' : '#f8fafc'
      }}
    >
      {/* Header */}
      <View
        style={{
          paddingHorizontal: 24,
          paddingVertical: 16,
          flexDirection: 'row',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: isDark ? '#1e293b' : '#e2e8f0',
          backgroundColor: isDark ? '#0f172a' : '#ffffff'
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
          <ArrowLeft size={24} color={isDark ? '#e2e8f0' : '#1e293b'} />
        </TouchableOpacity>
        <Typography variant="h3">My Profile</Typography>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
        {loading ? (
          <View style={{ paddingVertical: 80, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : (
          <View
            style={{
              padding: 24,
              borderRadius: 32,
              borderWidth: 1,
              borderColor: isDark ? '#1e293b' : '#f1f5f9',
              backgroundColor: isDark ? '#0f172a' : '#ffffff'
            }}
          >
            {/* Avatar */}
            <View style={{ alignItems: 'center', marginBottom: 32 }}>
              <View
                style={{
                  width: 96, height: 96, borderRadius: 48,
                  justifyContent: 'center', alignItems: 'center',
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                  marginBottom: 16,
                  borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)'
                }}
              >
                <User size={48} color="#3b82f6" />
              </View>
              <Typography variant="h2" className="text-center">{profile.name || "Your Name"}</Typography>
              <Typography variant="small" className="opacity-60 capitalize">
                {profile.user_type === 'buyer' ? 'Customer' : 'Service Provider'}
              </Typography>
            </View>

            {/* Full Name */}
            <View style={{ marginBottom: 20 }}>
              <Typography variant="small" className="font-bold mb-2">Full Name</Typography>
              <View style={{ position: 'relative' }}>
                <TextInput
                  value={profile.name}
                  onChangeText={(val) => setProfile({ ...profile, name: val })}
                  placeholder="John Doe"
                  placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                  style={{
                    paddingLeft: 48, paddingRight: 16, paddingVertical: 16,
                    borderRadius: 16, borderWidth: 1,
                    borderColor: isDark ? '#1e293b' : '#e2e8f0',
                    backgroundColor: isDark ? '#020617' : '#f8fafc',
                    color: isDark ? '#ffffff' : '#0f172a',
                    fontSize: 16
                  }}
                />
                <View style={{ position: 'absolute', left: 16, top: 18 }}>
                  <User size={18} color="#64748b" />
                </View>
              </View>
            </View>

            {/* Phone */}
            <View style={{ marginBottom: 20 }}>
              <Typography variant="small" className="font-bold mb-2">Contact Number</Typography>
              <View style={{ position: 'relative' }}>
                <TextInput
                  value={profile.phone}
                  onChangeText={(val) => setProfile({ ...profile, phone: val })}
                  placeholder="+92 300 1234567"
                  keyboardType="phone-pad"
                  placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                  style={{
                    paddingLeft: 48, paddingRight: 16, paddingVertical: 16,
                    borderRadius: 16, borderWidth: 1,
                    borderColor: isDark ? '#1e293b' : '#e2e8f0',
                    backgroundColor: isDark ? '#020617' : '#f8fafc',
                    color: isDark ? '#ffffff' : '#0f172a',
                    fontSize: 16
                  }}
                />
                <View style={{ position: 'absolute', left: 16, top: 18 }}>
                  <Phone size={18} color="#64748b" />
                </View>
              </View>
            </View>

            {/* Location */}
            <View style={{ marginBottom: 20 }}>
              <Typography variant="small" className="font-bold mb-2">Location</Typography>
              <View style={{ position: 'relative' }}>
                <TextInput
                  value={profile.location}
                  onChangeText={(val) => setProfile({ ...profile, location: val })}
                  placeholder="City, Country"
                  placeholderTextColor={isDark ? '#64748b' : '#94a3b8'}
                  style={{
                    paddingLeft: 48, paddingRight: 16, paddingVertical: 16,
                    borderRadius: 16, borderWidth: 1,
                    borderColor: isDark ? '#1e293b' : '#e2e8f0',
                    backgroundColor: isDark ? '#020617' : '#f8fafc',
                    color: isDark ? '#ffffff' : '#0f172a',
                    fontSize: 16
                  }}
                />
                <View style={{ position: 'absolute', left: 16, top: 18 }}>
                  <MapPin size={18} color="#64748b" />
                </View>
              </View>
            </View>

            {/* Email (read-only) */}
            <View style={{ marginBottom: 24, opacity: 0.6 }}>
              <Typography variant="small" className="font-bold mb-2">Email Address (Read-only)</Typography>
              <View style={{ position: 'relative' }}>
                <TextInput
                  value={profile.email}
                  editable={false}
                  style={{
                    paddingLeft: 48, paddingRight: 16, paddingVertical: 16,
                    borderRadius: 16, borderWidth: 1,
                    borderColor: isDark ? '#1e293b' : '#e2e8f0',
                    backgroundColor: isDark ? '#020617' : '#f1f5f9',
                    color: isDark ? '#94a3b8' : '#64748b',
                    fontSize: 16
                  }}
                />
                <View style={{ position: 'absolute', left: 16, top: 18 }}>
                  <Mail size={18} color="#64748b" />
                </View>
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              disabled={saving}
              onPress={handleSave}
              style={{
                paddingVertical: 16,
                borderRadius: 16,
                backgroundColor: '#3b82f6',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Save size={18} color="#ffffff" />
                  <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 16 }}>
                    Save Changes
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}