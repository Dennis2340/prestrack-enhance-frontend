import mongoose, { Document, Schema } from 'mongoose';

export interface IAgentManagement extends Document {
    admin: mongoose.Types.ObjectId;
    agents: mongoose.Types.ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}

const agentManagementSchema = new Schema<IAgentManagement>({
    admin: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    agents: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model<IAgentManagement>('AgentManagement', agentManagementSchema);