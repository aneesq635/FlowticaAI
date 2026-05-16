import React from 'react';
import { View, TextInput, Text } from 'react-native';
import { useSelector } from 'react-redux';
import { Typography } from './Typography';

export function Input({ 
  label, 
  placeholder, 
  value, 
  onChangeText, 
  secureTextEntry, 
  error, 
  icon: Icon,
  ...props 
}) {
  const theme = useSelector(state => state.orchestration.theme);
  const isDark = theme === 'dark';

  return (
    <View className="mb-6">
      {label && (
        <Typography variant="xs" className="ml-2 mb-2 font-black">
          {label}
        </Typography>
      )}
      <View className={`
        flex-row items-center px-4 rounded-2xl border h-14
        ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}
        ${error ? 'border-red-500' : ''}
      `}>
        {Icon && <Icon size={18} color={isDark ? '#64748b' : '#94a3b8'} className="mr-3" />}
        <TextInput
          className={`flex-1 text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}
          placeholder={placeholder}
          placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          {...props}
        />
      </View>
      {error && (
        <Text className="text-red-500 text-[10px] mt-1 ml-2 font-bold uppercase tracking-widest">
          {error}
        </Text>
      )}
    </View>
  );
}
