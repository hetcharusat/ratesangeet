import mongoose, { Document, Schema } from 'mongoose';

export interface IScrobble extends Document {
  userId: mongoose.Types.ObjectId;
  spotifyId: string;
  trackName: string;
  artistName: string;
  albumId?: string;
  albumName?: string;
  albumArt?: string;
  durationMs?: number;
  playedAt: Date;
  source: 'spotify';
  createdAt: Date;
  updatedAt: Date;
}

const scrobbleSchema = new Schema<IScrobble>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    spotifyId: { type: String, required: true },
    trackName: { type: String, required: true },
    artistName: { type: String, required: true },
    albumId: { type: String },
    albumName: { type: String },
    albumArt: { type: String },
    durationMs: { type: Number },
    playedAt: { type: Date, required: true },
    source: { type: String, enum: ['spotify'], default: 'spotify' },
  },
  { timestamps: true }
);

scrobbleSchema.index({ userId: 1, playedAt: -1 });
scrobbleSchema.index({ userId: 1, spotifyId: 1, playedAt: 1 }, { unique: true });

export default mongoose.model<IScrobble>('Scrobble', scrobbleSchema);
