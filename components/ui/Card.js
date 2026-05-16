import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useSelector } from 'react-redux';
import { MotiView } from 'moti';

export function Card({ children, className = '', onPress, animate = true }) {
  const theme = useSelector(state => state.orchestration.theme);
  const isDark = theme === 'dark';

  const Container = onPress ? TouchableOpacity : View;
  const Wrapper = animate ? MotiView : View;

  return (
    <Wrapper
      from={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'timing', duration: 400 }}
    >
      <Container 
        onPress={onPress}
        activeOpacity={0.9}
        className={`
          rounded-[32px] p-6 shadow-sm border
          ${isDark ? 'bg-slate-900 border-slate-800 shadow-black' : 'bg-white border-slate-100 shadow-slate-200'}
          ${className}
        `}
      >
        {children}
      </Container>
    </Wrapper>
  );
}
