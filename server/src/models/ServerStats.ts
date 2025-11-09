import mongoose from 'mongoose';

export interface IServerStats {
  _id: string; // Always 'singleton' - only one document
  totalPings: number;
  firstStartTime: Date; // Very first time server was started
  lastRestartTime: Date; // Most recent restart
  totalRestarts: number;
  lastPingTime?: Date;
}

const serverStatsSchema = new mongoose.Schema<IServerStats>({
  _id: { type: String, default: 'singleton' }, // Singleton pattern
  totalPings: { type: Number, default: 0 },
  firstStartTime: { type: Date, default: Date.now },
  lastRestartTime: { type: Date, default: Date.now },
  totalRestarts: { type: Number, default: 0 },
  lastPingTime: { type: Date },
}, {
  timestamps: true,
  collection: 'serverstats'
});

const ServerStats = mongoose.model<IServerStats>('ServerStats', serverStatsSchema);

export default ServerStats;
