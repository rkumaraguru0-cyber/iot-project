const mongoose = require('mongoose');

const riskFactorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    value: { type: Number, required: true, default: 0 },
    maxValue: { type: Number, required: true },
    detail: { type: String, default: '' },
    contributingIds: [{ type: String }]
  },
  { _id: false }
);

const timelineEntrySchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },
    action: { type: String, required: true },
    actor: { type: String, required: true, default: 'system' },
    details: { type: String, default: '' }
  },
  { _id: false }
);

const tagSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const deviceSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: [true, 'Device ID is required'],
      trim: true,
      uppercase: true
    },
    name: {
      type: String,
      required: [true, 'Device name is required'],
      trim: true,
      maxlength: [100, 'Device name cannot exceed 100 characters']
    },
    type: {
      type: String,
      required: [true, 'Device type is required'],
      enum: {
        values: [
          'temperature_sensor',
          'smart_camera',
          'industrial_gateway',
          'medical_monitor',
          'smart_lock'
        ],
        message: '{VALUE} is not a valid device type'
      }
    },
    manufacturer: {
      type: String,
      required: [true, 'Manufacturer is required'],
      trim: true
    },
    model: {
      type: String,
      required: [true, 'Model is required'],
      trim: true
    },
    location: {
      type: String,
      trim: true,
      default: ''
    },
    tags: [tagSchema],
    status: {
      type: String,
      required: [true, 'Lifecycle status is required'],
      enum: {
        values: ['registered', 'active', 'maintenance', 'quarantined', 'decommissioned'],
        message: '{VALUE} is not a valid device status'
      },
      default: 'registered'
    },
    healthStatus: {
      type: String,
      required: [true, 'Health status is required'],
      enum: {
        values: ['healthy', 'degraded', 'offline', 'unknown'],
        message: '{VALUE} is not a valid health status'
      },
      default: 'unknown'
    },
    apiKeyHash: {
      type: String,
      default: null
    },
    currentFirmwareVersion: {
      type: String,
      trim: true,
      default: null
    },
    riskScore: {
      type: Number,
      required: true,
      min: [0, 'Risk score cannot be less than 0'],
      max: [100, 'Risk score cannot exceed 100'],
      default: 0
    },
    riskSeverity: {
      type: String,
      required: true,
      enum: {
        values: ['low', 'medium', 'high', 'critical', 'severe'],
        message: '{VALUE} is not a valid risk severity'
      },
      default: 'low'
    },
    riskFactors: [riskFactorSchema],
    riskCalculatedAt: {
      type: Date,
      default: null
    },
    lastSeenAt: {
      type: Date,
      default: null
    },
    expectedReportingInterval: {
      type: Number,
      required: [true, 'Expected reporting interval is required'],
      default: 30, // seconds
      min: [1, 'Interval must be at least 1 second']
    },
    timeline: {
      type: [timelineEntrySchema],
      default: []
    },
    malformedMessageCount: {
      type: Number,
      default: 0
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: [true, 'Organization ID is required']
    }
  },
  {
    timestamps: true
  }
);

// Indexes
deviceSchema.index({ organizationId: 1, deviceId: 1 }, { unique: true });
deviceSchema.index({ organizationId: 1, status: 1 });
deviceSchema.index({ organizationId: 1, riskScore: 1 });
deviceSchema.index({ organizationId: 1, type: 1 });

const Device = mongoose.model('Device', deviceSchema);

module.exports = Device;
