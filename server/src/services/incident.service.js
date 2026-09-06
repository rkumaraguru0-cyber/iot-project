const crypto = require('crypto');
const mongoose = require('mongoose');
const { Incident, Device, User, SecurityEvent, Organization } = require('../models');
const { logAuditEvent } = require('./audit.service');
const { ROLE_HIERARCHY } = require('../middleware/rbac');
const emitter = require('../socket/emitter');
const notificationService = require('./notification.service');
const logger = require('../utils/logger');

const DEFAULT_SLA_THRESHOLDS = {
  critical: { triage: 15, resolve: 240 },       // 15 min / 4 hours (240 min)
  high: { triage: 60, resolve: 1440 },          // 1 hour (60 min) / 24 hours (1440 min)
  medium: { triage: 240, resolve: 4320 },       // 4 hours (240 min) / 72 hours (4320 min)
  low: { triage: 1440, resolve: 10080 }         // 24 hours (1440 min) / 7 days (10080 min)
};

const VALID_TRANSITIONS = {
  detected: ['triaged'],
  triaged: ['investigating'],
  investigating: ['containment', 'false_positive'],
  containment: ['resolved', 'investigating'],
  resolved: ['closed'],
  false_positive: ['closed'],
  closed: []
};

class IncidentService {
  /**
   * Generates a unique, human-readable Incident ID: INC-YYYYMMDD-HEX4
   * @returns {string}
   */
  generateIncidentId() {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `INC-${dateStr}-${randomHex}`;
  }

  /**
   * Calculates SLA deadlines (triage & resolution) for an incident.
   * 
   * @param {string} severity
   * @param {Date} detectedAt
   * @param {Object} [orgSettings]
   * @returns {{ slaTriageDeadline: Date, slaResolveDeadline: Date }}
   */
  calculateSlaDeadlines(severity, detectedAt = new Date(), orgSettings = {}) {
    const defaultThresholds = DEFAULT_SLA_THRESHOLDS[severity] || DEFAULT_SLA_THRESHOLDS.medium;
    const customThresholds = orgSettings?.slaThresholds?.[severity];

    const triageMinutes = customThresholds?.triage ?? defaultThresholds.triage;
    const resolveMinutes = customThresholds?.resolve ?? defaultThresholds.resolve;

    const triageMs = triageMinutes * 60 * 1000;
    const resolveMs = resolveMinutes * 60 * 1000;

    const baseTime = detectedAt instanceof Date ? detectedAt.getTime() : new Date(detectedAt).getTime();

    return {
      slaTriageDeadline: new Date(baseTime + triageMs),
      slaResolveDeadline: new Date(baseTime + resolveMs)
    };
  }

