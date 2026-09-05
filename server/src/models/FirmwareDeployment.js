const mongoose = require('mongoose');

const firmwareDeploymentSchema = new mongoose.Schema(
  {
    deploymentId: {
      type: String,
      required: [true, 'Deployment ID is required'],
      unique: true,
      uppercase: true,
      trim: true
    },
    firmwareVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FirmwareVersion',
      required: [true, 'Firmware version reference is required']
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
    status: {
      type: String,
      required: [true, 'Deployment status is required'],
      enum: {
        values: [
          'pending',
          'downloading',
          'installing',
          'verifying',
          'success',
          'failed',
          'rolled_back'
        ],
        message: '{VALUE} is not a valid deployment status'
      },
      default: 'pending'
    },
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Initiator user reference is required']
    },
    initiatedAt: {
      type: Date,
      default: Date.now
    },
    completedAt: {
      type: Date,
      default: null
    },
    previousFirmwareVersion: {
      type: String,
      default: null
    },
    result: {
      success: { type: Boolean, default: null },
      message: { type: String, default: null },
      verificationChecksum: { type: String, default: null }
    }
  },
  {
    timestamps: true
  }
);

// Indexes
firmwareDeploymentSchema.index({ deviceId: 1, status: 1 });
firmwareDeploymentSchema.index({ organizationId: 1, status: 1, initiatedAt: -1 });

const FirmwareDeployment = mongoose.model('FirmwareDeployment', firmwareDeploymentSchema);

module.exports = FirmwareDeployment;
