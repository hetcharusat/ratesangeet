import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  spotifyId: string;
  displayName: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  profileImage?: string;
  username?: string;
  favAlbums?: Array<{ id: string; name: string; artist: string; image?: string }>;
  favTracks?: Array<{ id: string; name: string; artist: string; image?: string }>;
  createdAt: Date;
  followers: mongoose.Types.ObjectId[];
  following: mongoose.Types.ObjectId[];
}

const userSchema = new Schema<IUser>({
  spotifyId: { type: String, required: true, unique: true },
  displayName: { type: String, required: true },
  email: { type: String, required: true },
  accessToken: { type: String, required: true },
  refreshToken: { type: String, required: true },
  profileImage: { type: String },
  username: { type: String, unique: true, sparse: true },
  favAlbums: [{ id: String, name: String, artist: String, image: String }],
  favTracks: [{ id: String, name: String, artist: String, image: String }],
  createdAt: { type: Date, default: Date.now },
  followers: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
  following: [{ type: Schema.Types.ObjectId, ref: 'User', default: [] }],
});

export default mongoose.model<IUser>('User', userSchema);
