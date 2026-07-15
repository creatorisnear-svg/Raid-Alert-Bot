// Dark military theme -- matches the PWA palette.
// Both light and dark are set to the same dark values so the app never
// flips to a light theme regardless of phone system settings.

const palette = {
  background: '#0b0e0b',
  foreground: '#e8ede8',
  card: '#141a14',
  cardForeground: '#e8ede8',
  primary: '#c0392b',
  primaryForeground: '#ffffff',
  secondary: '#1a271a',
  secondaryForeground: '#e8ede8',
  muted: '#141a14',
  mutedForeground: '#7a8f7a',
  accent: '#7a1f1f',
  accentForeground: '#ffffff',
  destructive: '#e74c3c',
  destructiveForeground: '#ffffff',
  border: '#2a3a2a',
  input: '#2a3a2a',
  // Legacy aliases
  text: '#e8ede8',
  tint: '#c0392b',
};

const colors = {
  light: palette,
  dark: palette,
  radius: 10,
};

export default colors;
