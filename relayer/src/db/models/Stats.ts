import mongoose, { Schema, Document } from 'mongoose';

export interface IStats extends Document {
  totalMessages: number;
  successfulRelays: number;
  failedRelays: number;
  perChainCounts: {
    [chainId: string]: {
      sent: number;
      received: number;
      successful: number;
      failed: number;
    };
  };
  lastUpdated: Date;
}

const StatsSchema = new Schema<IStats>(
  {
    totalMessages: {
      type: Number,
      default: 0,
    },
    successfulRelays: {
      type: Number,
      default: 0,
    },
    failedRelays: {
      type: Number,
      default: 0,
    },
    perChainCounts: {
      type: Schema.Types.Mixed,
      default: {},
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Ensure only one stats document exists
StatsSchema.index({ _id: 1 }, { unique: true });

export const Stats = mongoose.model<IStats>('Stats', StatsSchema);
