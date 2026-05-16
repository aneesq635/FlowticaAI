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
import { setProviderProfile } from '../../store/orchestrationSlice';
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
  Layout
} from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../components/AuthContext';
import { useForm, Controller } from 'react-hook-form';
import { Dropdown, MultiSelect } from 'react-native-element-dropdown';
import Modal from 'react-native-modal';

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);
  const [tools, setTools] = useState([]);
  const [toolInput, setToolInput] = useState('');

  const { control, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm({
    default_values: {
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
      } else {
        setHasProfile(false);
      }
    } catch (e) {
      console.warn("Failed to fetch profile", e);
    } finally {
      setIsLoading(false);
    }
  }, [user, dispatch, backendUrl]);

  useEffect(() => {
    if (user?.id) {
      fetchProfileData();
    } else {
      setIsLoading(false);
    }
  }, [user, fetchProfileData]);

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

  const onAddService = async (data) => {
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
      const response = await fetch(`${backendUrl}/api/providers/service`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const resData = await response.json();
      if (resData.success) {
        Alert.alert("Success", "Service published successfully!");
        setServices(prev => [...prev, payload]);
        setIsCreatingService(false);
        reset();
        setTools([]);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to add service.");
    } finally {
      setIsSubmitting(false);
    }
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

          <View className="flex-row mb-6 py-4 border-y border-slate-50">
            <StatItem label="Jobs" value={services.reduce((acc, s) => acc + (s.completed_jobs || 0), 0)} icon={Briefcase} />
            <StatItem label="Services" value={services.length} icon={Layout} />
            <StatItem label="Rating" value={profile?.rating || "5.0"} icon={Award} />
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

        {/* Services Header */}
        <View className="flex-row justify-between items-center mb-4">
          <View>
            <Text className="text-lg font-black text-slate-900">Portfolio</Text>
            <Text className="text-[10px] text-slate-500 font-bold uppercase">Active Listings</Text>
          </View>
          <TouchableOpacity 
            onPress={() => setIsCreatingService(true)} 
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
                onEdit={() => Alert.alert("Coming Soon", "Edit functionality is in development.")}
                onDelete={() => Alert.alert("Confirm", "Delete this service?", [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive' }])}
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
              <Text className="text-2xl font-black text-slate-900">New Service</Text>
              <Text className="text-slate-500 font-medium">Create a new marketplace listing</Text>
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
                title={isSubmitting ? "Publishing..." : "Launch Service"} 
                onPress={handleSubmit(onAddService)} 
                disabled={isSubmitting}
                className="py-5 rounded-3xl bg-black mb-10 shadow-2xl" 
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}