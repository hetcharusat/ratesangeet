import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITrackStats extends Document {
  userId: string;
  trackId?: string; // Spotify track ID when available
  trackKey: string; // trackId || trackName+artistName
  trackName?: string;
  artistName?: string;
  albumName?: string;
  albumArt?: string;
  playCount: number;
  lastPlayedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TrackStatsSchema = new Schema<ITrackStats>(
  {
    userId: { type: String, required: true, index: true },
    trackId: { type: String },
    trackKey: { type: String, required: true },
    trackName: { type: String },
    artistName: { type: String },
    albumName: { type: String },
    albumArt: { type: String },
    playCount: { type: Number, required: true, default: 0 },
    lastPlayedAt: { type: Date },
  },
  { timestamps: true }
);

TrackStatsSchema.index({ userId: 1, trackKey: 1 }, { unique: true });
TrackStatsSchema.index({ userId: 1, playCount: -1 });

const TrackStats: Model<ITrackStats> =
  mongoose.models.TrackStats || mongoose.model<ITrackStats>('TrackStats', TrackStatsSchema);

export default TrackStats;
