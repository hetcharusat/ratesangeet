import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import User from '../models/User.js';

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

/**
 * Middleware to automatically refresh expired access tokens
 * 
 * Usage: Add to routes that make Spotify API calls
 * 
 * Expects req.body.userId or req.query.userId or req.params.userId
 * 
 * If access token is expired (401 from Spotify), automatically refreshes
 * using refresh token and updates user in DB.
 */
export async function autoRefreshToken(req: Request, res: Response, next: NextFunction) {
  try {
    // Extract userId from various locations
    const userId = req.body.userId || req.query.userId || req.params.userId;
    
    if (!userId) {
      // No userId provided, skip refresh logic
      return next();
    }

    // Find user
    const user = await User.findOne({
      $or: [
        { _id: userId },
        { spotifyId: userId },
      ],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Test if access token is valid
    try {
      await axios.get('https://api.spotify.com/v1/me', {
        headers: { Authorization: `Bearer ${user.accessToken}` },
        timeout: 3000,
      });
      
      // Token is valid, proceed
      if (user.tokenStatus !== 'active') {
        user.tokenStatus = 'active';
        user.consecutiveRefreshFailures = 0;
        await user.save();
      }
      return next();
    } catch (error: any) {
      const status = error?.response?.status;
      
      if (status === 401) {
        // Access token expired, try to refresh
        console.log(`🔄 Access token expired for ${user.displayName}, attempting refresh...`);
        
        try {
          const refreshResponse = await axios.post(
            SPOTIFY_TOKEN_URL,
            new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: user.refreshToken,
            }),
            {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(
                  `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
                ).toString('base64')}`,
              },
              timeout: 5000,
            }
          );

          const data = refreshResponse.data;
          
          // Update user with new tokens
          user.accessToken = data.access_token;
          
          // IMPORTANT: Spotify may or may not return a new refresh token
          // Per official docs: "When a refresh token is not returned, continue using the existing token"
          if (data.refresh_token) {
            console.log(`🔄 Refresh token rotated for ${user.displayName}`);
            user.refreshToken = data.refresh_token;
          } else {
            console.log(`ℹ️  Keeping existing refresh token for ${user.displayName} (not rotated)`);
          }
          // mark health
          user.tokenStatus = 'active';
          user.lastTokenRefreshAt = new Date();
          user.consecutiveRefreshFailures = 0;
          
          await user.save();

          console.log(`✅ Successfully refreshed access token for ${user.displayName}`);
          
          // Proceed with fresh token
          return next();
        } catch (refreshError: any) {
          const refreshStatus = refreshError?.response?.status;
          const refreshData = refreshError?.response?.data;
          const errorType = refreshData?.error;
          
          // If invalid_client, try PKCE-style fallback (no secret, with client_id)
          if ((refreshStatus === 400 || refreshStatus === 401) && (errorType === 'invalid_client')) {
            try {
              const fallbackResp = await axios.post(
                SPOTIFY_TOKEN_URL,
                new URLSearchParams({
                  grant_type: 'refresh_token',
                  refresh_token: user.refreshToken,
                  client_id: process.env.SPOTIFY_CLIENT_ID || '',
                }),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 5000 }
              );
              const data2 = fallbackResp.data;
              user.accessToken = data2.access_token;
              if (data2.refresh_token) user.refreshToken = data2.refresh_token;
              user.tokenStatus = 'active';
              user.lastTokenRefreshAt = new Date();
              user.consecutiveRefreshFailures = 0;
              await user.save();
              console.log(`✅ Fallback PKCE refresh succeeded for ${user.displayName}`);
              return next();
            } catch (fbErr: any) {
              console.error('❌ Fallback PKCE refresh failed:', fbErr?.response?.data || fbErr.message);
            }
          }

          if (refreshStatus === 400 || refreshStatus === 401) {
            // Refresh token also expired/invalid
            console.error(`❌ Refresh token failed for ${user.displayName}: ${errorType}`);
            // update user token status instead of deleting
            user.tokenStatus = 'revoked';
            user.lastTokenErrorAt = new Date();
            user.lastTokenError = errorType || refreshError?.response?.data?.error_description || 'unknown_error';
            user.consecutiveRefreshFailures = (user.consecutiveRefreshFailures || 0) + 1;
            await user.save();
            return res.status(401).json({
              success: false,
              error: 'Authentication expired',
              errorCode: 'refresh_token_expired',
              message: 'Your Spotify session has expired. Please log in again.',
              details: {
                reason: 'Both access and refresh tokens are invalid',
                spotifyError: refreshData?.error_description || refreshData?.error,
                tokenStatus: user.tokenStatus,
              },
            });
          }
          
          // Other refresh error
          console.error(`❌ Error refreshing token for ${user.displayName}:`, refreshError.message);
          user.lastTokenErrorAt = new Date();
          user.lastTokenError = refreshError?.response?.data?.error || refreshError.message;
          user.consecutiveRefreshFailures = (user.consecutiveRefreshFailures || 0) + 1;
          await user.save();
          return res.status(500).json({
            success: false,
            error: 'Token refresh failed',
            details: refreshData,
          });
        }
      } else {
        // Other Spotify API error (not 401)
        throw error;
      }
    }
  } catch (error: any) {
    console.error('❌ Error in autoRefreshToken middleware:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message,
    });
  }
}

