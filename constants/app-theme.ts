export type AppThemeMode = 'light' | 'dark';

export type AppThemeColors = {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryPressed: string;
  primaryText: string;
  secondary: string;
  secondaryText: string;
  badge: string;
  input: string;
  warningBackground: string;
  warningText: string;
  error: string;
  success: string;
  overlay: string;
};

export const appThemes: Record<AppThemeMode, AppThemeColors> = {
  light: {
    background: '#eef4f2',
    surface: '#ffffff',
    surfaceMuted: '#f8fafc',
    text: '#0f172a',
    textMuted: '#526176',
    border: '#cbd5e1',
    primary: '#047857',
    primaryPressed: '#065f46',
    primaryText: '#ffffff',
    secondary: '#dff8ed',
    secondaryText: '#065f46',
    badge: '#d1fae5',
    input: '#f8fafc',
    warningBackground: '#fffbeb',
    warningText: '#854d0e',
    error: '#b91c1c',
    success: '#047857',
    overlay: 'rgba(15, 23, 42, 0.68)',
  },
  dark: {
    background: '#07111f',
    surface: '#111c2e',
    surfaceMuted: '#17243a',
    text: '#f8fafc',
    textMuted: '#cbd5e1',
    border: '#3b4b63',
    primary: '#10b981',
    primaryPressed: '#059669',
    primaryText: '#052e25',
    secondary: '#163a34',
    secondaryText: '#a7f3d0',
    badge: '#17483c',
    input: '#0d1929',
    warningBackground: '#422f12',
    warningText: '#fde68a',
    error: '#fca5a5',
    success: '#6ee7b7',
    overlay: 'rgba(0, 0, 0, 0.78)',
  },
};
