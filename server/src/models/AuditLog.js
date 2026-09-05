const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      trim: true
    },
    actor: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Audit actor is required']
    },
    actorName: {
      type: String,
      default: null
    },
    actorIp: {
      type: String,
      default: null
    },
    targetType: {
      type: String,
      required: [true, 'Target type is required'],
      trim: true
    },
    targetId: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Target ID is required']
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required']
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false
  }
);

// Indexes
auditLogSchema.index({ organizationId: 1, timestamp: -1 });
auditLogSchema.index({ organizationId: 1, action: 1, timestamp: -1 });
auditLogSchema.index({ actor: 1, timestamp: -1 });
// TTL index: 90 days retention for audit logs
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
