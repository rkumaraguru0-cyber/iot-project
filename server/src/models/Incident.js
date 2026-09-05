const mongoose = require('mongoose');

const correlationDetailsSchema = new mongoose.Schema(
  {
    strategyId: { type: String, required: true },
    strategyName: { type: String, required: true },
    matchReason: { type: String, required: true },
    timeWindowMinutes: { type: Number, default: 30 },
    eventCount: { type: Number, default: 1 },
    matchedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const evidenceSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ['security_event', 'telemetry', 'device_state', 'audit_entry']
    },
    entityId: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    },
    addedBy: {
      type: mongoose.Schema.Types.Mixed,
      default: 'system'
    },
    note: {
      type: String,
      default: null
    }
  },
  { _id: false }
);

const incidentTimelineSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },
    action: { type: String, required: true },
    actor: { type: String, required: true, default: 'system' },
    details: { type: String, default: '' }
  },
  { _id: false }
);

const incidentNoteSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },
    author: { type: String, required: true },
    content: { type: String, required: true }
  },
  { _id: false }
);

const responseActionSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: ['quarantine_device', 'revoke_key', 'rollback_firmware', 'escalate', 'other']
    },
    timestamp: { type: Date, default: Date.now },
    performedBy: { type: String, required: true, default: 'system' },
    details: { type: String, default: '' }
  },
  { _id: false }
);

const resolutionSchema = new mongoose.Schema(
  {
    summary: { type: String, default: '' },
    rootCause: { type: String, default: '' },
    preventiveMeasures: { type: String, default: '' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { _id: false }
);

const incidentSchema = new mongoose.Schema(
  {
    incidentId: {
      type: String,
      required: [true, 'Incident ID is required'],
      unique: true,
      uppercase: true,
      trim: true
    },
    title: {
      type: String,
      required: [true, 'Incident title is required'],
      trim: true,
      maxlength: [150, 'Incident title cannot exceed 150 characters']
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    severity: {
      type: String,
      required: [true, 'Incident severity is required'],
      enum: {
        values: ['low', 'medium', 'high', 'critical'],
        message: '{VALUE} is not a valid incident severity'
      }
    },
    status: {
      type: String,
      required: [true, 'Incident status is required'],
      enum: {
        values: [
          'detected',
          'triaged',
          'investigating',
          'containment',
          'resolved',
          'false_positive',
          'closed'
        ],
        message: '{VALUE} is not a valid incident status'
      },
      default: 'detected'
    },
    category: {
      type: String,
      required: [true, 'Incident category is required'],
      trim: true
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required']
    },
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: [true, 'Device reference is required']
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    relatedEventIds: {
      type: [String],
      default: []
    },
    correlationDetails: {
      type: correlationDetailsSchema,
      default: null
    },
    evidence: {
      type: [evidenceSchema],
      default: []
    },
    timeline: {
      type: [incidentTimelineSchema],
      default: []
    },
    notes: {
      type: [incidentNoteSchema],
      default: []
    },
    responseActions: {
      type: [responseActionSchema],
      default: []
    },
    resolution: {
      type: resolutionSchema,
      default: null
    },
    riskScoreAtCreation: {
      type: Number,
      default: 0
    },
    impactAssessment: {
      type: String,
      default: ''
    },
    slaTriageDeadline: {
      type: Date,
      required: [true, 'SLA triage deadline is required']
    },
    slaResolveDeadline: {
      type: Date,
      required: [true, 'SLA resolve deadline is required']
    },
    slaBreached: {
      type: Boolean,
      default: false
    },
    detectedAt: {
      type: Date,
      default: Date.now
    },
    triagedAt: {
      type: Date,
      default: null
    },
    resolvedAt: {
      type: Date,
      default: null
    },
    closedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes
incidentSchema.index({ organizationId: 1, status: 1, severity: 1 });
incidentSchema.index({ deviceId: 1, status: 1 });
incidentSchema.index({ assignedTo: 1, status: 1 });

const Incident = mongoose.model('Incident', incidentSchema);

module.exports = Incident;
