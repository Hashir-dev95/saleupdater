import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { isRunningInExpoGo } from 'expo';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';

import { AppThemeProvider, useAppTheme } from '@/hooks/use-app-theme';
import { LocalizationProvider, useLocalization } from '@/hooks/use-localization';

// Hold the native splash until the saved theme and first app layout are ready.
void SplashScreen.preventAutoHideAsync().catch(console.warn);

// Animate the native splash away as soon as content is ready; no display timer.
if (!isRunningInExpoGo()) {
  SplashScreen.setOptions({ duration: 450, fade: true });
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <LocalizationProvider>
        <RootNavigator />
      </LocalizationProvider>
    </AppThemeProvider>
  );
}

function RootNavigator() {
  const { colors, isDark, isReady } = useAppTheme();
  const { isReady: isLanguageReady } = useLocalization();
  const navigationTheme = isDark ? DarkTheme : DefaultTheme;

  useEffect(() => {
    if (isReady) {
      void SystemUI.setBackgroundColorAsync(colors.background).catch(console.warn);
    }
  }, [colors.background, isReady]);

  const onLayout = useCallback(() => {
    SplashScreen.hide();
  }, []);

  if (!isReady || !isLanguageReady) return null;

  return (
    <ThemeProvider value={{ ...navigationTheme, colors: { ...navigationTheme.colors, background: colors.background } }}>
      <View style={{ flex: 1, backgroundColor: colors.background }} onLayout={onLayout}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
        <StatusBar animated style={isDark ? 'light' : 'dark'} />
      </View>
    </ThemeProvider>
  );
}
