import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import MiniMap from "../../../components/MiniMap";
import LocationPickerModal from "../../../components/LocationPickerModal";
import { useSelector, useDispatch } from "react-redux";
import { setProviderProfile } from "../../../store/orchestrationSlice";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { useAuth } from "../../../components/AuthContext";
import { useForm, Controller } from "react-hook-form";
import { Dropdown, MultiSelect } from "react-native-element-dropdown";
import Modal from "react-native-modal";
import socketService from "../../../services/socket";
import {
  ArrowLeft,
  UserCircle,
  Briefcase,
  Star,
  Clock,
  Plus,
  X,
  Settings,
  MapPin,
  DollarSign,
  Award,
  Globe,
  Wrench,
  Trash2,
  Edit2,
  ChevronRight,
  TrendingUp,
  Layout,
  User,
  Phone,
  BarChart3,
  CheckCircle2,
  Map,
  Navigation
} from 'lucide-react-native';

// --- Constants ---
const SERVICE_CATEGORIES = [
  { label: "AC Repair", value: "AC Repair" },
  { label: "Electrician", value: "Electrician" },
  { label: "Plumbing", value: "Plumbing" },
  { label: "Cleaning", value: "Cleaning" },
  { label: "Mechanic", value: "Mechanic" },
  { label: "Tutor", value: "Tutor" },
  { label: "Beautician", value: "Beautician" },
  { label: "Carpenter", value: "Carpenter" },
];

const SPECIALIZATIONS_MAP = {
  Mechanic: [
    { label: "Suspension", value: "Suspension" },
    { label: "Engine", value: "Engine" },
    { label: "Brake System", value: "Brake System" },
    { label: "Oil Change", value: "Oil Change" },
  ],
  "AC Repair": [
    { label: "Split AC", value: "Split AC" },
    { label: "Inverter AC", value: "Inverter AC" },
    { label: "Gas Charging", value: "Gas Charging" },
    { label: "Central Cooling", value: "Central Cooling" },
  ],
  Electrician: [
    { label: "Wiring", value: "Wiring" },
    { label: "Appliance Repair", value: "Appliance Repair" },
    { label: "Lighting", value: "Lighting" },
  ],
  Plumbing: [
    { label: "Leakage Fix", value: "Leakage Fix" },
    { label: "Installation", value: "Installation" },
    { label: "Drainage", value: "Drainage" },
  ],
  Cleaning: [
    { label: "Deep Cleaning", value: "Deep Cleaning" },
    { label: "Sofa Cleaning", value: "Sofa Cleaning" },
    { label: "Kitchen Cleaning", value: "Kitchen Cleaning" },
  ],
  Tutor: [
    { label: "Math", value: "Math" },
    { label: "Science", value: "Science" },
    { label: "English", value: "English" },
    { label: "Chemistry", value: "Chemistry" },
    { label: "Physics", value: "Physics" },
  ],
  Beautician: [
    { label: "Haircut", value: "Haircut" },
    { label: "Facial", value: "Facial" },
    { label: "Makeup", value: "Makeup" },
    { label: "Waxing", value: "Waxing" },
  ],
  Carpenter: [
    { label: "Furniture Repair", value: "Furniture Repair" },
    { label: "Installation", value: "Installation" },
    { label: "Repair", value: "Repair" },
  ],
};

const LANGUAGE_OPTIONS = [
  { label: "English", value: "English" },
  { label: "Urdu", value: "Urdu" },
  { label: "Punjabi", value: "Punjabi" },
  { label: "Pashto", value: "Pashto" },
];

// --- Sub-components ---

// ─── StatItem ───────────────────────────────────────────────────────────────
const StatItem = ({ label, value, icon: Icon }) => {
  const isDark = useSelector((state) => state.orchestration.theme) === "dark";
  return (
    <View className="items-center flex-1">
      <View
        className={`p-2 rounded-xl mb-1 ${isDark ? "bg-slate-800" : "bg-slate-50"}`}
      >
        <Icon size={18} color={isDark ? "#f1f5f9" : "#000"} />
      </View>
      <Text
        className={`text-lg font-bold ${isDark ? "text-white" : "text-slate-900"}`}
      >
        {value}
      </Text>
      <Text
        className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}
      >
        {label}
      </Text>
    </View>
  );
};

