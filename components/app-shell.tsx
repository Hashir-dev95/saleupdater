import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export function AppShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  return <SafeAreaView style={styles.container}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { paddingHorizontal: width < 600 ? 16 : 32 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.header}><Text style={styles.title}>{title}</Text>{subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}</View>
      {children}
    </ScrollView>
  </SafeAreaView>;
}
export function ActionCard({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function WorkflowStep({ number, title, description }: { number: number; title: string; description: string }) {
  return <View style={styles.step}>
    <View style={styles.badge}><Text style={styles.badgeText}>{number}</Text></View>
    <View style={styles.stepText}><Text style={styles.stepTitle}>{title}</Text><Text style={styles.stepDescription}>{description}</Text></View>
  </View>;
}
type ButtonProps = { title: string; onPress: () => void; disabled?: boolean };
function Button({ title, onPress, disabled, secondary }: ButtonProps & { secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary ? styles.secondary : styles.primary, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
    <Text style={[styles.buttonText, secondary ? styles.secondaryText : styles.primaryText]}>{title}</Text>
  </Pressable>;
}
export function PrimaryButton(props: ButtonProps) { return <Button {...props} />; }
export function SecondaryButton(props: ButtonProps) { return <Button {...props} secondary />; }
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { width: '100%', maxWidth: 1200, alignSelf: 'center', paddingTop: 24, paddingBottom: 36 },
  header: { marginBottom: 28 }, title: { fontSize: 28, fontWeight: '700', color: '#fff', marginBottom: 8 }, subtitle: { fontSize: 15, lineHeight: 23, color: '#a7f3d0' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: '#020617', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  button: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', marginBottom: 10, minHeight: 48 },
  primary: { backgroundColor: '#047857' }, secondary: { backgroundColor: '#ecfdf5' }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.85 },
  buttonText: { fontSize: 16, fontWeight: '700', textAlign: 'center' }, primaryText: { color: '#fff' }, secondaryText: { color: '#065f46' },
  step: { flexDirection: 'row', gap: 12, marginBottom: 20 }, badge: { backgroundColor: '#d1fae5', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#065f46', fontSize: 18, fontWeight: '700' }, stepText: { flex: 1 }, stepTitle: { color: '#0f172a', fontSize: 20, fontWeight: '700', marginBottom: 6 }, stepDescription: { color: '#64748b', fontSize: 14, lineHeight: 21 },
});
