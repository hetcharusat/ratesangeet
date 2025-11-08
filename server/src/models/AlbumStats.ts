import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAlbumStats extends Document {
  userId: string; // ref to User._id (string)
  albumId?: string; // Spotify album ID (optional)
  albumKey: string; // derived key (albumId || albumName) used for uniqueness
  albumName?: string;
  artistName?: string;
  albumArt?: string;
  playCount: number;
  lastPlayedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AlbumStatsSchema = new Schema<IAlbumStats>(
  {
    userId: { type: String, required: true, index: true },
    albumId: { type: String },
    albumKey: { type: String, required: true },
    albumName: { type: String },
    artistName: { type: String },
    albumArt: { type: String },
    playCount: { type: Number, required: true, default: 0 },
    lastPlayedAt: { type: Date },
  },
  { timestamps: true }
);

// Unique per user+albumKey
AlbumStatsSchema.index({ userId: 1, albumKey: 1 }, { unique: true });
// For leaderboards per user
AlbumStatsSchema.index({ userId: 1, playCount: -1 });

const AlbumStats: Model<IAlbumStats> =
  mongoose.models.AlbumStats || mongoose.model<IAlbumStats>('AlbumStats', AlbumStatsSchema);

export default AlbumStats;
