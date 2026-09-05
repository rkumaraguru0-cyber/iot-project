const mongoose = require('mongoose');

const vulnerabilitySchema = new mongoose.Schema(
  {
    cveId: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    severity: {
      type: String,
      required: true,
      enum: ['low', 'medium', 'high', 'critical']
    },
    description: {
      type: String,
      default: ''
    },
    cvssScore: {
      type: Number,
      min: 0,
      max: 10
    },
    reportedAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const firmwareVersionSchema = new mongoose.Schema(
  {
    version: {
      type: String,
      required: [true, 'Firmware version is required'],
      trim: true
    },
    deviceType: {
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
    checksum: {
      type: String,
      required: [true, 'Firmware binary SHA-256 checksum is required'],
      trim: true
    },
    fileSize: {
      type: Number,
      min: [0, 'File size cannot be negative']
    },
    releaseDate: {
      type: Date,
      required: [true, 'Release date is required']
    },
    changelog: {
      type: String,
      default: ''
    },
    securityStatus: {
      type: String,
      required: true,
      enum: {
        values: ['secure', 'under_review', 'vulnerable', 'recalled'],
        message: '{VALUE} is not a valid security status'
      },
      default: 'under_review'
    },
    vulnerabilities: {
      type: [vulnerabilitySchema],
      default: []
    },
    deploymentPolicy: {
      type: String,
      required: true,
      enum: {
        values: ['allowed', 'blocked', 'restricted'],
        message: '{VALUE} is not a valid deployment policy'
      },
      default: 'restricted'
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader user ID is required']
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
firmwareVersionSchema.index({ organizationId: 1, deviceType: 1, version: 1 }, { unique: true });
firmwareVersionSchema.index({ organizationId: 1, securityStatus: 1 });

const FirmwareVersion = mongoose.model('FirmwareVersion', firmwareVersionSchema);

module.exports = FirmwareVersion;
