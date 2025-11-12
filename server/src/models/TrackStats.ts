import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ITrackStats extends Document {
  userId: Types.ObjectId; // ref to User
  trackId?: string; // Spotify track ID when available
  trackKey: string; // trackId || trackName+artistName
  trackName?: string;
  artistName?: string;
  albumName?: string;
  albumArt?: string;
  playCount: number;
  lastPlayedAt?: Date;
  replayGuardAt?: Date; // Used to ignore replays within 15 min
  createdAt: Date;
  updatedAt: Date;
}

const TrackStatsSchema = new Schema<ITrackStats>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    trackId: { type: String },
    trackKey: { type: String, required: true },
    trackName: { type: String },
    artistName: { type: String },
    albumName: { type: String },
    albumArt: { type: String },
    playCount: { type: Number, required: true, default: 0 },
    lastPlayedAt: { type: Date },
    replayGuardAt: { type: Date },
  },
  { timestamps: true }
);

TrackStatsSchema.index({ userId: 1, trackKey: 1 }, { unique: true });
TrackStatsSchema.index({ userId: 1, playCount: -1 });
// Fast retrieval of most recent tracks
TrackStatsSchema.index({ userId: 1, lastPlayedAt: -1 });

const TrackStats: Model<ITrackStats> =
  mongoose.models.TrackStats || mongoose.model<ITrackStats>('TrackStats', TrackStatsSchema);

export default TrackStats;
