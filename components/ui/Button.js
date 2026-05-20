import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { MotiView } from 'moti';

export function Button({ 
  title, 
  onPress, 
  variant = 'primary', 
  size = 'md',
  className = '', 
  disabled = false,
  icon: Icon,
  iconPosition = 'left'
}) {
  const theme = useSelector(state => state.orchestration.theme);
  const isDark = theme === 'dark';

  const baseStyles = 'rounded-2xl items-center justify-center flex-row overflow-hidden';
  
  const sizeStyles = {
    sm: 'py-2 px-4',
    md: 'py-4 px-6',
    lg: 'py-5 px-8',
  };

  const variants = {
    primary: isDark ? 'bg-white active:bg-slate-200 shadow-slate-100/10' : 'bg-slate-900 active:bg-slate-800 shadow-slate-900/10',
    secondary: isDark ? 'bg-slate-800 active:bg-slate-700' : 'bg-slate-100 active:bg-slate-200',
    outline: `bg-transparent border ${isDark ? 'border-slate-700' : 'border-slate-200'} active:bg-slate-50`,
    ghost: 'bg-transparent active:bg-slate-100',
    danger: 'bg-red-500 active:bg-red-600',
  };
  
  const textVariants = {
    primary: isDark ? 'text-slate-950 font-black' : 'text-white font-black',
    secondary: isDark ? 'text-slate-200 font-bold' : 'text-slate-900 font-bold',
    outline: isDark ? 'text-slate-200 font-bold' : 'text-slate-900 font-bold',
    ghost: isDark ? 'text-slate-400 font-bold' : 'text-slate-600 font-bold',
    danger: 'text-white font-bold',
  };

  const textSize = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <MotiView
      transition={{ type: 'timing', duration: 150 }}
      animate={{ scale: disabled ? 1 : 1 }}
    >
      <TouchableOpacity 
        onPress={onPress} 
        activeOpacity={0.8}
        className={`${baseStyles} ${sizeStyles[size]} ${variants[variant]} ${disabled ? 'opacity-40' : 'shadow-lg'} ${className}`}
        disabled={disabled}
      >
        {Icon && iconPosition === 'left' && (
          <View className="mr-2">
            <Icon size={18} color={variant === 'primary' ? (isDark ? '#0f172a' : '#fff') : (variant === 'danger' ? '#fff' : (isDark ? '#e2e8f0' : '#0f172a'))} />
          </View>
        )}
        <Text className={`${textSize[size]} ${textVariants[variant]} uppercase tracking-widest`}>
          {title}
        </Text>
        {Icon && iconPosition === 'right' && (
          <View className="ml-2">
            <Icon size={18} color={variant === 'primary' ? (isDark ? '#0f172a' : '#fff') : (variant === 'danger' ? '#fff' : (isDark ? '#e2e8f0' : '#0f172a'))} />
          </View>
        )}
      </TouchableOpacity>
    </MotiView>
  );
}
