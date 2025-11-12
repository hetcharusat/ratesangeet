import { Router, Request, Response } from 'express';
import { transitionalSuccess, error as respondError } from '../utils/response';
import axios from 'axios';
import User from '../models/User';

const router = Router();
// Normalize Spotify OAuth errors into friendly codes/messages
function mapSpotifyAuthError(err: any, usedRedirect?: string) {
  const status = err?.response?.status || 500;
  const data = err?.response?.data || {};
  const raw = (typeof data === 'object' ? data : {}) as Record<string, any>;
  const errorStr = (raw.error || raw.error_description || '').toString();
  const description = (raw.error_description || raw.message || err?.message || '').toString();

  let errorCode: string = 'unknown_error';
  let message = 'Authentication failed. Please try again.';

  const descLower = `${errorStr} ${description}`.toLowerCase();
  if (descLower.includes('invalid_client')) {
    errorCode = 'invalid_client';
    message = 'Invalid client credentials. Verify Client ID and Client Secret belong to the same Spotify app.';
  } else if (descLower.includes('invalid_grant')) {
    errorCode = 'invalid_grant';
    message = 'Authorization code expired or already used, or redirect URI mismatch.';
  } else if (descLower.includes('invalid_redirect') || descLower.includes('invalid redirect uri')) {
    errorCode = 'invalid_redirect_uri';
    message = 'Redirect URI mismatch. Ensure the exact URI is registered in Spotify Dashboard.';
  } else if (descLower.includes('unauthorized_client')) {
    errorCode = 'unauthorized_client';
    message = 'App is not permitted to use this grant type or configuration. Check app settings.';
  } else if (status === 401) {
    errorCode = 'unauthorized';
    message = 'Unauthorized. Check client credentials and app settings.';
  } else if (status >= 500) {
    errorCode = 'spotify_unavailable';
    message = 'Spotify service is temporarily unavailable. Please try again later.';
  }

  return {
    status,
    errorCode,
    message,
    details: raw,
    usedRedirectUri: usedRedirect,
  };
}


// Spotify Auth URLs
const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

// Initiate Spotify OAuth
router.get('/login', (req: Request, res: Response) => {
  // target=mobile|web chooses redirect; default to web/server if unspecified
  const target = (req.query.target as string) || 'web';
  const scope = [
    'user-read-private',
    'user-read-email',
    'user-read-recently-played',
    'user-top-read',
    'user-read-currently-playing',
    'user-read-playback-state',
  ].join(' ');

  // Select appropriate redirect URI
  const redirectUri = target === 'mobile'
    ? (process.env.SPOTIFY_REDIRECT_URI_MOBILE || process.env.SPOTIFY_REDIRECT_URI || '')
    : (process.env.SPOTIFY_REDIRECT_URI_WEB || process.env.SPOTIFY_REDIRECT_URI || '');

  console.log('🔑 /auth/login - Sending to Spotify:', {
    target,
    redirectUri,
    clientId: process.env.SPOTIFY_CLIENT_ID,
  });

  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID || '',
    response_type: 'code',
    redirect_uri: redirectUri,
    scope,
  });

  return transitionalSuccess(res, { url: `${SPOTIFY_AUTH_URL}?${params.toString()}`, target, redirectUri });
});

