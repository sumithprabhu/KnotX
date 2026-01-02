import mongoose, { Schema, Document } from 'mongoose';
import { MessageStatus } from '../../types/message';

export interface IMessage extends Document {
  messageId: string;
  nonce: number;
  sourceChain: string;
  destinationChain: string;
  sourceGateway: string;
  destinationGateway: string;
  payload: string;
  payloadHash: string;
  status: MessageStatus;
  transactionHash?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  deliveredAt?: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    messageId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    nonce: {
      type: Number,
      required: true,
    },
    sourceChain: {
      type: String,
      required: true,
      index: true,
    },
    destinationChain: {
      type: String,
      required: true,
      index: true,
    },
    sourceGateway: {
      type: String,
      required: true,
    },
    destinationGateway: {
      type: String,
      required: true,
    },
    payload: {
      type: String,
      required: true,
    },
    payloadHash: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(MessageStatus),
      default: MessageStatus.PENDING,
      index: true,
    },
    transactionHash: {
      type: String,
      sparse: true,
    },
    error: {
      type: String,
    },
    deliveredAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
MessageSchema.index({ sourceChain: 1, status: 1 });
MessageSchema.index({ destinationChain: 1, status: 1 });
MessageSchema.index({ createdAt: -1 });

export const Message = mongoose.model<IMessage>('Message', MessageSchema);