  /**
   * Creates a new Incident document from correlated security events or standalone high-severity triggers.
   * 
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async createIncident({
    organizationId,
    deviceId,
    title,
    description = '',
    severity,
    category = 'security',
    relatedEventIds = [],
    correlationDetails = null,
    initialEvidence = [],
    riskScoreAtCreation = 0,
    impactAssessment = '',
    actorUser = null
  }) {
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);
    const devObjectId = new mongoose.Types.ObjectId(deviceId);

    // Fetch org settings for custom SLA thresholds if available
    const org = await Organization.findById(orgObjectId).select('settings').lean();
    const detectedAt = new Date();
    const { slaTriageDeadline, slaResolveDeadline } = this.calculateSlaDeadlines(severity, detectedAt, org?.settings);

    const incidentId = this.generateIncidentId();

    const initialTimeline = [
      {
        timestamp: detectedAt,
        action: 'incident_created',
        actor: actorUser ? (actorUser.displayName || actorUser.email) : 'system',
        details: correlationDetails
          ? `Incident automatically generated via ${correlationDetails.strategyName} (${correlationDetails.strategyId})`
          : `Standalone ${severity} severity security incident generated`
      }
    ];

    const incident = await Incident.create({
      incidentId,
      title,
      description,
      severity,
      status: 'detected',
      category,
      organizationId: orgObjectId,
      deviceId: devObjectId,
      relatedEventIds,
      correlationDetails,
      evidence: initialEvidence,
      timeline: initialTimeline,
      notes: [],
      responseActions: [],
      resolution: null,
      riskScoreAtCreation,
      impactAssessment,
      slaTriageDeadline,
      slaResolveDeadline,
      slaBreached: false,
      detectedAt
    });

    // Atomically back-link all matched SecurityEvent documents with incidentId
    if (relatedEventIds && relatedEventIds.length > 0) {
      await SecurityEvent.updateMany(
        {
          organizationId: orgObjectId,
          eventId: { $in: relatedEventIds }
        },
        { $set: { incidentId: incident.incidentId } }
      ).catch((err) => {
        logger.error(`[Incident Service] Failed to back-link SecurityEvents to incident ${incident.incidentId}: ${err.message}`);
      });
    }

    // Log forensic audit event
    await logAuditEvent({
      action: 'incident.created',
      actor: actorUser ? actorUser._id : 'system',
      actorName: actorUser ? (actorUser.displayName || actorUser.email) : 'System Intelligence Engine',
      targetType: 'incident',
      targetId: incident._id,
      organizationId: orgObjectId,
      details: {
        incidentId: incident.incidentId,
        severity: incident.severity,
        strategy: correlationDetails?.strategyId || 'STANDALONE',
        eventCount: relatedEventIds.length
      }
    });

    // Real-time integration (Phase 11): Emit new incident event & dispatch notifications
    emitter.emitIncidentNew(orgObjectId.toString(), {
      incidentId: incident.incidentId,
      title: incident.title,
      severity: incident.severity,
      deviceId: devObjectId
    });

    notificationService.notifyIncidentCreated(orgObjectId.toString(), incident).catch((err) => {
      logger.error(`[Notification Service] Async incident creation notification failed: ${err.message}`);
    });

    logger.info(`[Incident Engine] Created new Incident ${incident.incidentId} [Severity: ${incident.severity}] for device ${deviceId}`);
    return incident.toObject();
  }

  /**
   * Lists incidents for an organization with filtering, pagination, and sorting.
   * 
   * @param {string} organizationId
   * @param {Object} queryParams
   * @returns {Promise<{ incidents: Array, total: number, page: number, limit: number, totalPages: number }>}
   */
  async listIncidents(organizationId, queryParams = {}) {
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);
    const filter = { organizationId: orgObjectId };

    if (queryParams.status) {
      filter.status = queryParams.status;
    }

    if (queryParams.severity) {
      filter.severity = queryParams.severity;
    }

    if (queryParams.assignedTo) {
      if (queryParams.assignedTo === 'unassigned') {
        filter.assignedTo = null;
      } else if (mongoose.Types.ObjectId.isValid(queryParams.assignedTo)) {
        filter.assignedTo = new mongoose.Types.ObjectId(queryParams.assignedTo);
      }
    }

    if (queryParams.deviceId) {
      if (mongoose.Types.ObjectId.isValid(queryParams.deviceId)) {
        filter.deviceId = new mongoose.Types.ObjectId(queryParams.deviceId);
      }
    }

    if (queryParams.slaBreached !== undefined) {
      filter.slaBreached = queryParams.slaBreached === 'true' || queryParams.slaBreached === true;
    }

    if (queryParams.from || queryParams.to) {
      filter.detectedAt = {};
      if (queryParams.from) filter.detectedAt.$gte = new Date(queryParams.from);
      if (queryParams.to) filter.detectedAt.$lte = new Date(queryParams.to);
    }