// Spotify OAuth Callback
router.post('/callback', async (req: Request, res: Response) => {
  const { code, redirectUri, codeVerifier, target } = req.body as { code?: string; redirectUri?: string; codeVerifier?: string; target?: string };

  console.log('📱 /auth/callback received:', {
    code: code?.substring(0, 20) + '...',
    redirectUri,
    target,
    hasCodeVerifier: !!codeVerifier,
    platform: codeVerifier ? 'PKCE (mobile)' : 'Client Secret (web)',
  });

  if (!code) {
    return res.status(400).json({ error: 'Authorization code required' });
  }

  try {
    // Exchange code for tokens
    let tokenResponse;
    const tokenParams = new URLSearchParams();
    tokenParams.set('grant_type', 'authorization_code');
    tokenParams.set('code', code);
    
    // Determine final redirect URI (MUST match what was used in authorization request)
    let finalRedirectUri = redirectUri;
    if (!finalRedirectUri) {
      finalRedirectUri = target === 'mobile'
        ? (process.env.SPOTIFY_REDIRECT_URI_MOBILE || process.env.SPOTIFY_REDIRECT_URI)
        : (process.env.SPOTIFY_REDIRECT_URI_WEB || process.env.SPOTIFY_REDIRECT_URI);
    }
    
    tokenParams.set('redirect_uri', finalRedirectUri || '');
    
    console.log('🔑 Token exchange with Spotify:', {
      redirectUri: finalRedirectUri,
      grantType: 'authorization_code',
      hasPKCE: !!codeVerifier,
    });

    if (codeVerifier) {
      // PKCE exchange without client secret (public client)
      tokenParams.set('client_id', process.env.SPOTIFY_CLIENT_ID || '');
      tokenParams.set('code_verifier', codeVerifier);
      tokenResponse = await axios.post(
        SPOTIFY_TOKEN_URL,
        tokenParams,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
    } else {
      // Confidential client exchange using client secret
      tokenResponse = await axios.post(
        SPOTIFY_TOKEN_URL,
        tokenParams,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${Buffer.from(
              `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
            ).toString('base64')}`,
          },
        }
      );
    }
    
  console.log('✅ Token exchange successful');

    const { access_token, refresh_token } = tokenResponse.data;

    // Get user profile
    const userResponse = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const userData = userResponse.data;

    // Save or update user in database
    let user = await User.findOne({ spotifyId: userData.id });
    
    if (user) {
      // Update existing user
      user.displayName = userData.display_name;
      user.email = userData.email;
      user.accessToken = access_token;
      user.refreshToken = refresh_token;
      user.profileImage = userData.images?.[0]?.url;
      // Token health tracking
      // @ts-ignore optional fields exist on model
      user.tokenStatus = 'active';
      // @ts-ignore
      user.lastTokenRefreshAt = new Date();
      // @ts-ignore
      user.consecutiveRefreshFailures = 0;
      if (!user.username) {
        // Assign random unique username if missing
        const base = (user.displayName || 'user').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'user';
        let candidate = base;
        let suffix = 0;
        // Ensure uniqueness
        // eslint-disable-next-line no-constant-condition
        while (await User.findOne({ username: candidate })) {
          suffix += 1;
          candidate = `${base}${suffix}`;
        }
        user.username = candidate;
      }
      await user.save();
      console.log('✅ Updated existing user:', user.displayName);
    } else {
      // Create new user
      // Assign a random unique username at creation
      const base = (userData.display_name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'user';
      let candidate = base;
      let suffix = 0;
      // eslint-disable-next-line no-constant-condition
      while (await User.findOne({ username: candidate })) {
        suffix += 1;
        candidate = `${base}${suffix}`;
      }

      user = await User.create({
        spotifyId: userData.id,
        displayName: userData.display_name,
        email: userData.email,
        accessToken: access_token,
        refreshToken: refresh_token,
        profileImage: userData.images?.[0]?.url,
        username: candidate,
        // @ts-ignore
        tokenStatus: 'active',
      });
      console.log('✅ Created new user:', user.displayName);
    }

    return transitionalSuccess(res, {
      accessToken: access_token,
      refreshToken: refresh_token,
      user: {
        id: user._id,
        spotifyId: user.spotifyId,
        displayName: user.displayName,
        email: user.email,
        profileImage: user.profileImage,
        username: user.username,
      },
    });
  } catch (error: any) {
    const mapped = mapSpotifyAuthError(error, redirectUri || process.env.SPOTIFY_REDIRECT_URI);
    console.error('❌ Spotify auth error:', mapped.status, mapped.errorCode, mapped.details);
    return respondError(res, mapped.message || 'Authentication failed', mapped.status, {
      errorCode: mapped.errorCode,
      details: mapped.details,
      usedRedirectUri: mapped.usedRedirectUri,
    });
  }
});

// Mobile OAuth Callback - Spotify redirects here, then we redirect to app with tokens
router.get('/callback/mobile', async (req: Request, res: Response) => {
  const { code, error } = req.query;

  if (error) {
    console.error('❌ Spotify OAuth error:', error);
    return res.redirect(`ratesangeet://callback?error=${error}`);
  }

  if (!code) {
    return res.redirect('ratesangeet://callback?error=missing_code');
  }

  try {
    // Exchange code for tokens
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code as string,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI_MOBILE || '',
    });

    const tokenResponse = await axios.post(
      SPOTIFY_TOKEN_URL,
      tokenParams,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
          ).toString('base64')}`,
        },
      }
    );

    const { access_token, refresh_token } = tokenResponse.data;

    // Get user profile
    const userResponse = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const userData = userResponse.data;

    // Save or update user in database
    let user = await User.findOne({ spotifyId: userData.id });
    
    if (user) {
      // Update existing user
      user.displayName = userData.display_name;
      user.email = userData.email;
      user.accessToken = access_token;
      user.refreshToken = refresh_token;
      user.profileImage = userData.images?.[0]?.url;
      // @ts-ignore
      user.tokenStatus = 'active';
      // @ts-ignore
      user.lastTokenRefreshAt = new Date();
      // @ts-ignore
      user.consecutiveRefreshFailures = 0;
      if (!user.username) {
        const base = (user.displayName || 'user').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'user';
        let candidate = base;
        let suffix = 0;
        while (await User.findOne({ username: candidate })) {
          suffix += 1;
          candidate = `${base}${suffix}`;
        }
        user.username = candidate;
      }
      await user.save();
    } else {
      // Create new user
      const base = (userData.display_name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'user';
      let candidate = base;
      let suffix = 0;
      while (await User.findOne({ username: candidate })) {
        suffix += 1;
        candidate = `${base}${suffix}`;
      }
      user = new User({
        spotifyId: userData.id,
        displayName: userData.display_name,
        email: userData.email,
        accessToken: access_token,
        refreshToken: refresh_token,
        profileImage: userData.images?.[0]?.url,
        username: candidate,
      });
      await user.save();
    }

    console.log('✅ Mobile auth successful, redirecting to app...');

    // Redirect to app with tokens
    const appRedirect = `ratesangeet://callback?` + new URLSearchParams({
      accessToken: access_token,
      refreshToken: refresh_token,
      userId: String(user._id),
      displayName: user.displayName,
      email: user.email || '',
      profileImage: user.profileImage || '',
      username: user.username || '',
    }).toString();

    return res.redirect(appRedirect);
  } catch (error: any) {
    console.error('❌ Mobile callback error:', error.response?.data || error.message);
    return res.redirect(`ratesangeet://callback?error=auth_failed`);
  }
});