/**
 * Utility function to manually refresh a user's token
 * Can be called from routes or background jobs
 */
export async function refreshUserToken(userId: string): Promise<{ success: boolean; error?: string; newAccessToken?: string; newRefreshToken?: string; refreshTokenRotated?: boolean }> {
  try {
    const user = await User.findOne({
      $or: [
        { _id: userId },
        { spotifyId: userId },
      ],
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const refreshResponse = await axios.post(
      SPOTIFY_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: user.refreshToken,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
          ).toString('base64')}`,
        },
        timeout: 5000,
      }
    );

    const data = refreshResponse.data;
    
    // Update user with new access token
    user.accessToken = data.access_token;
    
    // IMPORTANT: Spotify may or may not return a new refresh token
    // Per official docs: "When a refresh token is not returned, continue using the existing token"
    const refreshTokenRotated = !!data.refresh_token;
    if (refreshTokenRotated) {
      user.refreshToken = data.refresh_token;
      console.log(`🔄 Refresh token rotated for ${user.displayName || user.spotifyId}`);
    }
    user.tokenStatus = 'active';
    user.lastTokenRefreshAt = new Date();
    user.consecutiveRefreshFailures = 0;
    
    await user.save();

    return {
      success: true,
      newAccessToken: data.access_token,
      newRefreshToken: data.refresh_token || user.refreshToken, // Return current refresh token if not rotated
      refreshTokenRotated,
    };
  } catch (error: any) {
    const status = error?.response?.status;
    const errorData = error?.response?.data;
    // invalid_client fallback path
    if ((status === 400 || status === 401) && (errorData?.error === 'invalid_client')) {
      try {
        const user = await User.findOne({ $or: [{ _id: userId }, { spotifyId: userId }] });
        if (!user) return { success: false, error: 'User not found' };
        const fb = await axios.post(
          SPOTIFY_TOKEN_URL,
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: user.refreshToken,
            client_id: process.env.SPOTIFY_CLIENT_ID || '',
          }),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 5000 }
        );
        const d = fb.data;
        user.accessToken = d.access_token;
        const rotated = !!d.refresh_token;
        if (rotated) user.refreshToken = d.refresh_token;
        user.tokenStatus = 'active';
        user.lastTokenRefreshAt = new Date();
        user.consecutiveRefreshFailures = 0;
        await user.save();
        return {
          success: true,
          newAccessToken: d.access_token,
          newRefreshToken: d.refresh_token || user.refreshToken,
          refreshTokenRotated: rotated,
        };
      } catch (fbErr: any) {
        // fall through to marking revoked below
      }
    }
    
    // mark failure on user if found
    try {
      const user = await User.findOne({ $or: [{ _id: userId }, { spotifyId: userId }] });
      if (user) {
        user.lastTokenErrorAt = new Date();
        user.lastTokenError = errorData?.error || error.message;
        if (status === 400 || status === 401) {
          user.tokenStatus = 'revoked';
        }
        user.consecutiveRefreshFailures = (user.consecutiveRefreshFailures || 0) + 1;
        await user.save();
      }
    } catch {}

    return {
      success: false,
      error: errorData?.error_description || errorData?.error || error.message,
    };
  }
}
