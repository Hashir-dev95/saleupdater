import { I18n } from 'i18n-js';
import type { TextStyle } from 'react-native';
import { en, type TranslationKey } from './en';
import { ur } from './ur';

export type { TranslationKey } from './en';
export const languages = {
  en: { label: 'EN', nativeName: 'English', direction: 'ltr', accessibilityKey: 'language.english' },
  ur: { label: 'اردو', nativeName: 'اردو', direction: 'rtl', accessibilityKey: 'language.urdu' },
} as const;
export type Language = keyof typeof languages;
export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && Object.hasOwn(languages, value);
}

export type MessageParams = { [name: string]: string | number | Message };
export type Message = { key: TranslationKey; params?: MessageParams };
export const message = (key: TranslationKey, params?: MessageParams): Message => ({ key, params });

const i18n = new I18n({ en, ur }, { defaultLocale: 'en', enableFallback: true });

// Pass the locale per call: async operations and web rendering never mutate a global locale.
export function createLocalizer(language: Language) {
  const isRTL = languages[language].direction === 'rtl';
  function t(key: TranslationKey, params: MessageParams = {}): string {
    const values = Object.fromEntries(Object.entries(params).map(([name, value]) => {
      if (typeof value === 'object') return [name, resolve(value)];
      // Isolate interpolated data in RTL prose; never change stored values or API payloads.
      return [name, isRTL ? `\u2068${value}\u2069` : value];
    }));
    return i18n.t(key, { ...values, locale: language });
  }
  function resolve(value: Message): string { return t(value.key, value.params); }
  const textStyle: TextStyle = { textAlign: isRTL ? 'right' : 'left', writingDirection: languages[language].direction };
  const directionStyle: TextStyle = { writingDirection: languages[language].direction };
  return { t, resolve, isRTL, textStyle, directionStyle };
}

// Stable Western digits for business data; changing UI language does not change the date value/format.
export function formatBusinessDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-PK');
}
