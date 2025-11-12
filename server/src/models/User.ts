import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  spotifyId: string;
  displayName: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  profileImage?: string;
  username?: string;
  bio?: string;
  instagramUsername?: string;
  twitterHandle?: string;
  location?: string;
  favAlbums?: Array<{ id: string; name: string; artist: string; image?: string }>;
  favTracks?: Array<{ id: string; name: string; artist: string; image?: string }>;
  createdAt: Date;
  followers: mongoose.Types.ObjectId[];
  following: mongoose.Types.ObjectId[];
  /** Lifecycle status of the user's Spotify tokens */
  tokenStatus: 'active' | 'revoked' | 'inactive';
  /** When we last successfully refreshed the access token */
  lastTokenRefreshAt?: Date;
  /** When we last detected a refresh failure */
  lastTokenErrorAt?: Date;
  /** Last Spotify OAuth error string (e.g. invalid_grant) */
  lastTokenError?: string;
  /** Count of consecutive refresh failures */
  consecutiveRefreshFailures?: number;
}

const userSchema = new Schema<IUser>({
  spotifyId: { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  email: { type: String, required: true },
  accessToken: { type: String, required: true },
  refreshToken: { type: String, required: true },
  profileImage: { type: String },
  username: { type: String, unique: true, sparse: true },
  bio: { type: String, maxlength: 200 },
  instagramUsername: { type: String },
  twitterHandle: { type: String },
  location: { type: String, maxlength: 50 },
  favAlbums: [{ id: String, name: String, artist: String, image: String }],
  favTracks: [{ id: String, name: String, artist: String, image: String }],
  createdAt: { type: Date, default: Date.now },
  followers: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
  following: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
  tokenStatus: { type: String, enum: ['active', 'revoked', 'inactive'], default: 'active', index: true },
  lastTokenRefreshAt: { type: Date },
  lastTokenErrorAt: { type: Date },
  lastTokenError: { type: String },
  consecutiveRefreshFailures: { type: Number, default: 0 },
});

// Create text index for faster search (run once in production)
userSchema.index({ username: 'text', displayName: 'text' });

export default mongoose.model<IUser>('User', userSchema);
