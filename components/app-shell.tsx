import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppThemeColors } from '@/constants/app-theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/hooks/use-localization';
import { LanguageSwitch } from '@/components/language-switch';
import { LocalizedText as Text } from '@/components/localized-text';

export function AppShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { t } = useLocalization();
  const { width } = useWindowDimensions();
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return <SafeAreaView style={styles.container}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingHorizontal: width < 600 ? 16 : 32 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headingCopy}>
          <Text business style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
        <Pressable
          accessibilityLabel={t('drawer.open')}
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setDrawerOpen(true)}
          style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}>
          <Text style={styles.menuDots}>{'\u22ee'}</Text>
        </Pressable>
      </View>
      {children}
    </ScrollView>
    <AppDrawer visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
  </SafeAreaView>;
}
export function ActionCard({ children, style }: { children: React.ReactNode; style?: object }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={[styles.card, style]}>{children}</View>;
}
export function WorkflowStep({ number, title, description }: { number: number; title: string; description: string }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <View style={styles.step}>
    <View style={styles.badge}><Text style={styles.badgeText}>{number}</Text></View>
    <View style={styles.stepText}><Text style={styles.stepTitle}>{title}</Text><Text style={styles.stepDescription}>{description}</Text></View>
  </View>;
}
type ButtonProps = { title: string; onPress: () => void; disabled?: boolean };
function Button({ title, onPress, disabled, secondary }: ButtonProps & { secondary?: boolean }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary ? styles.secondary : styles.primary, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
    <Text style={[styles.buttonText, secondary ? styles.secondaryText : styles.primaryText]}>{title}</Text>
  </Pressable>;
}
export function PrimaryButton(props: ButtonProps) { return <Button {...props} />; }
export function SecondaryButton(props: ButtonProps) { return <Button {...props} secondary />; }

function AppDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, isDark, setMode } = useAppTheme();
  const { t, language, setLanguage, saveError } = useLocalization();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const translateX = useRef(new Animated.Value(Math.min(width * 0.86, 360))).current;

  useEffect(() => {
    if (!visible) return;
    translateX.setValue(Math.min(width * 0.86, 360));
    Animated.spring(translateX, { toValue: 0, damping: 24, stiffness: 230, mass: 0.9, useNativeDriver: true }).start();
  }, [translateX, visible, width]);

  function close(afterClose?: () => void) {
    Animated.timing(translateX, { toValue: Math.min(width * 0.86, 360), duration: 180, useNativeDriver: true }).start(() => {
      onClose();
      afterClose?.();
    });
  }

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => close()} statusBarTranslucent>
    <View style={styles.drawerOverlay}>
      <Pressable accessibilityLabel={t('drawer.close')} style={StyleSheet.absoluteFill} onPress={() => close()} />
      <Animated.View style={[styles.drawer, { width: Math.min(width * 0.86, 360), transform: [{ translateX }] }]}>
        <SafeAreaView style={styles.drawerSafeArea}>
          <ScrollView contentContainerStyle={styles.drawerContent}>
          <View style={styles.drawerHeader}>
            <View style={styles.drawerHeading}>
              <Text accessibilityRole="header" style={styles.drawerTitle}>{t('drawer.menu')}</Text>
              <Text style={styles.drawerSubtitle}>{t('drawer.appName')}</Text>
            </View>
            <View style={styles.drawerHeaderControls}>
              <LanguageSwitch />
              <Pressable accessibilityLabel={t('drawer.close')} accessibilityRole="button" onPress={() => close()} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
                <Text style={styles.closeText}>{'\u00d7'}</Text>
              </Pressable>
            </View>
          </View>
          {saveError && <View style={styles.languageError}>
            <Text accessibilityLiveRegion="polite" style={{ color: colors.error }}>{t('language.saveFailed')}</Text>
            <SecondaryButton title={t('common.retry')} onPress={() => { void setLanguage(language); }} />
          </View>}

          <Pressable accessibilityRole="button" onPress={() => close(() => router.replace('/'))} style={({ pressed }) => [styles.drawerRow, pressed && styles.drawerRowPressed]}>
            <View style={styles.homeIcon}><Text style={styles.homeIconText}>{'\u2302'}</Text></View>
            <View style={styles.drawerRowCopy}>
              <Text style={styles.drawerRowTitle}>{t('drawer.dashboard')}</Text>
              <Text style={styles.drawerRowSubtitle}>{t('drawer.home')}</Text>
            </View>
            <Text style={styles.chevron}>{'\u203a'}</Text>
          </Pressable>

          <View style={styles.divider} />
          <View style={styles.drawerRow}>
            <View style={styles.themeIcon}><Text style={styles.themeIconText}>{isDark ? '\u263e' : '\u2600'}</Text></View>
            <View style={styles.drawerRowCopy}>
              <Text style={styles.drawerRowTitle}>{t('drawer.darkMode')}</Text>
              <Text style={styles.drawerRowSubtitle}>{t(isDark ? 'common.on' : 'common.off')}</Text>
            </View>
            <Switch
              accessibilityLabel={t('drawer.darkMode')}
              value={isDark}
              onValueChange={enabled => setMode(enabled ? 'dark' : 'light')}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={isDark ? '#ffffff' : '#f8fafc'}
            />
          </View>
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </View>
  </Modal>;
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 1200, alignSelf: 'center', paddingTop: 24, paddingBottom: 36 },
  header: { marginBottom: 28, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headingCopy: { flex: 1 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 23, color: colors.success },
  menuButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  menuDots: { color: colors.text, fontSize: 30, fontWeight: '700', lineHeight: 34, marginTop: -2 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: '#020617', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  button: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', marginBottom: 10, minHeight: 48 },
  primary: { backgroundColor: colors.primary }, secondary: { backgroundColor: colors.secondary }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.78 },
  buttonText: { fontSize: 16, fontWeight: '700', textAlign: 'center' }, primaryText: { color: colors.primaryText }, secondaryText: { color: colors.secondaryText },
  step: { flexDirection: 'row', gap: 12, marginBottom: 20 }, badge: { backgroundColor: colors.badge, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.secondaryText, fontSize: 18, fontWeight: '700' }, stepText: { flex: 1 }, stepTitle: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: 6 }, stepDescription: { color: colors.textMuted, fontSize: 14, lineHeight: 21 },
  drawerOverlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'flex-end' },
  drawer: { height: '100%', maxWidth: 360, backgroundColor: colors.surface, shadowColor: '#000000', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: -6, height: 0 }, elevation: 18 },
  drawerSafeArea: { flex: 1, paddingHorizontal: 18, paddingTop: 8 },
  drawerContent: { paddingBottom: 20 },
  drawerHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, paddingVertical: 18 },
  drawerHeading: { flex: 1, minWidth: 0 },
  drawerHeaderControls: { alignItems: 'flex-end', gap: 8, flexShrink: 0 },
  languageError: { gap: 8, marginBottom: 12 },
  drawerTitle: { color: colors.text, fontSize: 26, fontWeight: '800' },
  drawerSubtitle: { color: colors.textMuted, fontSize: 14, marginTop: 3 },
  closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  closeText: { color: colors.text, fontSize: 30, lineHeight: 34 },
  drawerRow: { minHeight: 72, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 12 },
  drawerRowPressed: { backgroundColor: colors.surfaceMuted },
  drawerRowCopy: { flex: 1 },
  drawerRowTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  drawerRowSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
  homeIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.secondary },
  homeIconText: { color: colors.secondaryText, fontSize: 25, fontWeight: '700', marginTop: -3 },
  themeIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  themeIconText: { color: colors.text, fontSize: 23 },
  chevron: { color: colors.textMuted, fontSize: 30 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 10 },
});
