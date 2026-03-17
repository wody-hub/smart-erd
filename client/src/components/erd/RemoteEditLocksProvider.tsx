import type { ReactNode } from 'react';
import { RemoteEditLocksContext, type RemoteEditLocksContextValue } from './RemoteEditLocksContext';

interface RemoteEditLocksProviderProps {
  value: RemoteEditLocksContextValue;
  children: ReactNode;
}

export default function RemoteEditLocksProvider({ value, children }: RemoteEditLocksProviderProps) {
  return (
    <RemoteEditLocksContext.Provider value={value}>{children}</RemoteEditLocksContext.Provider>
  );
}
