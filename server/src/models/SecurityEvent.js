const mongoose = require('mongoose');

const securityEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: [true, 'Event ID is required'],
      unique: true,
      uppercase: true,
      trim: true
    },
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: [true, 'Device reference is required']
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required']
    },
    ruleId: {
      type: String,
      required: [true, 'Rule ID reference is required'],
      trim: true
    },
    rawTelemetryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Telemetry',
      required: [true, 'Raw telemetry reference is required for forensic traceability']
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true
    },
    severity: {
      type: String,
      required: [true, 'Severity is required'],
      enum: {
        values: ['low', 'medium', 'high', 'critical'],
        message: '{VALUE} is not a valid severity level'
      }
    },
    confidence: {
      type: String,
      required: [true, 'Confidence level is required'],
      enum: {
        values: ['low', 'medium', 'high'],
        message: '{VALUE} is not a valid confidence level'
      }
    },
    status: {
      type: String,
      required: [true, 'Event status is required'],
      enum: {
        values: ['open', 'acknowledged', 'resolved', 'false_positive'],
        message: '{VALUE} is not a valid event status'
      },
      default: 'open'
    },
    explanation: {
      type: String,
      required: [true, 'Event explanation is required']
    },
    occurrenceCount: {
      type: Number,
      default: 1,
      min: [1, 'Occurrence count must be at least 1']
    },
    firstOccurrence: {
      type: Date,
      required: true,
      default: Date.now
    },
    lastOccurrence: {
      type: Date,
      required: true,
      default: Date.now
    },
    resolvedAt: {
      type: Date,
      default: null
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    incidentId: {
      type: String,
      default: null,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Indexes
securityEventSchema.index({ organizationId: 1, status: 1, severity: 1 });
securityEventSchema.index({ deviceId: 1, createdAt: -1 });
securityEventSchema.index({ organizationId: 1, category: 1, createdAt: -1 });

const SecurityEvent = mongoose.model('SecurityEvent', securityEventSchema);

module.exports = SecurityEvent;
