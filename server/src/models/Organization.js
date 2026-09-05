const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
      minlength: [2, 'Organization name must be at least 2 characters'],
      maxlength: [100, 'Organization name cannot exceed 100 characters']
    },
    slug: {
      type: String,
      required: [true, 'Organization slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Slug may only contain lowercase alphanumeric characters and hyphens']
    },
    settings: {
      slaThresholds: {
        critical: {
          triage: { type: Number, default: 15 }, // minutes
          resolve: { type: Number, default: 240 } // 4 hours
        },
        high: {
          triage: { type: Number, default: 60 }, // 1 hour
          resolve: { type: Number, default: 1440 } // 24 hours
        },
        medium: {
          triage: { type: Number, default: 240 }, // 4 hours
          resolve: { type: Number, default: 4320 } // 72 hours
        },
        low: {
          triage: { type: Number, default: 1440 }, // 24 hours
          resolve: { type: Number, default: 10080 } // 7 days
        }
      },
      autoQuarantine: {
        enabled: { type: Boolean, default: false },
        threshold: { type: Number, default: 80, min: 1, max: 100 }
      },
      alertPreferences: {
        minSeverity: {
          type: String,
          enum: ['low', 'medium', 'high', 'critical'],
          default: 'medium'
        }
      }
    }
  },
  {
    timestamps: true
  }
);

const Organization = mongoose.model('Organization', organizationSchema);

module.exports = Organization;
