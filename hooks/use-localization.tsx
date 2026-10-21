import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';

import { createLocalizer } from '@/localization';
import { createLanguageStore } from '@/localization/language-store';

type LanguageStore = ReturnType<typeof createLanguageStore>;
type LocalizationValue = ReturnType<typeof createLocalizer> & ReturnType<LanguageStore['getSnapshot']> & Pick<LanguageStore, 'setLanguage'>;
const LocalizationContext = createContext<LocalizationValue | null>(null);

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createLanguageStore(AsyncStorage));
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => { void store.hydrate(); }, [store]);
  const value = useMemo(() => ({ ...snapshot, ...createLocalizer(snapshot.language), setLanguage: store.setLanguage }), [snapshot, store]);
  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
}

export function useLocalization() {
  const value = useContext(LocalizationContext);
  if (!value) throw new Error('useLocalization requires LocalizationProvider');
  return value;
}
