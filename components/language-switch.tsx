import { Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useLocalization } from '@/hooks/use-localization';
import { languages, type Language } from '@/localization';
import { LocalizedText } from './localized-text';

export function LanguageSwitch() {
  const { colors } = useAppTheme();
  const { language, setLanguage, t } = useLocalization();
  return <View style={[styles.control, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
    {(Object.keys(languages) as Language[]).map(code => <Pressable
      key={code}
      accessibilityRole="button"
      accessibilityLabel={`${t('language.label')}: ${t(languages[code].accessibilityKey)}`}
      accessibilityState={{ selected: language === code }}
      onPress={() => { void setLanguage(code); }}
      style={({ pressed }) => [styles.option, language === code && { backgroundColor: colors.primary }, pressed && styles.pressed]}>
      <LocalizedText style={[styles.label, { color: language === code ? colors.primaryText : colors.text }]}>
        {languages[code].label}
      </LocalizedText>
    </Pressable>)}
  </View>;
}

const styles = StyleSheet.create({
  control: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 2, alignSelf: 'flex-end', flexShrink: 0 },
  option: { minWidth: 44, minHeight: 44, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  pressed: { opacity: 0.75 },
});
