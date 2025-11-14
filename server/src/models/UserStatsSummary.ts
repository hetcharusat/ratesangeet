import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ILastScrobble {
  spotifyId?: string;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  playedAt?: Date;
}

export interface IUserStatsSummary extends Document {
  userId: Types.ObjectId; // ref to User
  totalScrobbles: number;
  totalMinutes: number;
  uniqueArtistsCount: number;
  lastScrobbled?: ILastScrobble;
  createdAt: Date;
  updatedAt: Date;
}

const LastScrobbleSchema = new Schema<ILastScrobble>({
  spotifyId: String,
  trackName: String,
  artistName: String,
  albumName: String,
  playedAt: Date,
});

const UserStatsSummarySchema = new Schema<IUserStatsSummary>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    totalScrobbles: { type: Number, required: true, default: 0 },
    totalMinutes: { type: Number, required: true, default: 0 },
    uniqueArtistsCount: { type: Number, required: true, default: 0 },
    lastScrobbled: { type: LastScrobbleSchema },
  },
  { timestamps: true }
);

const UserStatsSummary: Model<IUserStatsSummary> =
  mongoose.models.UserStatsSummary || mongoose.model<IUserStatsSummary>('UserStatsSummary', UserStatsSummarySchema);

export default UserStatsSummary;
