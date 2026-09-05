const mongoose = require('mongoose');

const anomalyRuleSchema = new mongoose.Schema(
  {
    ruleId: {
      type: String,
      required: [true, 'Rule ID is required'],
      unique: true,
      uppercase: true,
      trim: true
    },
    name: {
      type: String,
      required: [true, 'Rule name is required'],
      trim: true,
      maxlength: [100, 'Rule name cannot exceed 100 characters']
    },
    description: {
      type: String,
      required: [true, 'Rule description is required'],
      trim: true
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: [
          'threshold',
          'rate',
          'behavioral',
          'communication',
          'auth',
          'firmware',
          'heartbeat',
          'value'
        ],
        message: '{VALUE} is not a valid rule category'
      }
    },
    enabled: {
      type: Boolean,
      default: true
    },
    deviceTypes: {
      type: [String],
      default: ['*']
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      default: null // null means system-global rule available to all organizations
    },
    metric: {
      type: String,
      default: null
    },
    operator: {
      type: String,
      required: [true, 'Operator is required'],
      enum: {
        values: [
          'gt',
          'lt',
          'gte',
          'lte',
          'eq',
          'neq',
          'absent',
          'rate_exceeds',
          'outside_schedule',
          'not_in_list'
        ],
        message: '{VALUE} is not a valid comparison operator'
      }
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, 'Threshold value is required']
    },
    window: {
      type: {
        type: String,
        enum: ['consecutive', 'sliding', 'none'],
        default: 'none'
      },
      size: { type: Number, default: 1 },
      minOccurrences: { type: Number, default: 1 }
    },
    cooldownSeconds: {
      type: Number,
      required: [true, 'Cooldown in seconds is required'],
      default: 300,
      min: [0, 'Cooldown cannot be negative']
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
    explanationTemplate: {
      type: String,
      required: [true, 'Explanation template is required']
    },
    isSystem: {
      type: Boolean,
      default: false
    },
    deleted: {
      type: Boolean,
      default: false
    },
    lastTriggeredAt: {
      type: Date,
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: 'system'
    }
  },
  {
    timestamps: true
  }
);

// Indexes
anomalyRuleSchema.index({ organizationId: 1, enabled: 1, category: 1 });

const AnomalyRule = mongoose.model('AnomalyRule', anomalyRuleSchema);

module.exports = AnomalyRule;
