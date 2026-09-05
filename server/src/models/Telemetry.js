const mongoose = require('mongoose');

const telemetrySchema = new mongoose.Schema(
  {
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
    timestamp: {
      type: Date,
      required: [true, 'Telemetry timestamp is required']
    },
    metrics: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Metrics payload is required'],
      validate: {
        validator: function (v) {
          return v && typeof v === 'object' && Object.keys(v).length > 0;
        },
        message: 'Metrics must be a non-empty key-value object'
      }
    },
    metadata: {
      ip: { type: String, default: null },
      firmware_version: { type: String, default: null },
      uptime: { type: Number, default: null }
    },
    receivedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false
  }
);

// Indexes
telemetrySchema.index({ deviceId: 1, timestamp: -1 });
telemetrySchema.index({ organizationId: 1, timestamp: -1 });
// TTL Index: automatically remove telemetry documents after 30 days
telemetrySchema.index({ receivedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

const Telemetry = mongoose.model('Telemetry', telemetrySchema);

module.exports = Telemetry;
