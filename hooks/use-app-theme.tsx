import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { appThemes, AppThemeMode } from '@/constants/app-theme';

const THEME_STORAGE_KEY = '@SalesUpdater:theme';

type AppThemeContextValue = {
  mode: AppThemeMode;
  isDark: boolean;
  colors: typeof appThemes.light;
  setMode: (mode: AppThemeMode) => void;
};

const fallbackValue: AppThemeContextValue = {
  mode: 'light',
  isDark: false,
  colors: appThemes.light,
  setMode: () => undefined,
};

const AppThemeContext = createContext<AppThemeContextValue>(fallbackValue);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const systemMode = useColorScheme();
  const [mode, setModeState] = useState<AppThemeMode>(systemMode === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then(savedMode => {
        if (active && (savedMode === 'light' || savedMode === 'dark')) setModeState(savedMode);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const value = useMemo<AppThemeContextValue>(() => ({
    mode,
    isDark: mode === 'dark',
    colors: appThemes[mode],
    setMode: nextMode => {
      setModeState(nextMode);
      void AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode).catch(() => undefined);
    },
  }), [mode]);

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  return useContext(AppThemeContext);
}
