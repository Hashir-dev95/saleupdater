import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { AppThemeColors } from '@/constants/app-theme';
import { useAppTheme } from '@/hooks/use-app-theme';

export interface SweetAlertOptions {
  kind: 'success' | 'error' | 'warning' | 'confirmation';
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
}

const accentColors = { success: '#10b981', error: '#ef4444', warning: '#f59e0b', confirmation: '#14b8a6' };
const symbols = { success: '\u2713', error: '!', warning: '!', confirmation: '?' };

export function SweetAlert({ alert, onClose }: { alert: SweetAlertOptions | null; onClose: () => void }) {
  const { colors } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const iconScale = useRef(new Animated.Value(0.35)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!alert) return;
    iconScale.setValue(0.35);
    iconOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(iconScale, { toValue: 1, friction: 5, tension: 95, useNativeDriver: true }),
      Animated.timing(iconOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [alert, iconOpacity, iconScale]);

  const horizontalPadding = width < 360 ? 12 : 20;

  return (
    <Modal visible={!!alert} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.overlay, { padding: horizontalPadding }]}>
        {alert && <View style={[styles.dialog, { maxHeight: Math.max(280, height - horizontalPadding * 2) }]} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={[styles.body, width < 360 && styles.compactBody]} bounces={false}>
            <Animated.View style={[styles.symbolCircle, { borderColor: accentColors[alert.kind], transform: [{ scale: iconScale }], opacity: iconOpacity }]}>
              <Text style={[styles.symbol, { color: accentColors[alert.kind] }]} accessibilityElementsHidden>{symbols[alert.kind]}</Text>
            </Animated.View>
            <Text accessibilityRole="header" style={styles.title}>{alert.title}</Text>
            <Text style={styles.message}>{alert.message}</Text>
            <View style={styles.actions}>
              {alert.cancelLabel && <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
                <Text style={styles.secondaryText}>{alert.cancelLabel}</Text>
              </Pressable>}
              <Pressable accessibilityRole="button" onPress={() => { onClose(); alert.onConfirm?.(); }} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
                <Text style={styles.primaryText}>{alert.confirmLabel ?? 'OK'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>}
      </View>
    </Modal>
  );
}

const createStyles = (colors: AppThemeColors) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
  dialog: { width: '100%', maxWidth: 420, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  body: { padding: 24, alignItems: 'center' },
  compactBody: { paddingHorizontal: 18, paddingVertical: 22 },
  symbolCircle: { width: 82, height: 82, borderRadius: 41, borderWidth: 4, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  symbol: { fontSize: 49, lineHeight: 58, fontWeight: '800' },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center' },
  message: { fontSize: 16, lineHeight: 24, color: colors.textMuted, textAlign: 'center', marginVertical: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, width: '100%' },
  primary: { backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 22, borderRadius: 12, minWidth: 120, maxWidth: '100%', alignItems: 'center' },
  primaryText: { color: colors.primaryText, fontWeight: '800', fontSize: 16 },
  secondary: { backgroundColor: colors.secondary, paddingVertical: 14, paddingHorizontal: 22, borderRadius: 12, minWidth: 120, maxWidth: '100%', alignItems: 'center' },
  secondaryText: { color: colors.secondaryText, fontWeight: '700', fontSize: 16 },
  pressed: { opacity: 0.78 },
});
