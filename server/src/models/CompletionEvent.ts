import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICompletionEvent extends Document {
  userId: string;
  albumId?: string;
  albumKey: string;
  albumName?: string;
  artistName?: string;
  albumArt?: string;
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CompletionEventSchema = new Schema<ICompletionEvent>(
  {
    userId: { type: String, required: true, index: true },
    albumId: { type: String },
    albumKey: { type: String, required: true },
    albumName: { type: String },
    artistName: { type: String },
    albumArt: { type: String },
    completedAt: { type: Date, required: true, index: true },
  },
  { timestamps: true }
);

CompletionEventSchema.index({ userId: 1, completedAt: -1 });

const CompletionEvent: Model<ICompletionEvent> =
  mongoose.models.CompletionEvent || mongoose.model<ICompletionEvent>('CompletionEvent', CompletionEventSchema);

export default CompletionEvent;
