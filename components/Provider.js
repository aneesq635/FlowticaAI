import React from 'react';
// import { Provider } from 'react-redux';
import { AuthProvider } from './AuthContext';
// import { store } from '../store';

export default function Providers({ children }) {
  return (
    <AuthProvider>
      {/* <Provider store={store}>{children}</Provider> */}
      {children}
    </AuthProvider>
  );
}