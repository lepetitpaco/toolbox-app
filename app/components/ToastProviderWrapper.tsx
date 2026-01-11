'use client';

import { ToastProvider } from '../anilist/contexts/ToastContext';

export default function ToastProviderWrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
