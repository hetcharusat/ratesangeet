// mobile/src/theme.ts
import { MD3LightTheme as DefaultTheme } from 'react-native-paper';

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#6750A4', // A Material 3 primary color
    secondary: '#958DA5', // A Material 3 secondary color
    background: '#FFFBFE',
    surface: '#FFFBFE',
  },
};
