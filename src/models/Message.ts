import mongoose, { Document, Schema } from 'mongoose';

export interface IMessage extends Document {
    room: mongoose.Types.ObjectId;
    senderType: 'ai' | 'agent' | 'guest' | 'system';
    sender?: mongoose.Types.ObjectId;
    content: string;
    taggedAgents?: mongoose.Types.ObjectId[];
    timestamp: Date;
}

const messageSchema = new Schema<IMessage>({
    room: { type: Schema.Types.ObjectId, ref: 'Room', required: true },
    senderType: { type: String, enum: ['ai', 'agent', 'guest', 'system'], required: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    content: { type: String, required: true },
    taggedAgents: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    timestamp: { type: Date, default: Date.now }
});

export default mongoose.model<IMessage>('Message', messageSchema);