    if (queryParams.search) {
      const escaped = queryParams.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { incidentId: { $regex: escaped, $options: 'i' } },
        { title: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } }
      ];
    }

    const page = Math.max(1, parseInt(queryParams.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const sortField = queryParams.sortBy || 'detectedAt';
    const sortOrder = queryParams.sortOrder === 'asc' ? 1 : -1;

    const [incidents, total] = await Promise.all([
      Incident.find(filter)
        .populate('deviceId', 'deviceId name type status healthStatus riskScore location')
        .populate('assignedTo', 'displayName email role')
        .populate('resolution.resolvedBy', 'displayName email')
        .populate('resolution.verifiedBy', 'displayName email')
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean(),
      Incident.countDocuments(filter)
    ]);

    return {
      incidents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Retrieves full incident details by Mongo ID or human-readable incidentId.
   * 
   * @param {string} idOrIncidentId
   * @param {string} organizationId
   * @returns {Promise<Object>}
   */
  async getIncidentById(idOrIncidentId, organizationId) {
    const isObjectId = mongoose.Types.ObjectId.isValid(idOrIncidentId);
    const filter = {
      organizationId: new mongoose.Types.ObjectId(organizationId)
    };

    if (isObjectId) {
      filter._id = new mongoose.Types.ObjectId(idOrIncidentId);
    } else {
      filter.incidentId = idOrIncidentId.toUpperCase();
    }

    const incident = await Incident.findOne(filter)
      .populate('deviceId', 'deviceId name type status healthStatus riskScore riskSeverity location lastSeenAt')
      .populate('assignedTo', 'displayName email role')
      .populate('resolution.resolvedBy', 'displayName email')
      .populate('resolution.verifiedBy', 'displayName email')
      .lean();

    if (!incident) {
      const err = new Error('Incident not found');
      err.code = 'INCIDENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    // Populate full security events linked to this incident
    let relatedEvents = [];
    if (incident.relatedEventIds && incident.relatedEventIds.length > 0) {
      relatedEvents = await SecurityEvent.find({
        organizationId: incident.organizationId,
        eventId: { $in: incident.relatedEventIds }
      })
        .populate('rawTelemetryId')
        .sort({ lastOccurrence: -1 })
        .lean();
    }

    return {
      ...incident,
      relatedEvents
    };
  }

  /**
   * Transitions incident lifecycle state according to the approved 7-state state machine.
   * 
   * @param {string} idOrIncidentId
   * @param {string} organizationId
   * @param {string} newStatus
   * @param {string} [note]
   * @param {Object} actorUser
   * @returns {Promise<Object>}
   */
  async updateIncidentStatus(idOrIncidentId, organizationId, newStatus, note, actorUser) {
    const isObjectId = mongoose.Types.ObjectId.isValid(idOrIncidentId);
    const filter = {
      organizationId: new mongoose.Types.ObjectId(organizationId)
    };

    if (isObjectId) {
      filter._id = new mongoose.Types.ObjectId(idOrIncidentId);
    } else {
      filter.incidentId = idOrIncidentId.toUpperCase();
    }

    const incident = await Incident.findOne(filter);
    if (!incident) {
      const err = new Error('Incident not found');
      err.code = 'INCIDENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const currentStatus = incident.status;
    const actorRole = actorUser?.role || 'viewer';
    const actorLevel = ROLE_HIERARCHY[actorRole] || 0;

    // Viewers cannot perform state transitions
    if (actorLevel < ROLE_HIERARCHY.operator) {
      const err = new Error('Viewers are not authorized to transition incident lifecycle states');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    // Closing an incident requires security_analyst or higher
    if (newStatus === 'closed' && actorLevel < ROLE_HIERARCHY.security_analyst) {
      const err = new Error('Closing an incident requires security_analyst or org_admin privileges');
      err.code = 'FORBIDDEN';
      err.statusCode = 403;
      throw err;
    }

    // Validate state machine transitions
    const allowedTargets = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowedTargets.includes(newStatus)) {
      const err = new Error(`Invalid lifecycle transition from '${currentStatus}' to '${newStatus}'`);
      err.code = 'INVALID_STATE_TRANSITION';
      err.statusCode = 400;
      throw err;
    }

    const now = new Date();
    incident.status = newStatus;

    // Track timestamps & evaluate exact PRD SLA breaches upon transition
    if (newStatus === 'triaged' && !incident.triagedAt) {
      incident.triagedAt = now;
      if (incident.slaTriageDeadline && now > incident.slaTriageDeadline) {
        incident.slaBreached = true;
      }
    }

    if ((newStatus === 'resolved' || newStatus === 'false_positive') && !incident.resolvedAt) {
      incident.resolvedAt = now;
      if (incident.slaResolveDeadline && now > incident.slaResolveDeadline) {
        incident.slaBreached = true;
      }
    }

    if (newStatus === 'closed') {
      incident.closedAt = now;
      if (incident.resolution) {
        incident.resolution.verifiedBy = actorUser?._id || null;
      }
    }

    // Append timeline entry
    const actorName = actorUser ? (actorUser.displayName || actorUser.email) : 'operator';
    incident.timeline.push({
      timestamp: now,
      action: 'status_transition',
      actor: actorName,
      details: `Status transitioned from '${currentStatus}' to '${newStatus}'${note ? ': ' + note.trim() : ''}`
    });

    await incident.save();

    // Forensic audit log
    await logAuditEvent({
      action: 'incident.status_transition',
      actor: actorUser ? actorUser._id : 'system',
      actorName,
      targetType: 'incident',
      targetId: incident._id,
      organizationId: incident.organizationId,
      details: {
        incidentId: incident.incidentId,
        from: currentStatus,
        to: newStatus,
        note: note || null,
        slaBreached: incident.slaBreached
      }
    });

    // Real-time integration (Phase 11): Emit updated incident event & dispatch notifications on actual status change
    if (currentStatus !== newStatus) {
      emitter.emitIncidentUpdated(incident.organizationId.toString(), incident.incidentId, {
        status: incident.status,
        severity: incident.severity
      });

      notificationService.notifyIncidentUpdated(incident.organizationId.toString(), incident).catch((err) => {
        logger.error(`[Notification Service] Async incident status update notification failed: ${err.message}`);
      });
    }

    logger.info(`[Incident Lifecycle] Incident ${incident.incidentId} transitioned from '${currentStatus}' to '${newStatus}' by ${actorName}`);
    return incident.toObject();
  }

  /**
   * Assigns an incident to an organization user (or unassigns if null).
   * 
   * @param {string} idOrIncidentId
   * @param {string} organizationId
   * @param {string|null} assignedToUserId
   * @param {Object} actorUser
   * @returns {Promise<Object>}
   */
  async assignIncident(idOrIncidentId, organizationId, assignedToUserId, actorUser) {
    const isObjectId = mongoose.Types.ObjectId.isValid(idOrIncidentId);
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);
    const filter = { organizationId: orgObjectId };

    if (isObjectId) {
      filter._id = new mongoose.Types.ObjectId(idOrIncidentId);
    } else {
      filter.incidentId = idOrIncidentId.toUpperCase();
    }

    const incident = await Incident.findOne(filter);
    if (!incident) {
      const err = new Error('Incident not found');
      err.code = 'INCIDENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    let assignee = null;
    if (assignedToUserId) {
      if (!mongoose.Types.ObjectId.isValid(assignedToUserId)) {
        const err = new Error('Invalid assigned user ID');
        err.code = 'INVALID_USER_ID';
        err.statusCode = 400;
        throw err;
      }

      assignee = await User.findOne({
        _id: new mongoose.Types.ObjectId(assignedToUserId),
        organizationId: orgObjectId
      }).select('displayName email');

      if (!assignee) {
        const err = new Error('Assigned user not found within organization');
        err.code = 'USER_NOT_FOUND';
        err.statusCode = 404;
        throw err;
      }
    }

    incident.assignedTo = assignee ? assignee._id : null;
    const actorName = actorUser ? (actorUser.displayName || actorUser.email) : 'operator';

    incident.timeline.push({
      timestamp: new Date(),
      action: 'assignment_updated',
      actor: actorName,
      details: assignee
        ? `Assigned to ${assignee.displayName || assignee.email}`
        : 'Unassigned incident'
    });

    await incident.save();

    await logAuditEvent({
      action: 'incident.assigned',
      actor: actorUser ? actorUser._id : 'system',
      actorName,
      targetType: 'incident',
      targetId: incident._id,
      organizationId: orgObjectId,
      details: {
        incidentId: incident.incidentId,
        assignedTo: assignee ? assignee._id : null,
        assignedName: assignee ? (assignee.displayName || assignee.email) : 'Unassigned'
      }
    });

    return incident.toObject();
  }

  /**
   * Appends an investigation note to an incident.
   * 
   * @param {string} idOrIncidentId
   * @param {string} organizationId
   * @param {string} content
   * @param {Object} actorUser
   * @returns {Promise<Object>}
   */
  async addNote(idOrIncidentId, organizationId, content, actorUser) {
    const isObjectId = mongoose.Types.ObjectId.isValid(idOrIncidentId);
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);
    const filter = { organizationId: orgObjectId };

    if (isObjectId) {
      filter._id = new mongoose.Types.ObjectId(idOrIncidentId);
    } else {
      filter.incidentId = idOrIncidentId.toUpperCase();
    }

    const incident = await Incident.findOne(filter);
    if (!incident) {
      const err = new Error('Incident not found');
      err.code = 'INCIDENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const author = actorUser ? (actorUser.displayName || actorUser.email) : 'Analyst';
    const noteEntry = {
      timestamp: new Date(),
      author,
      content: content.trim()
    };

    incident.notes.push(noteEntry);

    incident.timeline.push({
      timestamp: new Date(),
      action: 'note_added',
      actor: author,
      details: `Note added by ${author}`
    });

    await incident.save();

    await logAuditEvent({
      action: 'incident.note_added',
      actor: actorUser ? actorUser._id : 'system',
      actorName: author,
      targetType: 'incident',
      targetId: incident._id,
      organizationId: orgObjectId,
      details: {
        incidentId: incident.incidentId,
        noteLength: content.length
      }
    });

    return incident.toObject();
  }

  /**
   * Records a response action and executes approved Phase 4 operations where authorized.
   * 
   * @param {string} idOrIncidentId
   * @param {string} organizationId
   * @param {string} action
   * @param {string} details
   * @param {Object} actorUser
   * @returns {Promise<Object>}
   */
  async recordResponseAction(idOrIncidentId, organizationId, action, details, actorUser) {
    const isObjectId = mongoose.Types.ObjectId.isValid(idOrIncidentId);
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);
    const filter = { organizationId: orgObjectId };

    if (isObjectId) {
      filter._id = new mongoose.Types.ObjectId(idOrIncidentId);
    } else {
      filter.incidentId = idOrIncidentId.toUpperCase();
    }

    const incident = await Incident.findOne(filter);
    if (!incident) {
      const err = new Error('Incident not found');
      err.code = 'INCIDENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const actorName = actorUser ? (actorUser.displayName || actorUser.email) : 'operator';
    const actorRole = actorUser?.role || 'viewer';
    const actorLevel = ROLE_HIERARCHY[actorRole] || 0;

    const prevSeverity = incident.severity;
    let executionResultNote = '';

    // Execute Phase 4 capabilities when explicitly chosen
    if (action === 'quarantine_device') {
      if (actorLevel >= ROLE_HIERARCHY.operator) {
        await Device.updateOne(
          { _id: incident.deviceId, organizationId: orgObjectId },
          { $set: { status: 'quarantined' } }
        );
        executionResultNote = ' [Device status transitioned to quarantined]';

        emitter.emitDeviceStatusChanged(orgObjectId.toString(), {
          deviceId: incident.deviceId,
          status: 'quarantined',
          previousStatus: 'active'
        });
        notificationService.notifyDeviceQuarantined(orgObjectId.toString(), {
          _id: incident.deviceId,
          deviceId: incident.deviceId
        }).catch((err) => {
          logger.error(`[Notification Service] Async device quarantined notification failed: ${err.message}`);
        });
      }
    } else if (action === 'revoke_key') {
      if (actorLevel >= ROLE_HIERARCHY.security_analyst) {
        await Device.updateOne(
          { _id: incident.deviceId, organizationId: orgObjectId },
          { $set: { apiKeyHash: null } }
        );
        executionResultNote = ' [Device API key invalidated and revoked]';
      } else {
        const err = new Error('Revoking device API key requires security_analyst privileges');
        err.code = 'FORBIDDEN';
        err.statusCode = 403;
        throw err;
      }
    } else if (action === 'rollback_firmware') {
      if (actorLevel >= ROLE_HIERARCHY.security_analyst) {
        const firmwareService = require('./firmware.service');
        const rollbackOutcome = await firmwareService.rollbackFailedDeploymentForDevice(
          incident.deviceId,
          orgObjectId,
          actorUser
        );
        executionResultNote = ` [${rollbackOutcome}]`;
      } else {
        const err = new Error('Rolling back firmware requires security_analyst privileges');
        err.code = 'FORBIDDEN';
        err.statusCode = 403;
        throw err;
      }
    } else if (action === 'escalate') {
      if (incident.severity === 'low') incident.severity = 'medium';
      else if (incident.severity === 'medium') incident.severity = 'high';
      else if (incident.severity === 'high') incident.severity = 'critical';
      executionResultNote = ` [Incident severity escalated to ${incident.severity}]`;
    }

    const fullDetails = (details ? details.trim() : '') + executionResultNote;

    incident.responseActions.push({
      action,
      timestamp: new Date(),
      performedBy: actorName,
      details: fullDetails.trim()
    });

    incident.timeline.push({
      timestamp: new Date(),
      action: 'response_action_recorded',
      actor: actorName,
      details: `Action '${action}' recorded: ${fullDetails.trim()}`
    });

    await incident.save();

    // Real-time integration (Phase 11): Emit updated incident event & notify on severity escalation
    if (action === 'escalate' && prevSeverity !== incident.severity) {
      emitter.emitIncidentUpdated(incident.organizationId.toString(), incident.incidentId, {
        status: incident.status,
        severity: incident.severity
      });

      notificationService.notifyIncidentUpdated(incident.organizationId.toString(), incident).catch((err) => {
        logger.error(`[Notification Service] Async incident severity escalation notification failed: ${err.message}`);
      });
    }

    await logAuditEvent({
      action: 'incident.action_recorded',
      actor: actorUser ? actorUser._id : 'system',
      actorName,
      targetType: 'incident',
      targetId: incident._id,
      organizationId: orgObjectId,
      details: {
        incidentId: incident.incidentId,
        action,
        details: fullDetails.trim()
      }
    });

    return incident.toObject();
  }

  /**
   * Attaches supporting forensic evidence item to an incident.
   * 
   * @param {string} idOrIncidentId
   * @param {string} organizationId
   * @param {Object} evidenceItem
   * @param {Object} actorUser
   * @returns {Promise<Object>}
   */
  async addEvidence(idOrIncidentId, organizationId, evidenceItem, actorUser) {
    const isObjectId = mongoose.Types.ObjectId.isValid(idOrIncidentId);
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);
    const filter = { organizationId: orgObjectId };

    if (isObjectId) {
      filter._id = new mongoose.Types.ObjectId(idOrIncidentId);
    } else {
      filter.incidentId = idOrIncidentId.toUpperCase();
    }

    const incident = await Incident.findOne(filter);
    if (!incident) {
      const err = new Error('Incident not found');
      err.code = 'INCIDENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const actorName = actorUser ? (actorUser.displayName || actorUser.email) : 'operator';
    const entry = {
      type: evidenceItem.type,
      entityId: evidenceItem.entityId,
      addedAt: new Date(),
      addedBy: actorUser?._id || 'system',
      note: evidenceItem.note ? evidenceItem.note.trim() : null
    };

    incident.evidence.push(entry);

    incident.timeline.push({
      timestamp: new Date(),
      action: 'evidence_attached',
      actor: actorName,
      details: `Evidence of type '${evidenceItem.type}' linked`
    });

    await incident.save();

    await logAuditEvent({
      action: 'incident.evidence_added',
      actor: actorUser ? actorUser._id : 'system',
      actorName,
      targetType: 'incident',
      targetId: incident._id,
      organizationId: orgObjectId,
      details: {
        incidentId: incident.incidentId,
        evidenceType: evidenceItem.type
      }
    });

    return incident.toObject();
  }

  /**
   * Submits resolution documentation and transitions incident to resolved state.
   * 
   * @param {string} idOrIncidentId
   * @param {string} organizationId
   * @param {Object} resolutionData
   * @param {Object} actorUser
   * @returns {Promise<Object>}
   */
  async resolveIncident(idOrIncidentId, organizationId, { summary, rootCause, preventiveMeasures = '' }, actorUser) {
    const isObjectId = mongoose.Types.ObjectId.isValid(idOrIncidentId);
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);
    const filter = { organizationId: orgObjectId };

    if (isObjectId) {
      filter._id = new mongoose.Types.ObjectId(idOrIncidentId);
    } else {
      filter.incidentId = idOrIncidentId.toUpperCase();
    }

    const incident = await Incident.findOne(filter);
    if (!incident) {
      const err = new Error('Incident not found');
      err.code = 'INCIDENT_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const currentStatus = incident.status;
    const now = new Date();
    incident.status = 'resolved';
    incident.resolvedAt = now;

    if (incident.slaResolveDeadline && now > incident.slaResolveDeadline) {
      incident.slaBreached = true;
    }

    incident.resolution = {
      summary: summary.trim(),
      rootCause: rootCause.trim(),
      preventiveMeasures: preventiveMeasures ? preventiveMeasures.trim() : '',
      resolvedBy: actorUser?._id || null,
      resolvedAt: now,
      verifiedBy: null
    };

    const actorName = actorUser ? (actorUser.displayName || actorUser.email) : 'operator';

    incident.timeline.push({
      timestamp: now,
      action: 'incident_resolved',
      actor: actorName,
      details: `Incident resolved: ${summary.trim()}`
    });

    await incident.save();

    // Real-time integration (Phase 11): Emit updated incident event & dispatch notifications on resolution
    if (currentStatus !== 'resolved') {
      emitter.emitIncidentUpdated(incident.organizationId.toString(), incident.incidentId, {
        status: incident.status,
        severity: incident.severity
      });

      notificationService.notifyIncidentUpdated(incident.organizationId.toString(), incident).catch((err) => {
        logger.error(`[Notification Service] Async incident resolved notification failed: ${err.message}`);
      });
    }

    await logAuditEvent({
      action: 'incident.resolved',
      actor: actorUser ? actorUser._id : 'system',
      actorName,
      targetType: 'incident',
      targetId: incident._id,
      organizationId: orgObjectId,
      details: {
        incidentId: incident.incidentId,
        summary: summary.trim(),
        slaBreached: incident.slaBreached
      }
    });

    logger.info(`[Incident Engine] Incident ${incident.incidentId} resolved by ${actorName}`);
    return incident.toObject();
  }

  /**
   * Computes aggregate incident metrics, MTTA (time to triage), and MTTR (time to resolve).
   * 
   * @param {string} organizationId
   * @returns {Promise<Object>}
   */
  async getIncidentStats(organizationId) {
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);

    const [facetResult, resolutionTimes] = await Promise.all([
      Incident.aggregate([
        { $match: { organizationId: orgObjectId } },
        {
          $facet: {
            total: [{ $count: 'count' }],
            byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
            bySeverity: [{ $group: { _id: '$severity', count: { $sum: 1 } } }],
            slaBreached: [{ $match: { slaBreached: true } }, { $count: 'count' }]
          }
        }
      ]),
      Incident.aggregate([
        {
          $match: {
            organizationId: orgObjectId,
            triagedAt: { $ne: null }
          }
        },
        {
          $project: {
            triageDurationMin: {
              $divide: [{ $subtract: ['$triagedAt', '$detectedAt'] }, 1000 * 60]
            },
            resolveDurationMin: {
              $cond: [
                { $and: [{ $ne: ['$resolvedAt', null] }] },
                { $divide: [{ $subtract: ['$resolvedAt', '$detectedAt'] }, 1000 * 60] },
                null
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            avgMtta: { $avg: '$triageDurationMin' },
            avgMttr: { $avg: '$resolveDurationMin' }
          }
        }
      ])
    ]);

    const facet = facetResult[0] || {};
    const total = facet.total && facet.total[0] ? facet.total[0].count : 0;
    const slaBreachedCount = facet.slaBreached && facet.slaBreached[0] ? facet.slaBreached[0].count : 0;

    const byStatus = {
      detected: 0,
      triaged: 0,
      investigating: 0,
      containment: 0,
      resolved: 0,
      false_positive: 0,
      closed: 0
    };

    (facet.byStatus || []).forEach((item) => {
      if (item._id && byStatus[item._id] !== undefined) {
        byStatus[item._id] = item.count;
      }
    });

    const bySeverity = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    (facet.bySeverity || []).forEach((item) => {
      if (item._id && bySeverity[item._id] !== undefined) {
        bySeverity[item._id] = item.count;
      }
    });

    const times = resolutionTimes[0] || {};
    const mttt = times.avgMtta ? Math.round(times.avgMtta) : 0;
    const mttr = times.avgMttr ? Math.round(times.avgMttr) : 0;

    return {
      total,
      byStatus,
      bySeverity,
      slaBreached: slaBreachedCount,
      mttt,
      mttr
    };
  }

  /**
   * Retrieves incidents linked to a specific device.
   * 
   * @param {string} deviceIdOrMongoId
   * @param {string} organizationId
   * @param {Object} queryParams
   * @returns {Promise<{ incidents: Array, total: number }>}
   */
  async getDeviceIncidents(deviceIdOrMongoId, organizationId, queryParams = {}) {
    const isObjectId = mongoose.Types.ObjectId.isValid(deviceIdOrMongoId);
    const orgObjectId = new mongoose.Types.ObjectId(organizationId);
    const deviceFilter = { organizationId: orgObjectId };

    if (isObjectId) {
      deviceFilter._id = new mongoose.Types.ObjectId(deviceIdOrMongoId);
    } else {
      deviceFilter.deviceId = deviceIdOrMongoId.toUpperCase();
    }

    const device = await Device.findOne(deviceFilter).select('_id deviceId name').lean();
    if (!device) {
      const err = new Error('Device not found');
      err.code = 'DEVICE_NOT_FOUND';
      err.statusCode = 404;
      throw err;
    }

    const limit = Math.min(100, Math.max(1, parseInt(queryParams.limit, 10) || 20));

    const incidents = await Incident.find({
      organizationId: orgObjectId,
      deviceId: device._id
    })
      .populate('assignedTo', 'displayName email')
      .sort({ detectedAt: -1 })
      .limit(limit)
      .lean();

    return {
      incidents,
      total: incidents.length
    };
  }
}

module.exports = new IncidentService();
