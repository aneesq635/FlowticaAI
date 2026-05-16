import React from 'react';
import { Text } from 'react-native';
import { useSelector } from 'react-redux';

export function Typography({ children, variant = 'body', className = '', ...props }) {
  const theme = useSelector(state => state.orchestration.theme);
  const isDark = theme === 'dark';

  const variants = {
    h1: 'text-4xl font-black tracking-tighter',
    h2: 'text-3xl font-black tracking-tight',
    h3: 'text-2xl font-extrabold',
    h4: 'text-xl font-bold',
    body: 'text-base font-medium leading-relaxed',
    small: 'text-sm font-medium',
    xs: 'text-[10px] font-bold uppercase tracking-widest',
  };

  const colors = {
    h1: isDark ? 'text-white' : 'text-slate-900',
    h2: isDark ? 'text-white' : 'text-slate-900',
    h3: isDark ? 'text-slate-100' : 'text-slate-800',
    h4: isDark ? 'text-slate-200' : 'text-slate-700',
    body: isDark ? 'text-slate-400' : 'text-slate-600',
    small: isDark ? 'text-slate-500' : 'text-slate-400',
    xs: isDark ? 'text-slate-500' : 'text-slate-400',
  };

  return (
    <Text 
      className={`${variants[variant]} ${colors[variant]} ${className}`}
      {...props}
    >
      {children}
    </Text>
  );
}
