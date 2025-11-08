import AsyncStorage from '@react-native-async-storage/async-storage';

export interface User {
  id: string;
  displayName: string;
  email: string;
  profileImage?: string;
  username?: string;
}

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
}

const AUTH_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  USER: 'user',
};

export const saveAuth = async (authData: AuthState) => {
  try {
    if (authData.accessToken) {
      await AsyncStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, authData.accessToken);
    }
    if (authData.refreshToken) {
      await AsyncStorage.setItem(AUTH_KEYS.REFRESH_TOKEN, authData.refreshToken);
    }
    if (authData.user) {
      await AsyncStorage.setItem(AUTH_KEYS.USER, JSON.stringify(authData.user));
    }
  } catch (error) {
    console.error('Error saving auth data:', error);
  }
};

export const getAuth = async (): Promise<AuthState> => {
  try {
    const accessToken = await AsyncStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
    const refreshToken = await AsyncStorage.getItem(AUTH_KEYS.REFRESH_TOKEN);
    const userStr = await AsyncStorage.getItem(AUTH_KEYS.USER);
    const user = userStr ? JSON.parse(userStr) : null;

    return { accessToken, refreshToken, user };
  } catch (error) {
    console.error('Error getting auth data:', error);
    return { accessToken: null, refreshToken: null, user: null };
  }
};

export const clearAuth = async () => {
  try {
    await AsyncStorage.multiRemove([
      AUTH_KEYS.ACCESS_TOKEN,
      AUTH_KEYS.REFRESH_TOKEN,
      AUTH_KEYS.USER,
    ]);
  } catch (error) {
    console.error('Error clearing auth data:', error);
  }
};
