import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IAlbumStats extends Document {
  userId: Types.ObjectId; // ref to User
  albumId?: string; // Spotify album ID (optional)
  albumKey: string; // derived key (albumId || albumName) used for uniqueness
  albumName?: string;
  artistName?: string;
  albumArt?: string;
  playCount: number;
  totalTracks?: number; // canonical track count (fetched once, cached)
  albumPlayCount: number; // number of times user completed 70%+ unique tracks
  lastCompletedAt?: Date; // timestamp of last completion
  lastPlayedAt?: Date;
  uniqueTracksPlayed: string[]; // tracks counted in the ongoing completion cycle
  createdAt: Date;
  updatedAt: Date;
}

const AlbumStatsSchema = new Schema<IAlbumStats>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    albumId: { type: String },
    albumKey: { type: String, required: true },
    albumName: { type: String },
    artistName: { type: String },
    albumArt: { type: String },
    playCount: { type: Number, required: true, default: 0 },
    totalTracks: { type: Number },
    albumPlayCount: { type: Number, default: 0 },
    lastCompletedAt: { type: Date },
    lastPlayedAt: { type: Date },
    uniqueTracksPlayed: { type: [String], default: [] },
  },
  { timestamps: true }
);

// Unique per user+albumKey
AlbumStatsSchema.index({ userId: 1, albumKey: 1 }, { unique: true });
// For leaderboards per user
AlbumStatsSchema.index({ userId: 1, playCount: -1 });
AlbumStatsSchema.index({ userId: 1, albumPlayCount: -1 });
// Fast recent activity & progress queries
AlbumStatsSchema.index({ userId: 1, lastPlayedAt: -1 });
AlbumStatsSchema.index({ userId: 1, lastCompletedAt: -1 });

const AlbumStats: Model<IAlbumStats> =
  mongoose.models.AlbumStats || mongoose.model<IAlbumStats>('AlbumStats', AlbumStatsSchema);

export default AlbumStats;
