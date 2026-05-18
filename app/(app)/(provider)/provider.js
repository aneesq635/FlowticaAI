import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useState, useEffect, useCallback } from 'react';
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
  FlatList
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSelector, useDispatch } from 'react-redux';
import { setProviderProfile } from '../../../store/orchestrationSlice';
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
  User
} from 'lucide-react-native';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useAuth } from '../../../components/AuthContext';
import { useForm, Controller } from 'react-hook-form';
import { Dropdown, MultiSelect } from 'react-native-element-dropdown';
import Modal from 'react-native-modal';
import socketService from '../../../services/socket';

// --- Constants ---
const SERVICE_CATEGORIES = [
  { label: 'AC Repair', value: 'AC Repair' },
  { label: 'Electrician', value: 'Electrician' },
  { label: 'Plumbing', value: 'Plumbing' },
  { label: 'Cleaning', value: 'Cleaning' },
  { label: 'Mechanic', value: 'Mechanic' },
  { label: 'Tutor', value: 'Tutor' },
  { label: 'Beautician', value: 'Beautician' },
  { label: 'Carpenter', value: 'Carpenter' },
];

const SPECIALIZATIONS_MAP = {
  'Mechanic': [
    { label: 'Suspension', value: 'Suspension' },
    { label: 'Engine', value: 'Engine' },
    { label: 'Brake System', value: 'Brake System' },
    { label: 'Oil Change', value: 'Oil Change' },
  ],
  'AC Repair': [
    { label: 'Split AC', value: 'Split AC' },
    { label: 'Inverter AC', value: 'Inverter AC' },
    { label: 'Gas Charging', value: 'Gas Charging' },
    { label: 'Central Cooling', value: 'Central Cooling' },
  ],
  'Electrician': [
    { label: 'Wiring', value: 'Wiring' },
    { label: 'Appliance Repair', value: 'Appliance Repair' },
    { label: 'Lighting', value: 'Lighting' },
  ],
  'Plumbing': [
    { label: 'Leakage Fix', value: 'Leakage Fix' },
    { label: 'Installation', value: 'Installation' },
    { label: 'Drainage', value: 'Drainage' },
  ],
  'Cleaning': [
    { label: 'Deep Cleaning', value: 'Deep Cleaning' },
    { label: 'Sofa Cleaning', value: 'Sofa Cleaning' },
    { label: 'Kitchen Cleaning', value: 'Kitchen Cleaning' },
  ],
};

const LANGUAGE_OPTIONS = [
  { label: 'English', value: 'English' },
  { label: 'Urdu', value: 'Urdu' },
  { label: 'Punjabi', value: 'Punjabi' },
  { label: 'Pashto', value: 'Pashto' },
];

// --- Sub-components ---

const StatItem = ({ label, value, icon: Icon }) => (
  <View className="items-center flex-1">
    <View className="bg-slate-50 p-2 rounded-xl mb-1">
      <Icon size={18} color="#000" />
    </View>
    <Text className="text-lg font-bold text-slate-900">{value}</Text>
    <Text className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{label}</Text>
  </View>
);

const ServiceCard = ({ service, onEdit, onDelete }) => (
  <Card className="mb-4 p-4 bg-white border-slate-100 shadow-sm overflow-hidden">
    <View className="flex-row justify-between items-start mb-2">
      <View className="flex-1">
        <Text className="text-base font-bold text-slate-900">{service.name}</Text>
        <View className="flex-row items-center mt-1">
          <View className="bg-slate-900 px-2 py-0.5 rounded-md mr-2">
            <Text className="text-[10px] text-white font-bold">{service.service_type}</Text>
          </View>
          <Text className="text-xs text-slate-500 font-medium">{service.specialization}</Text>
        </View>
      </View>
      <View className="flex-row space-x-2">
        <TouchableOpacity onPress={onEdit} className="p-2 bg-slate-50 rounded-full">
          <Edit2 size={14} color="#64748b" />
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} className="p-2 bg-red-50 rounded-full">
          <Trash2 size={14} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>

    <Text className="text-sm text-slate-600 mb-4 leading-relaxed" numberOfLines={2}>
      {service.description}
    </Text>

    <View className="flex-row items-center justify-between pt-4 border-t border-slate-50">
      <View className="flex-row space-x-3">
        <View className="flex-row items-center">
          <MapPin size={12} color="#64748b" />
          <Text className="text-xs text-slate-500 ml-1 font-bold">{service.location}</Text>
        </View>
        <View className="flex-row items-center">
          <Clock size={12} color="#64748b" />
          <Text className="text-xs text-slate-500 ml-1 font-bold">{service.experience_years}y Exp</Text>
        </View>
      </View>
      <View className="bg-green-50 px-3 py-1 rounded-full border border-green-100">
        <Text className="text-xs text-green-700 font-bold">
          {service.pricing?.hourly_rate} {service.pricing?.currency}/hr
        </Text>
      </View>
    </View>
  </Card>
);

