import mongoose, { Schema, Document } from 'mongoose';

export interface IChainState extends Document {
  chainId: string;
  lastProcessedNonce: number;
  lastProcessedBlock?: number;
  updatedAt: Date;
}

const ChainStateSchema = new Schema<IChainState>(
  {
    chainId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    lastProcessedNonce: {
      type: Number,
      required: true,
      default: -1, // -1 means no messages processed yet
    },
    lastProcessedBlock: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

export const ChainState = mongoose.model<IChainState>('ChainState', ChainStateSchema);