// PKCE-based login: client exchanges code -> sends access/refresh tokens here for upsert
router.post('/pkce-login', async (req: Request, res: Response) => {
  try {
    const { accessToken, refreshToken } = req.body as { accessToken?: string; refreshToken?: string };

    if (!accessToken) {
  return respondError(res, 'accessToken required', 400);
    }

    // Fetch Spotify profile with provided token
    const me = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const userData = me.data;

    let user = await User.findOne({ spotifyId: userData.id });
    if (user) {
      user.displayName = userData.display_name;
      user.email = userData.email;
      user.accessToken = accessToken;
      if (refreshToken) user.refreshToken = refreshToken;
      user.profileImage = userData.images?.[0]?.url;
      // @ts-ignore
      user.tokenStatus = 'active';
      // @ts-ignore
      user.lastTokenRefreshAt = new Date();
      // @ts-ignore
      user.consecutiveRefreshFailures = 0;
      if (!user.username) {
        const base = (user.displayName || 'user').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'user';
        let candidate = base;
        let suffix = 0;
        // eslint-disable-next-line no-constant-condition
        while (await User.findOne({ username: candidate })) {
          suffix += 1;
          candidate = `${base}${suffix}`;
        }
        user.username = candidate;
      }
      await user.save();
      console.log('✅ PKCE login: updated user', user.displayName);
    } else {
      const base = (userData.display_name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) || 'user';
      let candidate = base;
      let suffix = 0;
      // eslint-disable-next-line no-constant-condition
      while (await User.findOne({ username: candidate })) {
        suffix += 1;
        candidate = `${base}${suffix}`;
      }

      user = await User.create({
        spotifyId: userData.id,
        displayName: userData.display_name,
        email: userData.email,
        accessToken,
        refreshToken,
        profileImage: userData.images?.[0]?.url,
        username: candidate,
        // @ts-ignore
        tokenStatus: 'active',
      });
      console.log('✅ PKCE login: created user', user.displayName);
    }

    return transitionalSuccess(res, {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        spotifyId: user.spotifyId,
        displayName: user.displayName,
        email: user.email,
        profileImage: user.profileImage,
        username: user.username,
      },
    });
  } catch (error: any) {
    console.error('❌ PKCE login error:', error?.response?.status, error?.response?.data || error?.message);
  return respondError(res, 'PKCE login failed', 401, error?.response?.data || error?.message);
  }
});

