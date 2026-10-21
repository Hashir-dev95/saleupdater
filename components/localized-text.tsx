import { StyleSheet, Text, type TextProps } from 'react-native';
import { useLocalization } from '@/hooks/use-localization';

// Shared Urdu direction/leading, while preserving explicit centered button/dialog styles.
export function LocalizedText({ style, business = false, ...props }: TextProps & { business?: boolean }) {
  const { textStyle, isRTL } = useLocalization();
  const flattened = StyleSheet.flatten(style);
  const leading = isRTL && !business
    ? { lineHeight: Math.max(flattened?.lineHeight ?? 0, Math.ceil((flattened?.fontSize ?? 14) * 1.65)) }
    : undefined;
  return <Text {...props} style={[
    textStyle, style, leading,
    business && { writingDirection: 'auto', textAlign: 'left' },
  ]} />;
}
