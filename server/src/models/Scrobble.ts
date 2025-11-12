import mongoose, { Document, Schema } from 'mongoose';

export interface IScrobble extends Document {
  userId: mongoose.Types.ObjectId;
  spotifyId: string;
  trackName: string; // KEPT for fast display (hybrid approach)
  artistName: string; // KEPT for fast display (hybrid approach)
  albumId?: string;
  albumName?: string; // KEPT for fast display (hybrid approach)
  albumArt?: string; // Will be removed after migration (Phase 7)
  durationMs?: number;
  playedAt: Date;
  playedAtRounded10s: Date; // For deduplication (floor to 10s)
  source: 'spotify';
  device?: string;
  clientVersion?: string;
  isScrobbled: boolean; // true if >= 40% played
  isSkip?: boolean;
  isPaused?: boolean;
  // Hybrid normalization references (V2)
  trackId?: mongoose.Types.ObjectId; // Reference to Track collection
  albumRefId?: mongoose.Types.ObjectId; // Reference to Album collection (renamed to avoid conflict with albumId)
  artistId?: mongoose.Types.ObjectId; // Reference to Artist collection
  // Derived fields (not persisted) used in projections
  dayKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const scrobbleSchema = new Schema<IScrobble>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    spotifyId: { type: String, required: true },
    trackName: { type: String, required: true }, // KEPT for hybrid approach
    artistName: { type: String, required: true }, // KEPT for hybrid approach
    albumId: { type: String }, // Spotify album ID (string)
    albumName: { type: String }, // KEPT for hybrid approach
    albumArt: { type: String }, // Will be removed in Phase 7
    durationMs: { type: Number },
    playedAt: { type: Date, required: true },
    playedAtRounded10s: { type: Date, required: true },
    source: { type: String, enum: ['spotify'], default: 'spotify' },
    device: { type: String },
    clientVersion: { type: String },
    isScrobbled: { type: Boolean, required: true, default: false },
    isSkip: { type: Boolean },
    isPaused: { type: Boolean },
    // Hybrid normalization references
    trackId: { type: Schema.Types.ObjectId, ref: 'Track', index: true },
    albumRefId: { type: Schema.Types.ObjectId, ref: 'Album', index: true },
    artistId: { type: Schema.Types.ObjectId, ref: 'Artist', index: true },
  },
  { timestamps: true }
);

// V2 indexes: unique by rounded timestamp, TTL on playedAt
scrobbleSchema.index({ userId: 1, spotifyId: 1, playedAtRounded10s: 1 }, { unique: true });
scrobbleSchema.index({ userId: 1, playedAt: -1 });
// TTL: 90 days (7776000 seconds) - set via env SCROBBLES_TTL_DAYS
const TTL_SECONDS = Number(process.env.SCROBBLES_TTL_DAYS || 90) * 24 * 60 * 60;
scrobbleSchema.index({ playedAt: 1 }, { expireAfterSeconds: TTL_SECONDS });
// Secondary indexes for analytics & filtering
scrobbleSchema.index({ userId: 1, albumId: 1, playedAt: -1 });
scrobbleSchema.index({ userId: 1, artistName: 1, playedAt: -1 });

export default mongoose.model<IScrobble>('Scrobble', scrobbleSchema);