const Chip = ({ label, onRemove }) => (
  <View className="bg-slate-100 px-3 py-1.5 rounded-full flex-row items-center mr-2 mb-2 border border-slate-200">
    <Text className="text-xs font-bold text-slate-700">{label}</Text>
    {onRemove && (
      <TouchableOpacity onPress={onRemove} className="ml-2">
        <X size={12} color="#64748b" />
      </TouchableOpacity>
    )}
  </View>
);

// --- Main Component ---

export default function ProviderDashboard() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { user } = useAuth();
  const currentBooking = useSelector(state => state.orchestration.currentBooking);

  const [isLoading, setIsLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(false);
  const [profile, setProfile] = useState(null);
  const [services, setServices] = useState([]);
  const [isCreatingService, setIsCreatingService] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [tools, setTools] = useState([]);
  const [toolInput, setToolInput] = useState('');

  // --- Incoming Request States ---
  const [requests, setRequests] = useState([]);
  const [isCounterModalOpen, setIsCounterModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterDate, setCounterDate] = useState('');
  const [counterTime, setCounterTime] = useState('');
  const [counterNote, setCounterNote] = useState('');

  const { control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    defaultValues: {
      name: '',
      service_type: '',
      specialization: '',
      description: '',
      location: '',
      hourly_rate: '',
      currency: 'PKR',
      experience_years: '',
      languages: [],
      phone: '',
      email: user?.email || '',
    }
  });

  const selectedServiceType = watch('service_type');

  const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.0.102:5000';

  const fetchRequests = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${backendUrl}/api/providers/requests/${user.id}`);
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests || []);
      }
    } catch (e) {
      console.warn("Failed to fetch requests", e);
    }
  }, [user, backendUrl]);

  const handleRequestResponse = async (requestId, status, counterDetails = null) => {
    try {
      const res = await fetch(`${backendUrl}/api/providers/requests/${requestId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          ...counterDetails
        })
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert("Success", `Request successfully ${status === 'approved' ? 'approved' : status === 'denied' ? 'denied' : 'countered'}.`);
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

      // Handle suffix removal like '20th May' -> '20 May'
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
    if (req.status === 'approved' && !isRequestTimePassed(req)) {
      Alert.alert(
        "Request Locked",
        "Approved requests cannot be deleted before the scheduled time has passed.",
        [{ text: "OK" }]
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
              const res = await fetch(`${backendUrl}/api/providers/requests/${req._id}`, {
                method: 'DELETE'
              });
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
          }
        }
      ]
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
        fetchRequests(); // Also fetch incoming requests
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
      
      // Setup real-time Socket.IO listener
      const socket = socketService.socket;
      if (socket) {
        const handleNewRequest = (data) => {
          if (data.provider_supabase_id === user.id) {
            console.log("[PROVIDER DASHBOARD] Real-time socket request alert received!");
            fetchRequests();
          }
        };
        socket.on('new_service_request', handleNewRequest);
        return () => {
          socket.off('new_service_request', handleNewRequest);
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabase_id: user.id,
          name: data.name,
          main_service: data.main_service,
          status: 'active'
        })
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supabase_id: user.id,
          availability: newStatus
        })
      });
      
      const data = await response.json();
      if (!data.success) {
        // Rollback on failure
        setIsAvailable(!newStatus);
        Alert.alert("Error", "Could not update availability status.");
      } else {
        // Update local profile state
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
    console.warn("[FORM ERROR] Validation failed:", errors);
    const errorFields = Object.keys(errors).map(key => {
      const fieldName = key.replace('_', ' ');
      return fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
    });
    Alert.alert(
      "Validation Required", 
      `Please fill in the following fields correctly:\n\n• ${errorFields.join('\n• ')}`
    );
  };

  const onSaveService = async (data) => {
    setIsSubmitting(true);
    const payload = {
      provider_supabase_id: user?.id || 'UNKNOWN',
      name: data.name,
      service_type: data.service_type,
      specialization: data.specialization,
      description: data.description,
      location: data.location,
      coordinates: { lat: 33.729764, lng: 72.949096 },
      rating: 5,
      review_count: 0,
      pricing: {
        hourly_rate: Number(data.hourly_rate),
        currency: data.currency
      },
      availability: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      experience_years: Number(data.experience_years),
      languages: data.languages,
      certifications: [],
      tools: tools,
      phone: data.phone,
      email: data.email,
      created_at: new Date().toISOString()
    };

    try {
      if (editingServiceId) {
        // UPDATE MODE
        const response = await fetch(`${backendUrl}/api/providers/services/${editingServiceId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const resData = await response.json();
        if (resData.success) {
          Alert.alert("Success", "Service listing updated successfully!");
          // Refresh list
          fetchProfileData();
          setIsCreatingService(false);
          setEditingServiceId(null);
          reset();
          setTools([]);
        } else {
          Alert.alert("Error", resData.error || "Failed to update service.");
        }
      } else {
        // CREATE MODE
        const response = await fetch(`${backendUrl}/api/providers/service`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const resData = await response.json();
        if (resData.success) {
          Alert.alert("Success", "Service published successfully!");
          // Append with server-provided ID
          const newSvc = { ...payload, _id: resData.id };
          setServices(prev => [...prev, newSvc]);
          setIsCreatingService(false);
          reset();
          setTools([]);
        } else {
          Alert.alert("Error", resData.error || "Failed to create service.");
        }
      }
    } catch (error) {
      Alert.alert("Error", editingServiceId ? "Failed to update service." : "Failed to add service.");
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
              const res = await fetch(`${backendUrl}/api/providers/services/${serviceId}`, {
                method: 'DELETE'
              });
              const data = await res.json();
              if (data.success) {
                Alert.alert("Success", "Service listing deleted successfully.");
                setServices(prev => prev.filter(s => s._id !== serviceId));
              } else {
                Alert.alert("Error", data.error || "Failed to delete service.");
              }
            } catch (err) {
              Alert.alert("Error", "Could not reach backend server.");
            }
          }
        }
      ]
    );
  };

  const handleEditServicePress = (svc) => {
    setEditingServiceId(svc._id);
    reset({
      name: svc.name || '',
      service_type: svc.service_type || '',
      specialization: svc.specialization || '',
      description: svc.description || '',
      location: svc.location || '',
      hourly_rate: String(svc.pricing?.hourly_rate || ''),
      currency: svc.pricing?.currency || 'PKR',
      experience_years: String(svc.experience_years || ''),
      languages: svc.languages || [],
      phone: svc.phone || '',
      email: svc.email || user?.email || '',
    });
    setTools(svc.tools || []);
    setIsCreatingService(true);
  };

  const addTool = () => {
    if (toolInput.trim() && !tools.includes(toolInput.trim())) {
      setTools([...tools, toolInput.trim()]);
      setToolInput('');
    }
  };

  const removeTool = (tool) => {
    setTools(tools.filter(t => t !== tool));
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  // --- Onboarding Setup ---
  if (!hasProfile) {
    return (
      <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
        <ScrollView className="flex-1 px-6 pt-10">
          <View className="items-center mb-8">
            <View className="w-20 h-20 bg-slate-100 rounded-full items-center justify-center mb-4">
              <UserCircle size={40} color="#000" />
            </View>
            <Text className="text-2xl font-black text-slate-900">Setup Provider Profile</Text>
            <Text className="text-slate-500 text-center mt-2 px-4">
              Welcome to Flowtica! Tell us about your business to get started.
            </Text>
          </View>

          <View className="space-y-4">
            <View>
              <Text className="text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Business Name</Text>
              <Controller
                control={control}
                name="name"
                rules={{ required: true }}
                render={({ field: { onChange, value } }) => (
                  <TextInput 
                    className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-medium" 
                    placeholder="e.g. Ali AC Experts"
                    value={value}
                    onChangeText={onChange}
                  />
                )}
              />
            </View>

            <View>
              <Text className="text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Main Service Category</Text>
              <Controller
                control={control}
                name="main_service"
                rules={{ required: true }}
                render={({ field: { onChange, value } }) => (
                  <Dropdown
                    style={{ backgroundColor: '#f8fafc', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f1f5f9' }}
                    placeholderStyle={{ fontSize: 14, color: '#94a3b8' }}
                    selectedTextStyle={{ fontSize: 14, fontWeight: '600', color: '#0f172a' }}
                    data={SERVICE_CATEGORIES}
                    labelField="label"
                    valueField="value"
                    placeholder="Select primary service"
                    value={value}
                    onChange={item => onChange(item.value)}
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
    <SafeAreaView className="flex-1 bg-slate-50" edges={['bottom']}>
      <ScrollView 
        className="flex-1 px-5 pt-4"
        showsVerticalScrollIndicator={false}
      >
        {/* Modern Profile Header */}
        <Card className="mb-6 p-6 bg-white border-0 shadow-sm rounded-3xl">
          <View className="flex-row justify-between items-center mb-6">
            <View className="flex-row items-center">
              <View className="w-14 h-14 bg-slate-100 rounded-2xl items-center justify-center mr-4">
                <Text className="text-xl font-bold">{profile?.name?.charAt(0)}</Text>
              </View>
              <View>
                <Text className="text-xl font-black text-slate-900">{profile?.name}</Text>
                <Text className="text-slate-500 font-bold text-xs uppercase tracking-tight">{profile?.main_service}</Text>
              </View>
            </View>
            <View className="items-end">
              <View className="flex-row items-center bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-100">
                <Star size={12} color="#eab308" fill="#eab308" />
                <Text className="text-yellow-700 font-black text-xs ml-1">{profile?.rating || "5.0"}</Text>
              </View>
            </View>
          </View>

          {/* 6 Critical Metrics dynamic grid */}
          <View className="mb-6 pt-4 border-t border-slate-100/80">
            <Text className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-3 text-center">Business Metrics & Dynamic Insights</Text>
            <View className="flex-row justify-between mb-4">
              <StatItem label="Total Jobs" value={profile?.total_jobs ?? 0} icon={Briefcase} />
              <StatItem label="Completed" value={profile?.completed_jobs ?? 0} icon={Award} />
              <StatItem label="Active Req" value={profile?.active_requests ?? 0} icon={Layout} />
            </View>
            <View className="flex-row justify-between">
              <StatItem label="Earnings" value={`${profile?.total_earnings ?? 0} PKR`} icon={DollarSign} />
              <StatItem label="Hours" value={`${profile?.total_hours_worked ?? 0} hrs`} icon={Clock} />
              <StatItem label="Live Rating" value={profile?.rating || "5.0"} icon={Star} />
            </View>
          </View>

          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className={`w-2 h-2 rounded-full mr-2 ${isAvailable ? 'bg-green-500' : 'bg-slate-300'}`} />
              <Text className={`font-black text-xs uppercase tracking-tighter ${isAvailable ? 'text-green-700' : 'text-slate-400'}`}>
                {isAvailable ? 'Accepting Orders' : 'Offline'}
              </Text>
            </View>
            <Switch 
              value={isAvailable} 
              onValueChange={toggleAvailability}
              trackColor={{ false: "#e2e8f0", true: "#000" }}
              thumbColor={"#fff"}
            />
          </View>
        </Card>

        {/* Incoming Requests Section */}
        <View className="mb-6">
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <Text className="text-lg font-black text-slate-900">Incoming Requests</Text>
              <Text className="text-[10px] text-slate-500 font-bold uppercase">Assigned by AI Orchestrator</Text>
            </View>
            {requests.length > 0 && (
              <View className="bg-red-500 px-2 py-0.5 rounded-full">
                <Text className="text-white text-[10px] font-black">{requests.filter(r => r.status === 'pending').length} Active</Text>
              </View>
            )}
          </View>

          {requests.length === 0 ? (
            <Card className="bg-white p-6 rounded-3xl border-0 shadow-sm items-center justify-center py-8">
              <Text className="text-slate-400 font-bold text-sm">No incoming service requests.</Text>
            </Card>
          ) : (
            <View>
              {requests.map((req, idx) => {
                const getStatusColor = (status) => {
                  switch (status) {
                    case 'approved': return 'bg-green-50 text-green-700 border-green-100';
                    case 'denied': return 'bg-red-50 text-red-700 border-red-100';
                    case 'counter_offer': return 'bg-orange-50 text-orange-700 border-orange-100';
                    default: return 'bg-blue-50 text-blue-700 border-blue-100';
                  }
                };

                return (
                  <Card key={req._id || idx} className="mb-4 p-5 bg-white border-0 shadow-sm rounded-3xl">
                    <View className="flex-row justify-between items-start mb-3">
                      <View className="flex-1 mr-2 flex-row items-center">
                        <View className="w-10 h-10 rounded-full bg-blue-500/10 items-center justify-center mr-3 border border-blue-500/20">
                          <User size={18} color="#3b82f6" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-base font-black text-slate-900">{req.customer_name || 'Valued Client'}</Text>
                          <Text className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{req.customer_email || req.contact_email || 'No email provided'}</Text>
                        </View>
                      </View>
                      <View className="flex-row items-center space-x-2">
                        <View className={`px-3 py-1 rounded-full border ${getStatusColor(req.status)}`}>
                          <Text className="text-[9px] font-black uppercase tracking-tight">{req.status}</Text>
                        </View>
                        {(req.status === 'approved' || req.status === 'denied') && (
                          <TouchableOpacity 
                            onPress={() => handleDeleteRequest(req)} 
                            className={`p-1.5 rounded-full ${req.status === 'approved' && !isRequestTimePassed(req) ? 'bg-slate-100 opacity-40' : 'bg-red-50'}`}
                          >
                            <Trash2 size={12} color={req.status === 'approved' && !isRequestTimePassed(req) ? '#64748b' : '#ef4444'} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    <View className="space-y-2 py-3 border-y border-slate-50 mb-4">
                      <View className="mb-2 bg-slate-50 p-3 rounded-2xl">
                        <Text className="text-[9px] text-slate-400 font-bold uppercase mb-1">Service Requested</Text>
                        <Text className="text-xs text-slate-700 font-black">{req.service_type} ({req.specialization})</Text>
                      </View>

                      <View className="flex-row items-center">
                        <MapPin size={12} color="#64748b" />
                        <Text className="text-xs text-slate-600 ml-2 font-bold">{req.location}</Text>
                      </View>
                      <View className="flex-row items-center">
                        <DollarSign size={12} color="#64748b" />
                        <Text className="text-xs text-slate-600 ml-2 font-bold">
                          Offered Rate: {req.offered_price} PKR/USD
                        </Text>
                      </View>
                      <View className="flex-row items-center">
                        <Clock size={12} color="#64748b" />
                        <Text className="text-xs text-slate-600 ml-2 font-bold">
                          Time Requested: {req.requested_date} at {req.requested_time}
                        </Text>
                      </View>
                      {(req.customer_phone || req.contact_phone) && (req.customer_phone !== 'Not provided' || req.contact_phone !== 'Not provided') && (
                        <View className="mt-2 pt-2 border-t border-dashed border-slate-100">
                          <Text className="text-[9px] text-slate-400 font-bold uppercase mb-1">Client Contact</Text>
                          <Text className="text-xs text-slate-600 font-medium">📞 {req.customer_phone && req.customer_phone !== 'Not provided' ? req.customer_phone : req.contact_phone}</Text>
                        </View>
                      )}
                      {req.status === 'counter_offer' && (
                        <View className="mt-2 p-3 bg-orange-50/50 rounded-2xl border border-orange-100/50">
                          <Text className="text-[9px] text-orange-700 font-black uppercase mb-1">Counter Offer Sent</Text>
                          <Text className="text-xs text-slate-600 font-bold">Price: {req.counter_price} PKR/USD</Text>
                          <Text className="text-xs text-slate-600 font-bold">Time: {req.counter_date} at {req.counter_time}</Text>
                          {req.counter_note ? (
                            <Text className="text-xs text-slate-500 italic mt-1 font-medium">Note: "{req.counter_note}"</Text>
                          ) : null}
                        </View>
                      )}
                    </View>

                    {(req.status === 'pending' || req.status === 'counter_offer') && (
                      <View className="flex-row space-x-2">
                        <TouchableOpacity 
                          onPress={() => handleRequestResponse(req._id, 'approved')}
                          className="flex-1 bg-green-600 py-3 rounded-2xl items-center justify-center shadow-sm"
                        >
                          <Text className="text-white font-black text-xs">Approve</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          onPress={() => {
                            setSelectedRequest(req);
                            setCounterPrice(String(req.offered_price || ''));
                            setCounterDate(req.requested_date || '');
                            setCounterTime(req.requested_time || '');
                            setCounterNote('');
                            setIsCounterModalOpen(true);
                          }}
                          className="flex-1 bg-slate-800 py-3 rounded-2xl items-center justify-center shadow-sm"
                        >
                          <Text className="text-white font-black text-xs">Counter</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          onPress={() => handleRequestResponse(req._id, 'denied')}
                          className="flex-1 bg-red-100 py-3 rounded-2xl items-center justify-center"
                        >
                          <Text className="text-red-700 font-black text-xs">Deny</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </Card>
                );
              })}
            </View>
          )}
        </View>

        {/* Services Header */}
        <View className="flex-row justify-between items-center mb-4">
          <View>
            <Text className="text-lg font-black text-slate-900">Portfolio</Text>
            <Text className="text-[10px] text-slate-500 font-bold uppercase">Active Listings</Text>
          </View>
          <TouchableOpacity 
            onPress={() => {
              setEditingServiceId(null);
              reset({
                name: '',
                service_type: '',
                specialization: '',
                description: '',
                location: '',
                hourly_rate: '',
                currency: 'PKR',
                experience_years: '',
                languages: [],
                phone: '',
                email: user?.email || '',
              });
              setTools([]);
              setIsCreatingService(true);
            }} 
            className="bg-black flex-row items-center px-4 py-2 rounded-2xl shadow-lg"
          >
            <Plus size={16} color="#fff" strokeWidth={3} />
            <Text className="text-white font-black ml-1.5 text-xs">Add New</Text>
          </TouchableOpacity>
        </View>

        {/* Services List */}
        {services.length === 0 ? (
          <View className="items-center py-10 bg-white rounded-3xl border border-slate-200 border-dashed mb-6">
            <Text className="text-slate-400 font-bold text-sm">No services listed yet.</Text>
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

        {/* Stats Section */}
        <View className="flex-row items-center space-x-2 mb-4">
          <TrendingUp size={18} color="#000" />
          <Text className="text-lg font-black text-slate-900">Insights</Text>
        </View>
        <View className="flex-row justify-between mb-12">
          <Card className="bg-white p-5 rounded-3xl flex-1 mr-2 border-0 shadow-sm">
            <Text className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Total Earned</Text>
            <Text className="text-2xl font-black text-slate-900">PKR 0</Text>
          </Card>
          <Card className="bg-white p-5 rounded-3xl flex-1 ml-2 border-0 shadow-sm">
            <Text className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">Conversion</Text>
            <Text className="text-2xl font-black text-slate-900">100%</Text>
          </Card>
        </View>
      </ScrollView>

      {/* Modern Create Service Modal */}
      <Modal 
        isVisible={isCreatingService}
        onBackdropPress={() => setIsCreatingService(false)}
        style={{ margin: 0, justifyContent: 'flex-end' }}
        avoidKeyboard
      >
        <View className="bg-white rounded-t-[40px] p-6 max-h-[90%]">
          <View className="w-12 h-1.5 bg-slate-200 rounded-full self-center mb-6" />
          
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-2xl font-black text-slate-900">{editingServiceId ? 'Edit Service' : 'New Service'}</Text>
              <Text className="text-slate-500 font-medium">{editingServiceId ? 'Modify your marketplace listing' : 'Create a new marketplace listing'}</Text>
            </View>
            <TouchableOpacity 
              onPress={() => setIsCreatingService(false)}
              className="p-2 bg-slate-50 rounded-full"
            >
              <X size={20} color="#000" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="mb-6">
            <View className="space-y-6">
              {/* Basic Info Group */}
              <View>
                <Text className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Basic Information</Text>
                
                <View className="mb-4">
                  <Text className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Service Listing Title</Text>
                  <Controller
                    control={control}
                    name="name"
                    rules={{ required: 'Required' }}
                    render={({ field: { onChange, value } }) => (
                      <TextInput 
                        className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-medium" 
                        placeholder="e.g. Emergency AC Repair"
                        value={value}
                        onChangeText={onChange}
                      />
                    )}
                  />
                </View>

                <View className="flex-row space-x-3 mb-4">
                  <View className="flex-1 mr-1.5">
                    <Text className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Category</Text>
                    <Controller
                      control={control}
                      name="service_type"
                      rules={{ required: true }}
                      render={({ field: { onChange, value } }) => (
                        <Dropdown
                          style={{ backgroundColor: '#f8fafc', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f1f5f9' }}
                          placeholderStyle={{ fontSize: 13, color: '#94a3b8' }}
                          selectedTextStyle={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}
                          data={SERVICE_CATEGORIES}
                          labelField="label"
                          valueField="value"
                          search
                          placeholder="Select"
                          value={value}
                          onChange={item => onChange(item.value)}
                        />
                      )}
                    />
                  </View>
                  <View className="flex-1 ml-1.5">
                    <Text className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Specialization</Text>
                    <Controller
                      control={control}
                      name="specialization"
                      rules={{ required: true }}
                      render={({ field: { onChange, value } }) => (
                        <Dropdown
                          style={{ backgroundColor: '#f8fafc', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f1f5f9' }}
                          placeholderStyle={{ fontSize: 13, color: '#94a3b8' }}
                          selectedTextStyle={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}
                          data={selectedServiceType ? (SPECIALIZATIONS_MAP[selectedServiceType] || []) : []}
                          labelField="label"
                          valueField="value"
                          placeholder="Select"
                          disabled={!selectedServiceType}
                          value={value}
                          onChange={item => onChange(item.value)}
                        />
                      )}
                    />
                  </View>
                </View>

                <View>
                  <Text className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Description</Text>
                  <Controller
                    control={control}
                    name="description"
                    rules={{ required: true }}
                    render={({ field: { onChange, value } }) => (
                      <TextInput 
                        className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-medium h-32" 
                        placeholder="Detailed description of what you offer..."
                        multiline
                        textAlignVertical="top"
                        value={value}
                        onChangeText={onChange}
                      />
                    )}
                  />
                </View>
              </View>

              {/* Rates & Location */}
              <View>
                <Text className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Rates & Experience</Text>
                
                <View className="flex-row space-x-3 mb-4">
                  <View className="flex-1 mr-1.5">
                    <Text className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Hourly Rate</Text>
                    <Controller
                      control={control}
                      name="hourly_rate"
                      rules={{ required: true }}
                      render={({ field: { onChange, value } }) => (
                        <TextInput 
                          className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold" 
                          keyboardType="numeric"
                          placeholder="00"
                          value={value}
                          onChangeText={onChange}
                        />
                      )}
                    />
                  </View>
                  <View className="flex-1 ml-1.5">
                    <Text className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Experience (Years)</Text>
                    <Controller
                      control={control}
                      name="experience_years"
                      rules={{ required: true }}
                      render={({ field: { onChange, value } }) => (
                        <TextInput 
                          className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold" 
                          keyboardType="numeric"
                          placeholder="0"
                          value={value}
                          onChangeText={onChange}
                        />
                      )}
                    />
                  </View>
                </View>

                <View className="mb-4">
                  <Text className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Coverage Area</Text>
                  <Controller
                    control={control}
                    name="location"
                    rules={{ required: true }}
                    render={({ field: { onChange, value } }) => (
                      <TextInput 
                        className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-medium" 
                        placeholder="e.g. Islamabad, I-14"
                        value={value}
                        onChangeText={onChange}
                      />
                    )}
                  />
                </View>
              </View>

              {/* Skills & Tools */}
              <View>
                <Text className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Languages & Skills</Text>
                
                <View className="mb-4">
                  <Text className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Languages</Text>
                  <Controller
                    control={control}
                    name="languages"
                    render={({ field: { onChange, value } }) => (
                      <MultiSelect
                        style={{ backgroundColor: '#f8fafc', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f1f5f9' }}
                        placeholderStyle={{ fontSize: 13, color: '#94a3b8' }}
                        selectedTextStyle={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}
                        data={LANGUAGE_OPTIONS}
                        labelField="label"
                        valueField="value"
                        placeholder="Select languages"
                        value={value}
                        onChange={item => onChange(item)}
                        renderSelectedItem={(item, unSelect) => (
                          <TouchableOpacity onPress={() => unSelect && unSelect(item)}>
                            <View className="bg-slate-900 rounded-lg px-3 py-1 mr-2 mt-2 flex-row items-center">
                              <Text className="text-white text-xs font-bold mr-2">{item.label}</Text>
                              <X size={10} color="#fff" />
                            </View>
                          </TouchableOpacity>
                        )}
                      />
                    )}
                  />
                </View>

                <View>
                  <Text className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Tools & Equipment</Text>
                  <View className="flex-row mb-2">
                    <TextInput 
                      className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-medium flex-1 mr-2" 
                      placeholder="Add tool..."
                      value={toolInput}
                      onChangeText={setToolInput}
                      onSubmitEditing={addTool}
                    />
                    <TouchableOpacity 
                      onPress={addTool}
                      className="bg-slate-900 w-14 rounded-2xl items-center justify-center"
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

              {/* Contact Group */}
              <View>
                <Text className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Contact Details</Text>
                <View className="mb-4">
                  <Text className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Phone Number</Text>
                  <Controller
                    control={control}
                    name="phone"
                    rules={{ required: true }}
                    render={({ field: { onChange, value } }) => (
                      <TextInput 
                        className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-medium" 
                        placeholder="+92 3XX XXXXXXX"
                        keyboardType="phone-pad"
                        value={value}
                        onChangeText={onChange}
                      />
                    )}
                  />
                </View>
              </View>

              <Button 
                title={isSubmitting ? (editingServiceId ? "Saving..." : "Publishing...") : (editingServiceId ? "Save Changes" : "Launch Service")} 
                onPress={handleSubmit(onSaveService, onFormError)} 
                disabled={isSubmitting}
                className="py-5 rounded-3xl bg-black mb-10 shadow-2xl" 
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modern Approve with Changes / Counter Offer Modal */}
      <Modal 
        isVisible={isCounterModalOpen}
        onBackdropPress={() => setIsCounterModalOpen(false)}
        style={{ margin: 0, justifyContent: 'flex-end' }}
        avoidKeyboard
      >
        <View className="bg-white rounded-t-[40px] p-6 max-h-[85%]">
          <View className="w-12 h-1.5 bg-slate-200 rounded-full self-center mb-6" />
          
          <View className="flex-row justify-between items-center mb-6">
            <View>
              <Text className="text-2xl font-black text-slate-900">Approve with Changes</Text>
              <Text className="text-slate-500 font-medium">Send counter-offer to {selectedRequest?.customer_name}</Text>
            </View>
            <TouchableOpacity 
              onPress={() => setIsCounterModalOpen(false)}
              className="p-2 bg-slate-50 rounded-full"
            >
              <X size={20} color="#000" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} className="mb-6">
            <View className="space-y-6">
              <View>
                <Text className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Counter Price (PKR/USD)</Text>
                <TextInput 
                  className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-bold" 
                  placeholder="e.g. 35"
                  keyboardType="numeric"
                  value={counterPrice}
                  onChangeText={setCounterPrice}
                />
              </View>

              <View className="flex-row space-x-3">
                <View className="flex-1 mr-1.5">
                  <Text className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">New Date</Text>
                  <TextInput 
                    className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-medium" 
                    placeholder="YYYY-MM-DD"
                    value={counterDate}
                    onChangeText={setCounterDate}
                  />
                </View>
                <View className="flex-1 ml-1.5">
                  <Text className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">New Time</Text>
                  <TextInput 
                    className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-medium" 
                    placeholder="HH:MM"
                    value={counterTime}
                    onChangeText={setCounterTime}
                  />
                </View>
              </View>

              <View>
                <Text className="text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Message to Customer (Optional)</Text>
                <TextInput 
                  className="bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-900 font-medium h-24" 
                  placeholder="Explain your changes..."
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
                    Alert.alert("Required Fields", "Please enter new Price, Date and Time.");
                    return;
                  }
                  handleRequestResponse(selectedRequest._id, 'counter_offer', {
                    counter_price: Number(counterPrice),
                    counter_date: counterDate,
                    counter_time: counterTime,
                    counter_note: counterNote
                  });
                  setIsCounterModalOpen(false);
                }} 
                className="py-5 rounded-3xl bg-black mb-10 shadow-2xl" 
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}