import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text, Avatar, Card } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import config from '../config';
import { pkceLogin, handleSpotifyCallback } from '../services/api';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

const LoginScreen = () => {
  const { setAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);

  const rawRedirect = AuthSession.makeRedirectUri({
    native: 'ratesangeet://callback',
  });
  const redirectUri = Platform.OS === 'web'
    ? rawRedirect.replace('localhost', '127.0.0.1')
    : rawRedirect;

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: config.SPOTIFY_CLIENT_ID,
      scopes: [
        'user-read-private',
        'user-read-email',
        'user-read-recently-played',
        'user-top-read',
        'user-read-currently-playing',
        'user-read-playback-state',
      ],
      usePKCE: true,
      redirectUri,
      responseType: 'code',
      extraParams: {
        show_dialog: 'true',
      },
    },
    discovery
  );

  const handleLogin = async () => {
    if (Platform.OS === 'web') {
      if (request?.url) {
        try {
          if (request.codeVerifier) {
            sessionStorage.setItem('spotify_pkce_verifier', request.codeVerifier);
          }
          sessionStorage.setItem('spotify_redirect_uri', redirectUri);
        } catch {}
        window.location.href = request.url;
      }
    } else {
      await promptAsync();
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const qs = new URLSearchParams(window.location.search || '');
      const code = qs.get('code');
      const err = qs.get('error');
      if (err) {
        setError(`Authentication error: ${err}`);
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      if (code && !isCompleting) {
        setIsCompleting(true);
        (async () => {
          try {
            let codeVerifier: string | undefined;
            try {
              codeVerifier = sessionStorage.getItem('spotify_pkce_verifier') || undefined;
            } catch {}
            const data = await handleSpotifyCallback(code, redirectUri, codeVerifier);
            await setAuth({
              accessToken: data.accessToken,
              refreshToken: data.refreshToken || null,
              user: data.user,
            });
          } catch (e: any) {
            setError(e?.response?.data?.message || e?.message || 'Login failed');
          } finally {
            window.history.replaceState({}, document.title, window.location.pathname);
            try {
              sessionStorage.removeItem('spotify_pkce_verifier');
              sessionStorage.removeItem('spotify_redirect_uri');
            } catch {}
            setIsCompleting(false);
          }
        })();
      }
    } catch {
      // ignore session storage errors
    }
 
  }, []);

  useEffect(() => {
    if (!response) return;
    if (response?.type === 'success') {
      exchangeCodeAndLogin(response.params.code);
    } else if (response?.type === 'error') {
      setError('Authentication failed');
    }
  }, [response]);

  const exchangeCodeAndLogin = async (code: string) => {
    try {
      if (!request?.codeVerifier) return;
      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId: config.SPOTIFY_CLIENT_ID,
          code,
          redirectUri,
          extraParams: { code_verifier: request.codeVerifier },
        },
        discovery
      );
      const authData = await pkceLogin(tokenResponse.accessToken, tokenResponse.refreshToken);
      await setAuth({
        accessToken: authData.accessToken,
        refreshToken: authData.refreshToken || null,
        user: authData.user,
      });
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Login failed');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Avatar.Text size={100} label="🎵" style={styles.logo} />
        <Text variant="headlineLarge" style={styles.appName}>RateSangeet</Text>
        <Text variant="titleMedium" style={styles.tagline}>Your Music, Your Story</Text>

        <Card style={styles.featuresCard}>
          <Card.Content>
            <FeatureItem icon="star-circle-outline" text="Rate songs & albums" />
            <FeatureItem icon="pencil-outline" text="Write reviews" />
            <FeatureItem icon="chart-line" text="Track your listening" />
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          onPress={handleLogin}
          disabled={!request}
          icon="spotify"
          contentStyle={styles.loginButtonContent}
          style={styles.loginButton}
        >
          Continue with Spotify
        </Button>

        {error && (
          <Card style={styles.errorCard}>
            <Card.Content>
              <Text style={styles.errorText}>{error}</Text>
            </Card.Content>
          </Card>
        )}
      </View>
    </View>
  );
};

const FeatureItem = ({ icon, text }: { icon: string; text: string }) => (
  <View style={styles.featureItem}>
    <Avatar.Icon size={24} icon={icon} style={styles.featureIcon} />
    <Text variant="bodyLarge">{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    marginBottom: 20,
  },
  appName: {
    marginBottom: 8,
  },
  tagline: {
    marginBottom: 48,
  },
  featuresCard: {
    marginBottom: 48,
    width: '100%',
    maxWidth: 320,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  featureIcon: {
    marginRight: 16,
  },
  loginButton: {
    width: '100%',
    maxWidth: 320,
  },
  loginButtonContent: {
    paddingVertical: 8,
  },
  errorCard: {
    marginTop: 20,
    width: '100%',
    maxWidth: 320,
  },
  errorText: {
    textAlign: 'center',
  },
});

export default LoginScreen;
