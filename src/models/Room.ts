import mongoose, { Document, Schema } from 'mongoose';

export interface IRoom extends Document {
    guest: mongoose.Types.ObjectId;
    activeAgents: mongoose.Types.ObjectId[];
    currentOverride?: mongoose.Types.ObjectId;
    status: 'active' | 'closed';
    createdAt: Date;
    updatedAt: Date;
}

const roomSchema = new Schema<IRoom>({
    guest: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    activeAgents: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    currentOverride: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: ['active', 'closed'], default: 'active' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model<IRoom>('Room', roomSchema);