import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export interface SweetAlertOptions {
  kind: 'success' | 'error' | 'warning' | 'confirmation';
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
}
const colors = { success: '#047857', error: '#b91c1c', warning: '#a16207', confirmation: '#0f766e' };
const symbols = { success: '✓', error: '!', warning: '!', confirmation: '?' };

export function SweetAlert({ alert, onClose }: { alert: SweetAlertOptions | null; onClose: () => void }) {
  return (
    <Modal visible={!!alert} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {alert && <View style={styles.dialog} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={[styles.symbol, { color: colors[alert.kind] }]} accessibilityElementsHidden>{symbols[alert.kind]}</Text>
            <Text accessibilityRole="header" style={styles.title}>{alert.title}</Text>
            <Text style={styles.message}>{alert.message}</Text>
            <View style={styles.actions}>
              {alert.cancelLabel && <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondary}>
                <Text style={styles.secondaryText}>{alert.cancelLabel}</Text>
              </Pressable>}
              <Pressable accessibilityRole="button" onPress={() => { onClose(); alert.onConfirm?.(); }} style={styles.primary}>
                <Text style={styles.primaryText}>{alert.confirmLabel ?? 'OK'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>}
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.65)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  dialog: { width: '100%', maxWidth: 440, maxHeight: '90%', borderRadius: 24, backgroundColor: '#fff' },
  body: { padding: 24, alignItems: 'center' },
  symbol: { fontSize: 48, fontWeight: '700', marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a', textAlign: 'center' },
  message: { fontSize: 16, lineHeight: 24, color: '#475569', textAlign: 'center', marginVertical: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, width: '100%' },
  primary: { backgroundColor: '#047857', padding: 14, borderRadius: 12, minWidth: 100, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: { backgroundColor: '#ecfdf5', padding: 14, borderRadius: 12, minWidth: 100, alignItems: 'center' },
  secondaryText: { color: '#065f46', fontWeight: '700', fontSize: 16 },
});
