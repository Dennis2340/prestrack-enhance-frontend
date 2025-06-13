import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
    name: string;
    email?: string;
    agentId?: string;
    role: 'guest' | 'agent' | 'admin';
    createdAt: Date;
    updatedAt: Date;
}

const userSchema = new Schema<IUser>({
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true },
    agentId: { type: String, unique: true, sparse: true },
    role: { type: String, enum: ['guest', 'agent', 'admin'], required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});



export default mongoose.model<IUser>('User', userSchema);