const mongoose = require('mongoose');

const anomalySchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required'],
      index: true
    },
    deviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: [true, 'Device reference is required'],
      index: true
    },
    rawTelemetryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Telemetry',
      required: [true, 'Raw telemetry reference is required for forensic traceability']
    },
    ruleId: {
      type: String,
      required: [true, 'Rule ID is required'],
      uppercase: true,
      trim: true,
      index: true
    },
    ruleName: {
      type: String,
      required: [true, 'Rule name is required'],
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true
    },
    metric: {
      type: String,
      required: [true, 'Metric name is required'],
      trim: true
    },
    observedValue: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Observed metric value is required']
    },
    thresholdValue: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Threshold comparison value is required']
    },
    severity: {
      type: String,
      required: [true, 'Severity level is required'],
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
    explanation: {
      type: String,
      required: [true, 'Explanation string is required'],
      trim: true
    },
    timestamp: {
      type: Date,
      required: [true, 'Telemetry timestamp is required']
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false } // Immutable detection records
  }
);

// Compound indexes for tenant-scoped forensic querying
anomalySchema.index({ organizationId: 1, createdAt: -1 });
anomalySchema.index({ deviceId: 1, createdAt: -1 });
anomalySchema.index({ organizationId: 1, ruleId: 1, createdAt: -1 });

const Anomaly = mongoose.model('Anomaly', anomalySchema);

module.exports = Anomaly;
