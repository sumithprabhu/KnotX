import mongoose, { Schema, Document } from 'mongoose';

export interface IRelayerMetrics extends Document {
  totalMessagesProcessed: number;
  totalMessagesDelivered: number;
  totalMessagesFailed: number;
  messagesBySourceChain: Record<string, number>;
  messagesByDestinationChain: Record<string, number>;
  lastUpdated: Date;
}

const RelayerMetricsSchema = new Schema<IRelayerMetrics>(
  {
    totalMessagesProcessed: {
      type: Number,
      default: 0,
    },
    totalMessagesDelivered: {
      type: Number,
      default: 0,
    },
    totalMessagesFailed: {
      type: Number,
      default: 0,
    },
    messagesBySourceChain: {
      type: Schema.Types.Mixed,
      default: {},
    },
    messagesByDestinationChain: {
      type: Schema.Types.Mixed,
      default: {},
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one metrics document exists
RelayerMetricsSchema.index({ _id: 1 }, { unique: true });

export const RelayerMetrics = mongoose.model<IRelayerMetrics>('RelayerMetrics', RelayerMetricsSchema);