// ─── ServiceCard ─────────────────────────────────────────────────────────────
const ServiceCard = ({ service, onEdit, onDelete }) => {
  const isDark = useSelector((state) => state.orchestration.theme) === "dark";
  return (
    <Card
      className={`mb-4 p-4 border shadow-sm overflow-hidden rounded-3xl ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
    >
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1">
          <Text
            className={`text-base font-bold ${isDark ? "text-white" : "text-slate-900"}`}
          >
            {service.name}
          </Text>
          <View className="flex-row items-center mt-1">
            <View
              className={`px-2 py-0.5 rounded-md mr-2 ${isDark ? "bg-slate-700" : "bg-slate-900"}`}
            >
              <Text className="text-[10px] text-white font-bold">
                {service.service_type}
              </Text>
            </View>
            <Text
              className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              {service.specialization}
            </Text>
          </View>
        </View>
        <View className="flex-row space-x-2">
          <TouchableOpacity
            onPress={onEdit}
            className={`p-2 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-50"}`}
          >
            <Edit2 size={14} color={isDark ? "#94a3b8" : "#64748b"} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            className="p-2 bg-red-500/10 rounded-full"
          >
            <Trash2 size={14} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>

      <Text
        className={`text-sm mb-4 leading-relaxed ${isDark ? "text-slate-400" : "text-slate-600"}`}
        numberOfLines={2}
      >
        {service.description}
      </Text>

      <View
        className={`flex-row items-center justify-between pt-4 border-t ${isDark ? "border-slate-800" : "border-slate-50"}`}
      >
        <View className="flex-row space-x-3 flex-1 mr-3">
          <View className="flex-row items-center flex-1">
            <MapPin size={12} color={isDark ? "#64748b" : "#64748b"} />
            <Text
              className={`text-xs ml-1 font-bold flex-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {service.location}
            </Text>
          </View>
          <View className="flex-row items-center">
            <Clock size={12} color="#64748b" />
            <Text
              className={`text-xs ml-1 font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              {service.experience_years}y Exp
            </Text>
          </View>
        </View>
        <View
          className={`px-3 py-1 rounded-full border ${isDark ? "bg-green-500/10 border-green-500/20" : "bg-green-50 border-green-100"}`}
        >
          <Text className="text-xs text-green-500 font-bold">
            {service.pricing?.hourly_rate} {service.pricing?.currency}/hr
          </Text>
        </View>
      </View>
    </Card>
  );
};

// ─── Chip ────────────────────────────────────────────────────────────────────
const Chip = ({ label, onRemove }) => {
  const isDark = useSelector((state) => state.orchestration.theme) === "dark";
  return (
    <View
      className={`px-3 py-1.5 rounded-full flex-row items-center mr-2 mb-2 border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-200"}`}
    >
      <Text
        className={`text-xs font-bold ${isDark ? "text-slate-300" : "text-slate-700"}`}
      >
        {label}
      </Text>
      {onRemove && (
        <TouchableOpacity onPress={onRemove} className="ml-2">
          <X size={12} color={isDark ? "#94a3b8" : "#64748b"} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// --- Main Component ---

export default function ProviderDashboard() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { user } = useAuth();
  const currentBooking = useSelector(
    (state) => state.orchestration.currentBooking,
  );

  const [isLoading, setIsLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [profile, setProfile] = useState(null);
  const [services, setServices] = useState([]);
  const [isCreatingService, setIsCreatingService] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [toolInput, setToolInput] = useState("");
  const [tools, setTools] = useState([]);

  // Location Picker State
  const [showMap, setShowMap] = useState(false);
  const [tempLocationData, setTempLocationData] = useState(null);

  // --- Incoming Request States ---
  const [requests, setRequests] = useState([]);
  const [isCounterModalOpen, setIsCounterModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [counterPrice, setCounterPrice] = useState("");
  const [counterDate, setCounterDate] = useState("");
  const [counterTime, setCounterTime] = useState("");
  const [counterNote, setCounterNote] = useState("");
  const isDark = useSelector((state) => state.orchestration.theme) === "dark";

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: "",
      service_type: "",
      specialization: "",
      description: "",
      location: "",
      hourly_rate: "",
      currency: "PKR",
      experience_years: "",
      languages: [],
      phone: "",
      email: user?.email || "",
    },
  });

  const selectedServiceType = watch("service_type");

  const backendUrl =
    process.env.EXPO_PUBLIC_BACKEND_URL || "http://172.25.2.90:5000";

  const fetchRequests = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(
        `${backendUrl}/api/providers/requests/${user.id}?status=pending`,
      );
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests || []);
      }
    } catch (e) {
      console.warn("Failed to fetch requests", e);
    }
  }, [user, backendUrl]);

  const handleRequestResponse = async (
    requestId,
    status,
    counterDetails = null,
  ) => {
    try {
      const res = await fetch(
        `${backendUrl}/api/providers/requests/${requestId}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            ...counterDetails,
          }),
        },
      );
      const data = await res.json();
      if (data.success) {
        Alert.alert(
          "Success",
          `Request successfully ${status === "approved" ? "approved" : status === "denied" ? "denied" : "countered"}.`,
        );
        fetchRequests();
      } else {
        Alert.alert("Error", data.error || "Failed to update request.");
      }
    } catch (e) {
      Alert.alert("Error", "Could not reach the server.");
    }
  };

  const isRequestTimePassed = (req) => {
    try {
      const reqDate = req.requested_date;
      const reqTime = req.requested_time;
      if (!reqDate) return true;

      let normalizedDate = reqDate.replace(/(st|nd|rd|th)/gi, "");
      let dateTimeStr = normalizedDate;
      if (reqTime) {
        dateTimeStr += ` ${reqTime}`;
      }

      const parsedDate = new Date(dateTimeStr);
      if (isNaN(parsedDate.getTime())) {
        const dateOnly = new Date(normalizedDate);
        if (isNaN(dateOnly.getTime())) return true;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today > dateOnly;
      }
      return new Date() > parsedDate;
    } catch (e) {
      return true;
    }
  };

  const handleDeleteRequest = async (req) => {
    if (req.status === "approved" && !isRequestTimePassed(req)) {
      Alert.alert(
        "Request Locked",
        "Approved requests cannot be deleted before the scheduled time has passed.",
        [{ text: "OK" }],
      );
      return;
    }

    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to delete this request record?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await fetch(
                `${backendUrl}/api/providers/requests/${req._id}`,
                {
                  method: "DELETE",
                },
              );
              const data = await res.json();
              if (data.success) {
                Alert.alert("Success", "Request record deleted successfully.");
                fetchRequests();
              } else {
                Alert.alert("Error", data.error || "Failed to delete request.");
              }
            } catch (err) {
              Alert.alert("Error", "Could not reach the server.");
            }
          },
        },
      ],
    );
  };

  const fetchProfileData = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/api/providers/profile/${user.id}`);
      const data = await res.json();
      if (data.success && data.profile) {
        setProfile(data.profile);
        setHasProfile(true);
        setIsAvailable(data.profile.availability ?? true);
        dispatch(setProviderProfile(data.profile));
        if (data.services) setServices(data.services);
        fetchRequests();
      } else {
        setHasProfile(false);
      }
    } catch (e) {
      console.warn("Failed to fetch profile", e);
    } finally {
      setIsLoading(false);
    }
  }, [user, dispatch, backendUrl, fetchRequests]);

  useEffect(() => {
    if (user?.id) {
      fetchProfileData();

      const socket = socketService.socket;
      if (socket) {
        const handleNewRequest = (data) => {
          if (data.provider_supabase_id === user.id) {
            fetchRequests();
          }
        };
        socket.on("new_service_request", handleNewRequest);

        const handleStatusUpdate = (data) => {
          fetchRequests();
        };
        socket.on("request_status_updated", handleStatusUpdate);

        return () => {
          socket.off("new_service_request", handleNewRequest);
          socket.off("request_status_updated", handleStatusUpdate);
        };
      }
    } else {
      setIsLoading(false);
    }
  }, [user, fetchProfileData, fetchRequests]);

  const onSetupProfile = async (data) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`${backendUrl}/api/providers/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supabase_id: user.id,
          name: data.name,
          main_service: data.main_service,
          status: "active",
        }),
      });
      const resData = await res.json();
      if (resData.success) {
        setProfile(resData.profile);
        setHasProfile(true);
        setIsAvailable(resData.profile.availability ?? true);
        dispatch(setProviderProfile(resData.profile));
      }
    } catch (error) {
      Alert.alert("Error", "Could not setup profile.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAvailability = async () => {
    const newStatus = !isAvailable;
    setIsAvailable(newStatus);

    try {
      const response = await fetch(`${backendUrl}/api/providers/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supabase_id: user.id,
          availability: newStatus,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        setIsAvailable(!newStatus);
        Alert.alert("Error", "Could not update availability status.");
      } else {
        if (profile) {
          setProfile({ ...profile, availability: newStatus });
          dispatch(setProviderProfile({ ...profile, availability: newStatus }));
        }
      }
    } catch (error) {
      setIsAvailable(!newStatus);
      Alert.alert("Error", "Backend unreachable.");
    }
  };

  const onFormError = (errors) => {
    const errorFields = Object.keys(errors).map((key) => {
      const fieldName = key.replace("_", " ");
      return fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
    });
    Alert.alert(
      "Validation Required",
      `Please fill in the following fields correctly:\n\n• ${errorFields.join("\n• ")}`,
    );
  };

  const onSaveService = async (data) => {
    setIsSubmitting(true);
    const payload = {
      ...data,
      provider_supabase_id: user?.id || "UNKNOWN",
      pricing: {
        hourly_rate: Number(data.hourly_rate),
        currency: data.currency,
      },
      experience_years: Number(data.experience_years),
      tools: tools,
      location_data: tempLocationData || {
        latitude: 33.729764,
        longitude: 72.949096,
        address: data.location || "Islamabad, Pakistan",
      },
      latitude: tempLocationData?.latitude || 33.729764,
      longitude: tempLocationData?.longitude || 72.949096,
      phone: data.phone,
      email: data.email,
      created_at: new Date().toISOString(),
    };

    try {
      if (editingServiceId) {
        const response = await fetch(
          `${backendUrl}/api/providers/services/${editingServiceId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        const resData = await response.json();
        if (resData.success) {
          Alert.alert("Success", "Service listing updated successfully!");
          fetchProfileData();
          setIsCreatingService(false);
          setEditingServiceId(null);
          reset();
          setTools([]);
          setTempLocationData(null);
        } else {
          Alert.alert("Error", resData.error || "Failed to update service.");
        }
      } else {
        const response = await fetch(`${backendUrl}/api/providers/service`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const resData = await response.json();
        if (resData.success) {
          Alert.alert("Success", "Service published successfully!");
          const newSvc = { ...payload, _id: resData.id };
          setServices((prev) => [...prev, newSvc]);
          setIsCreatingService(false);
          reset();
          setTools([]);
          setTempLocationData(null);
        } else {
          Alert.alert("Error", resData.error || "Failed to create service.");
        }
      }
    } catch (error) {
      Alert.alert(
        "Error",
        editingServiceId
          ? "Failed to update service."
          : "Failed to add service.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDeleteService = async (serviceId) => {
    if (!serviceId) return;
    Alert.alert(
      "Confirm Delete",
      "Are you sure you want to permanently delete this service listing from the marketplace?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Listing",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await fetch(
                `${backendUrl}/api/providers/services/${serviceId}`,
                {
                  method: "DELETE",
                },
              );
              const data = await res.json();
              if (data.success) {
                Alert.alert("Success", "Service listing deleted successfully.");
                setServices((prev) => prev.filter((s) => s._id !== serviceId));
              } else {
                Alert.alert("Error", data.error || "Failed to delete service.");
              }
            } catch (err) {
              Alert.alert("Error", "Could not reach backend server.");
            }
          },
        },
      ],
    );
  };

  const handleEditServicePress = (svc) => {
    setEditingServiceId(svc._id);
    reset({
      name: svc.name || "",
      service_type: svc.service_type || "",
      specialization: svc.specialization || "",
      description: svc.description || "",
      location: svc.location || "",
      hourly_rate: String(svc.pricing?.hourly_rate || ""),
      currency: svc.pricing?.currency || "PKR",
      experience_years: String(svc.experience_years || ""),
      languages: svc.languages || [],
      phone: svc.phone || "",
      email: svc.email || user?.email || "",
      travel_radius: String(svc.travel_radius || "10"),
      working_hours: svc.working_hours || "09:00 - 18:00",
      emergency_availability: svc.emergency_availability || false,
    });
    setTools(svc.tools || []);
    setTempLocationData(svc.location_data || null);
    setIsCreatingService(true);
  };

  const addTool = () => {
    if (toolInput.trim() && !tools.includes(toolInput.trim())) {
      setTools([...tools, toolInput.trim()]);
      setToolInput("");
    }
  };

  const removeTool = (tool) => {
    setTools(tools.filter((t) => t !== tool));
  };

  if (isLoading) {
    return (
      <View
        className={`flex-1 justify-center items-center ${isDark ? "bg-[#0f172a]" : "bg-white"}`}
      >
        <ActivityIndicator size="large" color={isDark ? "#f1f5f9" : "#000"} />
      </View>
    );
  }

  if (!hasProfile) {
    return (
      <SafeAreaView
        className={`flex-1 ${isDark ? "bg-[#0f172a]" : "bg-white"}`}
        edges={["bottom"]}
      >
        <ScrollView className="flex-1 px-6 pt-10">
          <View className="items-center mb-8">
            <View
              className={`w-20 h-20 rounded-full items-center justify-center mb-4 ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
            >
              <UserCircle size={40} color={isDark ? "#f1f5f9" : "#000"} />
            </View>
            <Text
              className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}
            >
              Setup Provider Profile
            </Text>
            <Text
              className={`text-center mt-2 px-4 ${isDark ? "text-slate-400" : "text-slate-500"}`}
            >
              Welcome to Flowtica! Tell us about your business to get started.
            </Text>
          </View>

          <View className="space-y-4">
            <View>
              <Text
                className={`text-xs font-bold uppercase mb-1 ml-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                Business Name
              </Text>
              <Controller
                control={control}
                name="name"
                rules={{ required: true }}
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    className={`rounded-2xl px-5 py-4 font-medium border ${isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-slate-50 border-slate-100 text-slate-900"}`}
                    placeholder="e.g. Ali AC Experts"
                    placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                    value={value}
                    onChangeText={onChange}
                  />
                )}
              />
            </View>

            <View>
              <Text
                className={`text-xs font-bold uppercase mb-1 ml-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
              >
                Main Service Category
              </Text>
              <Controller
                control={control}
                name="main_service"
                rules={{ required: true }}
                render={({ field: { onChange, value } }) => (
                  <Dropdown
                    style={{
                      backgroundColor: isDark ? "#1e293b" : "#f8fafc",
                      borderRadius: 16,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: isDark ? "#334155" : "#f1f5f9",
                    }}
                    containerStyle={{
                      backgroundColor: isDark ? "#1e293b" : "#fff",
                      borderRadius: 16,
                    }}
                    itemTextStyle={{
                      color: isDark ? "#f1f5f9" : "#0f172a",
                      fontSize: 14,
                    }}
                    activeColor={isDark ? "#334155" : "#f1f5f9"}
                    placeholderStyle={{
                      fontSize: 14,
                      color: isDark ? "#475569" : "#94a3b8",
                    }}
                    selectedTextStyle={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: isDark ? "#f1f5f9" : "#0f172a",
                    }}
                    data={SERVICE_CATEGORIES}
                    labelField="label"
                    valueField="value"
                    placeholder="Select primary service"
                    value={value}
                    onChange={(item) => onChange(item.value)}
                  />
                )}
              />
            </View>

            <Button
              title={isSubmitting ? "Setting up..." : "Launch Dashboard"}
              onPress={handleSubmit(onSetupProfile)}
              disabled={isSubmitting}
              className="mt-6 py-4 rounded-2xl bg-black"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-[#0f172a]" : "bg-slate-50"}`}
      edges={["bottom"]}
    >
      <ScrollView
        className="flex-1 px-5 pt-4"
        showsVerticalScrollIndicator={false}
      >
        <Card
          className={`mb-6 p-6 border-0 shadow-sm rounded-3xl ${isDark ? "bg-slate-900" : "bg-white"}`}
        >
          <View className="flex-row justify-between items-center mb-6">
            <View className="flex-row items-center">
              <View
                className={`w-14 h-14 rounded-2xl items-center justify-center mr-4 ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
              >
                <Text
                  className={`text-xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  {profile?.name?.charAt(0)}
                </Text>
              </View>
              <View>
                <Text
                  className={`text-xl font-black ${isDark ? "text-white" : "text-slate-900"}`}
                >
                  {profile?.name}
                </Text>
                <Text
                  className={`font-bold text-xs uppercase tracking-tight ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  {profile?.main_service}
                </Text>
              </View>
            </View>
            <View
              className={`flex-row items-center px-2 py-1 rounded-lg border ${isDark ? "bg-yellow-500/10 border-yellow-500/20" : "bg-yellow-50 border-yellow-100"}`}
            >
              <Star size={12} color="#eab308" fill="#eab308" />
              <Text className="text-yellow-500 font-black text-xs ml-1">
                {profile?.rating || "5.0"}
              </Text>
            </View>
          </View>

          <View
            className={`mb-6 pt-4 border-t ${isDark ? "border-slate-800" : "border-slate-100/80"}`}
          >
            <Text
              className={`text-[10px] font-extrabold uppercase tracking-widest mb-3 text-center ${isDark ? "text-slate-500" : "text-slate-400"}`}
            >
              Business Metrics & Dynamic Insights
            </Text>
            <View className="flex-row justify-between mb-4">
              <StatItem
                label="Total Jobs"
                value={profile?.total_jobs ?? 0}
                icon={Briefcase}
              />
              <StatItem
                label="Completed"
                value={profile?.completed_jobs ?? 0}
                icon={CheckCircle2}
              />
              <StatItem
                label="Active Req"
                value={profile?.active_requests ?? 0}
                icon={BarChart3}
              />
            </View>
            <View className="flex-row justify-between">
              <StatItem
                label="Earnings"
                value={`${profile?.total_earnings ?? 0} PKR`}
                icon={DollarSign}
              />
              <StatItem
                label="Hours"
                value={`${profile?.total_hours_worked ?? 0} hrs`}
                icon={Clock}
              />
              <StatItem
                label="Live Rating"
                value={profile?.rating || "5.0"}
                icon={Star}
              />
            </View>
          </View>

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View
                className={`w-2 h-2 rounded-full mr-2 ${isAvailable ? "bg-green-500" : "bg-slate-400"}`}
              />
              <Text
                className={`font-black text-xs uppercase tracking-tighter ${isAvailable ? "text-green-500" : isDark ? "text-slate-500" : "text-slate-400"}`}
              >
                {isAvailable ? "Accepting Orders" : "Offline"}
              </Text>
            </View>
            <Switch
              value={isAvailable}
              onValueChange={toggleAvailability}
              trackColor={{
                false: isDark ? "#334155" : "#e2e8f0",
                true: isDark ? "#f1f5f9" : "#000",
              }}
              thumbColor={isDark ? "#0f172a" : "#fff"}
            />
          </View>
        </Card>

        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <Text
                className={`text-lg font-black ${isDark ? "text-white" : "text-slate-900"}`}
              >
                Incoming Requests
              </Text>
              <Text
                className={`text-[10px] font-bold uppercase ${isDark ? "text-slate-500" : "text-slate-500"}`}
              >
                Assigned by AI Orchestrator
              </Text>
            </View>
            {requests.length > 0 && (
              <View className="bg-red-500 px-2 py-0.5 rounded-full">
                <Text className="text-white text-[10px] font-black">
                  {requests.filter((r) => r.status === "pending").length} Active
                </Text>
              </View>
            )}
          </View>

          {requests.length === 0 ? (
            <Card
              className={`p-6 rounded-3xl border-0 shadow-sm items-center justify-center py-8 ${isDark ? "bg-slate-900" : "bg-white"}`}
            >
              <Text
                className={`font-bold text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}
              >
                No incoming service requests.
              </Text>
            </Card>
          ) : (
            <View>
              {requests.map((req, idx) => {
                const getStatusColor = (status) => {
                  switch (status) {
                    case "approved":
                      return isDark
                        ? "bg-green-500/10 text-green-400 border-green-500/20"
                        : "bg-green-50 text-green-700 border-green-100";
                    case "denied":
                      return isDark
                        ? "bg-red-500/10 text-red-400 border-red-500/20"
                        : "bg-red-50 text-red-700 border-red-100";
                    case "counter_offer":
                      return isDark
                        ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                        : "bg-orange-50 text-orange-700 border-orange-100";
                    default:
                      return isDark
                        ? "bg-slate-800 text-slate-300 border-slate-700"
                        : "bg-slate-50 text-slate-700 border-slate-200";
                  }
                };

                return (
                  <Card
                    key={req._id || idx}
                    className={`mb-4 p-5 border-0 shadow-sm rounded-3xl ${isDark ? "bg-slate-900" : "bg-white"}`}
                  >
                    <View className="flex-row justify-between items-start mb-3">
                      <View className="flex-1 mr-2 flex-row items-center">
                        <View
                          className={`w-10 h-10 rounded-full items-center justify-center mr-3 border ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-200"}`}
                        >
                          <User
                            size={18}
                            color={isDark ? "#94a3b8" : "#64748b"}
                          />
                        </View>
                        <View className="flex-1">
                          <Text
                            className={`text-base font-black ${isDark ? "text-white" : "text-slate-900"}`}
                          >
                            {req.customer_name || "Valued Client"}
                          </Text>
                          <Text
                            className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-slate-500" : "text-slate-400"}`}
                          >
                            {req.customer_email ||
                              req.contact_email ||
                              "No email provided"}
                          </Text>
                        </View>
                      </View>
                      <View className="flex-row items-center space-x-2">
                        <View
                          className={`px-3 py-1 rounded-full border ${getStatusColor(req.status)}`}
                        >
                          <Text className="text-[9px] font-black uppercase tracking-tight">
                            {req.status}
                          </Text>
                        </View>
                        {(req.status === "approved" ||
                          req.status === "denied") && (
                            <TouchableOpacity
                              onPress={() => handleDeleteRequest(req)}
                              className={`p-1.5 rounded-full ${req.status === "approved" && !isRequestTimePassed(req) ? (isDark ? "bg-slate-800 opacity-40" : "bg-slate-100 opacity-40") : "bg-red-500/10"}`}
                            >
                              <Trash2
                                size={12}
                                color={
                                  req.status === "approved" &&
                                    !isRequestTimePassed(req)
                                    ? "#64748b"
                                    : "#ef4444"
                                }
                              />
                            </TouchableOpacity>
                          )}
                      </View>
                    </View>

                    <View
                      className={`space-y-2 py-3 border-y mb-4 ${isDark ? "border-slate-800" : "border-slate-50"}`}
                    >
                      <View
                        className={`mb-2 p-3 rounded-2xl ${isDark ? "bg-slate-800" : "bg-slate-50"}`}
                      >
                        <Text
                          className={`text-[9px] font-bold uppercase mb-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                        >
                          Service Requested
                        </Text>
                        <Text
                          className={`text-xs font-black ${isDark ? "text-slate-200" : "text-slate-700"}`}
                        >
                          {req.service_type} ({req.specialization})
                        </Text>
                      </View>
                      <View className="flex-row items-center">
                        <MapPin size={12} color="#64748b" />
                        <Text
                          className={`text-xs ml-2 font-bold ${isDark ? "text-slate-400" : "text-slate-600"}`}
                        >
                          {req.location}
                        </Text>
                      </View>

                      {req.customer_location_data && (
                        <TouchableOpacity
                          onPress={() => {
                            const lat = req.customer_location_data.latitude;
                            const lng = req.customer_location_data.longitude;
                            const label =
                              req.customer_name || "Customer Location";
                            const url = Platform.select({
                              ios: `maps:0,0?q=${label}@${lat},${lng}`,
                              android: `geo:0,0?q=${lat},${lng}(${label})`,
                            });
                            Linking.openURL(url);
                          }}
                          className="rounded-2xl overflow-hidden mb-3"
                        >
                          <MiniMap
                            latitude={req.customer_location_data.latitude}
                            longitude={req.customer_location_data.longitude}
                            address={req.customer_location_data.address}
                            height={130}
                          />
                        </TouchableOpacity>
                      )}
                      <View className="flex-row items-center">
                        <DollarSign size={12} color="#64748b" />
                        <Text
                          className={`text-xs ml-2 font-bold ${isDark ? "text-slate-400" : "text-slate-600"}`}
                        >
                          Offered Rate: {req.offered_price} PKR/USD
                        </Text>
                      </View>
                      <View className="flex-row items-center">
                        <Clock size={12} color="#64748b" />
                        <Text
                          className={`text-xs ml-2 font-bold ${isDark ? "text-slate-400" : "text-slate-600"}`}
                        >
                          Time Requested: {req.requested_date} at{" "}
                          {req.requested_time}
                        </Text>
                      </View>
                      {(req.customer_phone || req.contact_phone) &&
                        (req.customer_phone !== "Not provided" ||
                          req.contact_phone !== "Not provided") && (
                          <View
                            className={`mt-2 pt-2 border-t border-dashed ${isDark ? "border-slate-700" : "border-slate-100"}`}
                          >
                            <Text
                              className={`text-[9px] font-bold uppercase mb-2 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                            >
                              Client Contact
                            </Text>
                            <TouchableOpacity
                              onPress={() => {
                                const phone =
                                  req.customer_phone &&
                                    req.customer_phone !== "Not provided"
                                    ? req.customer_phone
                                    : req.contact_phone;
                                Linking.openURL(`tel:${phone}`);
                              }}
                              className={`flex-row items-center py-2 px-3 rounded-xl ${isDark ? "bg-slate-800" : "bg-slate-100"}`}
                            >
                              <Phone
                                size={14}
                                color={isDark ? "#3b82f6" : "#2563eb"}
                              />
                              <Text
                                className={`text-xs ml-2 font-black ${isDark ? "text-slate-200" : "text-slate-700"}`}
                              >
                                {req.customer_phone &&
                                  req.customer_phone !== "Not provided"
                                  ? req.customer_phone
                                  : req.contact_phone}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      {req.status === "counter_offer" && (
                        <View
                          className={`mt-2 p-3 rounded-2xl border ${isDark ? "bg-orange-500/5 border-orange-500/20" : "bg-orange-50/50 border-orange-100/50"}`}
                        >
                          <Text
                            className={`text-[9px] font-black uppercase mb-1 ${isDark ? "text-orange-400" : "text-orange-700"}`}
                          >
                            Counter Offer Sent
                          </Text>
                          <Text
                            className={`text-xs font-bold ${isDark ? "text-slate-300" : "text-slate-600"}`}
                          >
                            Price: {req.counter_price} PKR/USD
                          </Text>
                          <Text
                            className={`text-xs font-bold ${isDark ? "text-slate-300" : "text-slate-600"}`}
                          >
                            Time: {req.counter_date} at {req.counter_time}
                          </Text>
                          {req.counter_note && (
                            <Text
                              className={`text-xs italic mt-1 font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}
                            >
                              Note: "{req.counter_note}"
                            </Text>
                          )}
                        </View>
                      )}
                    </View>

                    {(req.status === "pending" ||
                      req.status === "counter_offer") && (
                        <View style={{ flexDirection: "row", gap: 12 }}>
                          <TouchableOpacity
                            onPress={() =>
                              handleRequestResponse(req._id, "approved")
                            }
                            className="flex-1 bg-green-500 py-3 rounded-2xl items-center justify-center"
                          >
                            <Text className="text-white font-black text-xs">
                              Approve
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              setSelectedRequest(req);
                              setCounterPrice(String(req.offered_price || ""));
                              setCounterDate(req.requested_date || "");
                              setCounterTime(req.requested_time || "");
                              setCounterNote("");
                              setIsCounterModalOpen(true);
                            }}
                            className={`flex-1 py-3 rounded-2xl items-center justify-center ${isDark ? "bg-slate-700" : "bg-slate-900"}`}
                          >
                            <Text className="text-white font-black text-xs">
                              Counter
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() =>
                              handleRequestResponse(req._id, "denied")
                            }
                            className="flex-1 bg-red-500/10 py-3 rounded-2xl items-center justify-center"
                          >
                            <Text className="text-red-500 font-black text-xs">
                              Deny
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                  </Card>
                );
              })}
            </View>
          )}
        </View>

        <View className="flex-row justify-between items-center mb-4">
          <View>
            <Text
              className={`text-lg font-black ${isDark ? "text-white" : "text-slate-900"}`}
            >
              Portfolio
            </Text>
            <Text
              className={`text-[10px] font-bold uppercase ${isDark ? "text-slate-500" : "text-slate-500"}`}
            >
              Active Listings
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => {
              setEditingServiceId(null);
              reset({
                name: "",
                service_type: "",
                specialization: "",
                description: "",
                location: "",
                hourly_rate: "",
                currency: "PKR",
                experience_years: "",
                languages: [],
                phone: "",
                email: user?.email || "",
                travel_radius: "10",
                working_hours: "09:00 - 18:00",
                emergency_availability: false,
              });
              setTools([]);
              setTempLocationData(null);
              setIsCreatingService(true);
            }}
            className={`flex-row items-center px-4 py-2 rounded-2xl shadow-lg ${isDark ? "bg-slate-100" : "bg-black"}`}
            style={{ flexShrink: 0 }}
          >
            <Plus
              size={16}
              color={isDark ? "#0f172a" : "#fff"}
              strokeWidth={3}
            />
            <Text
              className={`font-black ml-1.5 text-xs ${isDark ? "text-slate-900" : "text-white"}`}
              numberOfLines={1}
            >
              Add New
            </Text>
          </TouchableOpacity>
        </View>

        {services.length === 0 ? (
          <View
            className={`items-center py-10 rounded-3xl border border-dashed mb-6 ${isDark ? "border-slate-700 bg-slate-900/50" : "border-slate-200 bg-white"}`}
          >
            <Text
              className={`font-bold text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}
            >
              No services listed yet.
            </Text>
          </View>
        ) : (
          <View className="mb-6">
            {services.map((svc, index) => (
              <ServiceCard
                key={index}
                service={svc}
                onEdit={() => handleEditServicePress(svc)}
                onDelete={() => onDeleteService(svc._id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        isVisible={isCreatingService}
        onBackdropPress={() => setIsCreatingService(false)}
        style={{ margin: 0, justifyContent: "flex-end" }}
        avoidKeyboard
      >
        <View
          className={`rounded-t-[40px] p-6 max-h-[90%] ${isDark ? "bg-slate-900" : "bg-white"}`}
        >
          <View
            className={`w-12 h-1.5 rounded-full self-center mb-6 ${isDark ? "bg-slate-700" : "bg-slate-200"}`}
          />

          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text
                className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}
              >
                {editingServiceId ? "Edit Service" : "New Service"}
              </Text>
              <Text className={isDark ? "text-slate-400" : "text-slate-500"}>
                {editingServiceId
                  ? "Modify your marketplace listing"
                  : "Create a new marketplace listing"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsCreatingService(false)}
              className={`p-2 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-50"}`}
            >
              <X size={20} color={isDark ? "#f1f5f9" : "#000"} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="mb-6">
            <View className="space-y-6">
              <View>
                <Text
                  className={`text-xs font-black uppercase tracking-widest mb-4 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                >
                  Basic Information
                </Text>
                <View className="mb-4">
                  <Text
                    className={`text-[10px] font-bold uppercase mb-1.5 ml-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                  >
                    Service Listing Title
                  </Text>
                  <Controller
                    control={control}
                    name="name"
                    rules={{ required: "Required" }}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        className={`rounded-2xl px-5 py-4 font-medium border ${isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-100 text-slate-900"}`}
                        placeholder="e.g. Emergency AC Repair"
                        placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                        value={value}
                        onChangeText={onChange}
                      />
                    )}
                  />
                </View>

                <View className="flex-row space-x-3 mb-4">
                  <View className="flex-1 mr-1.5">
                    <Text
                      className={`text-[10px] font-bold uppercase mb-1.5 ml-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    >
                      Category
                    </Text>
                    <Controller
                      control={control}
                      name="service_type"
                      rules={{ required: true }}
                      render={({ field: { onChange, value } }) => (
                        <Dropdown
                          style={{
                            backgroundColor: isDark ? "#1e293b" : "#f8fafc",
                            borderRadius: 16,
                            padding: 14,
                            borderWidth: 1,
                            borderColor: isDark ? "#334155" : "#f1f5f9",
                          }}
                          containerStyle={{
                            backgroundColor: isDark ? "#1e293b" : "#fff",
                            borderRadius: 16,
                          }}
                          itemTextStyle={{
                            color: isDark ? "#f1f5f9" : "#0f172a",
                            fontSize: 13,
                          }}
                          activeColor={isDark ? "#334155" : "#f1f5f9"}
                          placeholderStyle={{
                            fontSize: 13,
                            color: isDark ? "#475569" : "#94a3b8",
                          }}
                          selectedTextStyle={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: isDark ? "#f1f5f9" : "#0f172a",
                          }}
                          data={SERVICE_CATEGORIES}
                          labelField="label"
                          valueField="value"
                          search
                          placeholder="Select"
                          value={value}
                          onChange={(item) => onChange(item.value)}
                        />
                      )}
                    />
                  </View>
                  <View className="flex-1 ml-1.5">
                    <Text
                      className={`text-[10px] font-bold uppercase mb-1.5 ml-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    >
                      Specialization
                    </Text>
                    <Controller
                      control={control}
                      name="specialization"
                      rules={{ required: true }}
                      render={({ field: { onChange, value } }) => (
                        <Dropdown
                          style={{
                            backgroundColor: isDark ? "#1e293b" : "#f8fafc",
                            borderRadius: 16,
                            padding: 14,
                            borderWidth: 1,
                            borderColor: isDark ? "#334155" : "#f1f5f9",
                          }}
                          containerStyle={{
                            backgroundColor: isDark ? "#1e293b" : "#fff",
                            borderRadius: 16,
                          }}
                          itemTextStyle={{
                            color: isDark ? "#f1f5f9" : "#0f172a",
                            fontSize: 13,
                          }}
                          activeColor={isDark ? "#334155" : "#f1f5f9"}
                          placeholderStyle={{
                            fontSize: 13,
                            color: isDark ? "#475569" : "#94a3b8",
                          }}
                          selectedTextStyle={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: isDark ? "#f1f5f9" : "#0f172a",
                          }}
                          data={
                            selectedServiceType
                              ? SPECIALIZATIONS_MAP[selectedServiceType] || []
                              : []
                          }
                          labelField="label"
                          valueField="value"
                          placeholder="Select"
                          disabled={!selectedServiceType}
                          value={value}
                          onChange={(item) => onChange(item.value)}
                        />
                      )}
                    />
                  </View>
                </View>

                <View>
                  <Text
                    className={`text-[10px] font-bold uppercase mb-1.5 ml-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                  >
                    Description
                  </Text>
                  <Controller
                    control={control}
                    name="description"
                    rules={{ required: true }}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        className={`rounded-2xl px-5 py-4 font-medium h-32 border ${isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-100 text-slate-900"}`}
                        placeholder="Detailed description of what you offer..."
                        placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                        multiline
                        textAlignVertical="top"
                        value={value}
                        onChangeText={onChange}
                      />
                    )}
                  />
                </View>
              </View>

              <View>
                <Text
                  className={`text-xs font-black uppercase tracking-widest mb-4 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                >
                  Rates & Experience
                </Text>
                <View className="flex-row space-x-3 mb-4">
                  <View className="flex-1 mr-1.5">
                    <Text
                      className={`text-[10px] font-bold uppercase mb-1.5 ml-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    >
                      Hourly Rate
                    </Text>
                    <Controller
                      control={control}
                      name="hourly_rate"
                      rules={{ required: true }}
                      render={({ field: { onChange, value } }) => (
                        <TextInput
                          className={`rounded-2xl px-5 py-4 font-bold border ${isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-100 text-slate-900"}`}
                          keyboardType="numeric"
                          placeholder="00"
                          placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                          value={value}
                          onChangeText={onChange}
                        />
                      )}
                    />
                  </View>
                  <View className="flex-1 ml-1.5">
                    <Text
                      className={`text-[10px] font-bold uppercase mb-1.5 ml-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    >
                      Experience (Years)
                    </Text>
                    <Controller
                      control={control}
                      name="experience_years"
                      rules={{ required: true }}
                      render={({ field: { onChange, value } }) => (
                        <TextInput
                          className={`rounded-2xl px-5 py-4 font-bold border ${isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-100 text-slate-900"}`}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                          value={value}
                          onChangeText={onChange}
                        />
                      )}
                    />
                  </View>
                </View>
                <View className="mb-4">
                  <Text
                    className={`text-[10px] font-bold uppercase mb-1.5 ml-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                  >
                    Primary Service Location
                  </Text>
                  <Controller
                    control={control}
                    name="location"
                    rules={{ required: true }}
                    render={({ field: { onChange, value } }) => (
                      <View>
                        <View
                          className={`flex-row items-center rounded-2xl border overflow-hidden ${isDark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-100"
                            }`}
                        >
                          <TextInput
                            className={`flex-1 px-5 py-4 font-medium ${isDark ? "text-white" : "text-slate-900"}`}
                            placeholder="e.g. Islamabad, I-14"
                            placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                            value={value}
                            onChangeText={onChange}
                          />
                          <TouchableOpacity
                            onPress={() => setShowMap(true)}
                            className={`px-4 py-4 ${isDark ? "bg-slate-700" : "bg-slate-200"}`}
                          >
                            <Map size={18} color={isDark ? "#cbd5e1" : "#0f172a"} />
                          </TouchableOpacity>
                        </View>
                        {tempLocationData && (
                          <View className="mt-4 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                            <MiniMap
                              latitude={tempLocationData.latitude}
                              longitude={tempLocationData.longitude}
                              height={100}
                            />
                          </View>
                        )}
                      </View>
                    )}
                  />
                </View>

                <View className="flex-row space-x-3 mb-4">
                  <View className="flex-1 mr-1.5">
                    <Text
                      className={`text-[10px] font-bold uppercase mb-1.5 ml-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    >
                      Travel Radius (km)
                    </Text>
                    <Controller
                      control={control}
                      name="travel_radius"
                      rules={{ required: true }}
                      render={({ field: { onChange, value } }) => (
                        <TextInput
                          className={`rounded-2xl px-5 py-4 font-bold border ${isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-100 text-slate-900"}`}
                          keyboardType="numeric"
                          placeholder="10"
                          placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                          value={value}
                          onChangeText={onChange}
                        />
                      )}
                    />
                  </View>
                  <View className="flex-1 ml-1.5">
                    <Text
                      className={`text-[10px] font-bold uppercase mb-1.5 ml-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                    >
                      Working Hours
                    </Text>
                    <Controller
                      control={control}
                      name="working_hours"
                      rules={{ required: true }}
                      render={({ field: { onChange, value } }) => (
                        <TextInput
                          className={`rounded-2xl px-5 py-4 font-bold border ${isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-100 text-slate-900"}`}
                          placeholder="09:00 - 18:00"
                          placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                          value={value}
                          onChangeText={onChange}
                        />
                      )}
                    />
                  </View>
                </View>

                <View className="flex-row items-center justify-between mb-6 p-4 rounded-3xl border border-dashed border-slate-200">
                  <View>
                    <Text
                      className={`text-xs font-black uppercase ${isDark ? "text-white" : "text-slate-900"}`}
                    >
                      Emergency Service
                    </Text>
                    <Text
                      className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}
                    >
                      Available for urgent requests 24/7
                    </Text>
                  </View>
                  <Controller
                    control={control}
                    name="emergency_availability"
                    render={({ field: { onChange, value } }) => (
                      <Switch
                        value={value}
                        onValueChange={onChange}
                        trackColor={{ false: "#e2e8f0", true: "#000" }}
                      />
                    )}
                  />
                </View>
              </View>

              <View>
                <Text
                  className={`text-xs font-black uppercase tracking-widest mb-4 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                >
                  Languages & Skills
                </Text>
                <View className="mb-4">
                  <Text
                    className={`text-[10px] font-bold uppercase mb-1.5 ml-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                  >
                    Languages
                  </Text>
                  <Controller
                    control={control}
                    name="languages"
                    render={({ field: { onChange, value } }) => (
                      <MultiSelect
                        style={{
                          backgroundColor: isDark ? "#1e293b" : "#f8fafc",
                          borderRadius: 16,
                          padding: 14,
                          borderWidth: 1,
                          borderColor: isDark ? "#334155" : "#f1f5f9",
                        }}
                        containerStyle={{
                          backgroundColor: isDark ? "#1e293b" : "#fff",
                          borderRadius: 16,
                        }}
                        itemTextStyle={{
                          color: isDark ? "#f1f5f9" : "#0f172a",
                          fontSize: 13,
                        }}
                        activeColor={isDark ? "#334155" : "#f1f5f9"}
                        placeholderStyle={{
                          fontSize: 13,
                          color: isDark ? "#475569" : "#94a3b8",
                        }}
                        selectedTextStyle={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: isDark ? "#f1f5f9" : "#0f172a",
                        }}
                        data={LANGUAGE_OPTIONS}
                        labelField="label"
                        valueField="value"
                        placeholder="Select languages"
                        value={value}
                        onChange={(item) => onChange(item)}
                        renderSelectedItem={(item, unSelect) => (
                          <TouchableOpacity
                            onPress={() => unSelect && unSelect(item)}
                          >
                            <View
                              className={`rounded-lg px-3 py-1 mr-2 mt-2 flex-row items-center ${isDark ? "bg-slate-700" : "bg-slate-900"}`}
                            >
                              <Text className="text-white text-xs font-bold mr-2">
                                {item.label}
                              </Text>
                              <X size={10} color="#fff" />
                            </View>
                          </TouchableOpacity>
                        )}
                      />
                    )}
                  />
                </View>

                <View>
                  <Text
                    className={`text-[10px] font-bold uppercase mb-1.5 ml-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                  >
                    Tools & Equipment
                  </Text>
                  <View className="flex-row mb-2">
                    <TextInput
                      className={`rounded-2xl px-5 py-4 font-medium flex-1 mr-2 border ${isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-100 text-slate-900"}`}
                      placeholder="Add tool..."
                      placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                      value={toolInput}
                      onChangeText={setToolInput}
                      onSubmitEditing={addTool}
                    />
                    <TouchableOpacity
                      onPress={addTool}
                      className={`w-14 rounded-2xl items-center justify-center ${isDark ? "bg-slate-700" : "bg-slate-900"}`}
                    >
                      <Plus size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  <View className="flex-row flex-wrap">
                    {tools.map((t, i) => (
                      <Chip key={i} label={t} onRemove={() => removeTool(t)} />
                    ))}
                  </View>
                </View>
              </View>

              <View>
                <Text
                  className={`text-xs font-black uppercase tracking-widest mb-4 ${isDark ? "text-slate-500" : "text-slate-400"}`}
                >
                  Contact Details
                </Text>
                <View className="mb-4">
                  <Text
                    className={`text-[10px] font-bold uppercase mb-1.5 ml-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                  >
                    Phone Number
                  </Text>
                  <Controller
                    control={control}
                    name="phone"
                    rules={{ required: true }}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        className={`rounded-2xl px-5 py-4 font-medium border ${isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-100 text-slate-900"}`}
                        placeholder="+92 3XX XXXXXXX"
                        placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                        keyboardType="phone-pad"
                        value={value}
                        onChangeText={onChange}
                      />
                    )}
                  />
                </View>
              </View>

              <Button
                title={
                  isSubmitting
                    ? editingServiceId
                      ? "Saving..."
                      : "Publishing..."
                    : editingServiceId
                      ? "Save Changes"
                      : "Launch Service"
                }
                onPress={handleSubmit(onSaveService, onFormError)}
                disabled={isSubmitting}
                className="py-5 rounded-3xl mb-10 shadow-2xl"
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        isVisible={isCounterModalOpen}
        onBackdropPress={() => setIsCounterModalOpen(false)}
        style={{ margin: 0, justifyContent: "flex-end" }}
        avoidKeyboard
      >
        <View
          className={`rounded-t-[40px] p-6 max-h-[85%] ${isDark ? "bg-slate-900" : "bg-white"}`}
        >
          <View
            className={`w-12 h-1.5 rounded-full self-center mb-6 ${isDark ? "bg-slate-700" : "bg-slate-200"}`}
          />

          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text
                className={`text-2xl font-black ${isDark ? "text-white" : "text-slate-900"}`}
              >
                Approve with Changes
              </Text>
              <Text className={isDark ? "text-slate-400" : "text-slate-500"}>
                Send counter-offer to {selectedRequest?.customer_name}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsCounterModalOpen(false)}
              className={`p-2 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-50"}`}
            >
              <X size={20} color={isDark ? "#f1f5f9" : "#000"} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="mb-6">
            <View className="space-y-6">
              <View>
                <Text
                  className={`text-[10px] font-bold uppercase mb-1.5 ml-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  Counter Price (PKR/USD)
                </Text>
                <TextInput
                  className={`rounded-2xl px-5 py-4 font-bold border ${isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-100 text-slate-900"}`}
                  placeholder="e.g. 35"
                  placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                  keyboardType="numeric"
                  value={counterPrice}
                  onChangeText={setCounterPrice}
                />
              </View>

              <View className="flex-row space-x-3">
                <View className="flex-1 mr-1.5">
                  <Text
                    className={`text-[10px] font-bold uppercase mb-1.5 ml-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                  >
                    New Date
                  </Text>
                  <TextInput
                    className={`rounded-2xl px-5 py-4 font-medium border ${isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-100 text-slate-900"}`}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                    value={counterDate}
                    onChangeText={setCounterDate}
                  />
                </View>
                <View className="flex-1 ml-1.5">
                  <Text
                    className={`text-[10px] font-bold uppercase mb-1.5 ml-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                  >
                    New Time
                  </Text>
                  <TextInput
                    className={`rounded-2xl px-5 py-4 font-medium border ${isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-100 text-slate-900"}`}
                    placeholder="HH:MM"
                    placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                    value={counterTime}
                    onChangeText={setCounterTime}
                  />
                </View>
              </View>

              <View>
                <Text
                  className={`text-[10px] font-bold uppercase mb-1.5 ml-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}
                >
                  Message to Customer (Optional)
                </Text>
                <TextInput
                  className={`rounded-2xl px-5 py-4 font-medium h-24 border ${isDark ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-100 text-slate-900"}`}
                  placeholder="Explain your changes..."
                  placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                  multiline
                  textAlignVertical="top"
                  value={counterNote}
                  onChangeText={setCounterNote}
                />
              </View>

              <Button
                title="Send Counter Offer"
                onPress={() => {
                  if (!counterPrice || !counterDate || !counterTime) {
                    Alert.alert(
                      "Required Fields",
                      "Please enter new Price, Date and Time.",
                    );
                    return;
                  }
                  handleRequestResponse(selectedRequest._id, "counter_offer", {
                    counter_price: Number(counterPrice),
                    counter_date: counterDate,
                    counter_time: counterTime,
                    counter_note: counterNote,
                  });
                  setIsCounterModalOpen(false);
                }}
                className="py-5 rounded-3xl mb-10 shadow-2xl"
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      <LocationPickerModal
        visible={showMap}
        onClose={() => setShowMap(false)}
        onConfirm={(locData) => {
          setTempLocationData(locData);
          if (locData.address) {
            setValue("location", locData.address);
          }
          setShowMap(false);
        }}
        initialLocation={tempLocationData}
      />
    </SafeAreaView>
  );
}