// Refresh Access Token
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
  return respondError(res, 'Refresh token required', 400);
  }

  try {
    const response = await axios.post(
      SPOTIFY_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
          ).toString('base64')}`,
        },
      }
    );

    const data = response.data;
    // Spotify may return a new refresh_token; propagate it when present
    const result: any = { accessToken: data.access_token };
    if (data.refresh_token) {
      result.refreshToken = data.refresh_token;
    }
  return transitionalSuccess(res, result);
  } catch (error: any) {
    const mapped = mapSpotifyAuthError(error);
    console.error('Token refresh error:', mapped.status, mapped.errorCode, mapped.details);
    return respondError(res, mapped.message || 'Token refresh failed', mapped.status, {
      errorCode: mapped.errorCode,
      details: mapped.details,
    });
  }
});

// PKCE Refresh (no client secret). Uses server-stored refresh token and client_id param.
router.post('/pkce-refresh', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body as { userId?: string };
  if (!userId) return respondError(res, 'userId required', 400);

    const user = await User.findOne({
      $or: [ { _id: userId }, { spotifyId: userId } ],
    });
  if (!user) return respondError(res, 'User not found', 404);

    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: user.refreshToken,
      client_id: process.env.SPOTIFY_CLIENT_ID || '',
    });

    const tokenResp = await axios.post(
      SPOTIFY_TOKEN_URL,
      params,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const data = tokenResp.data || {};
    user.accessToken = data.access_token;
    const rotated = !!data.refresh_token;
    if (rotated) user.refreshToken = data.refresh_token;
    // @ts-ignore
    user.tokenStatus = 'active';
    // @ts-ignore
    user.lastTokenRefreshAt = new Date();
    // @ts-ignore
    user.consecutiveRefreshFailures = 0;
    await user.save();

    return transitionalSuccess(res, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || user.refreshToken,
      refreshTokenRotated: rotated,
    });
  } catch (error: any) {
    const mapped = mapSpotifyAuthError(error);
    return respondError(res, mapped.message || 'PKCE refresh failed', mapped.status, {
      errorCode: mapped.errorCode,
      details: mapped.details,
    });
  }
});

// Search Users
router.get('/search-users', async (req: Request, res: Response) => {
  try {
    const { query, limit = 20 } = req.query;

    if (!query || typeof query !== 'string') {
  return respondError(res, 'Search query required', 400);
    }

    // Support @username queries and fuzzy username matches
    const q = query.trim();
    const usernameQuery = q.startsWith('@') ? q.slice(1) : q;

    const users = await User.find({
      $or: [
        { username: { $regex: `^${usernameQuery}$`, $options: 'i' } }, // prefer exact username (case-insensitive)
        { username: { $regex: usernameQuery, $options: 'i' } },
        { displayName: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ],
    })
      .select('_id spotifyId displayName email profileImage username')
      .limit(Number(limit))
      .lean();

  return transitionalSuccess(res, { users });
  } catch (error: any) {
    console.error('User search error:', error);
  return respondError(res, 'Failed to search users', 500);
  }
});

export default router;
