const mongoose = require('mongoose');
const { SecurityEvent, Incident, Device } = require('../models');
const incidentService = require('./incident.service');
const logger = require('../utils/logger');

const SEVERITY_RANK = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

const TEMPORAL_WINDOW_MS = 30 * 60 * 1000;  // 30 minutes
const REPEATED_WINDOW_MS = 60 * 60 * 1000;  // 60 minutes

class CorrelationService {
  /**
   * Main entry point: evaluates correlation strategies for an incoming/updated SecurityEvent.
   * 
   * @param {Object} securityEvent - Persisted SecurityEvent document
   * @returns {Promise<Object|null>} Created or updated Incident document, or null if no action needed
   */
  async processSecurityEvent(securityEvent) {
    if (!securityEvent || !securityEvent.organizationId || !securityEvent.deviceId) {
      return null;
    }

    try {
      const orgId = securityEvent.organizationId?._id || securityEvent.organizationId;
      const devId = securityEvent.deviceId?._id || securityEvent.deviceId;
      const orgObjectId = new mongoose.Types.ObjectId(orgId);
      const devObjectId = new mongoose.Types.ObjectId(devId);
      const eventTimestamp = securityEvent.lastOccurrence ? new Date(securityEvent.lastOccurrence) : new Date();

      // Fetch device context
      const device = await Device.findOne({ _id: devObjectId, organizationId: orgObjectId });
      if (!device) {
        return null;
      }

      // =========================================================================
      // STEP 1: Check for active open incident on the same device (Strategy 3)
      // =========================================================================
      const openIncident = await Incident.findOne({
        organizationId: orgObjectId,
        deviceId: devObjectId,
        status: { $in: ['detected', 'triaged', 'investigating', 'containment'] }
      });

      if (openIncident) {
        return await this.attachToOpenIncident(openIncident, securityEvent);
      }

      // =========================================================================
      // STEP 2: Evaluate Strategy 1 (Same-Device Temporal Clustering: CORR-TEMPORAL)
      // =========================================================================
      const temporalIncident = await this.evaluateTemporalStrategy(orgObjectId, devObjectId, device, securityEvent, eventTimestamp);
      if (temporalIncident) {
        return temporalIncident;
      }

      // =========================================================================
      // STEP 3: Evaluate Strategy 2 (Same-Rule Repeated Clustering: CORR-REPEATED)
      // =========================================================================
      const repeatedIncident = await this.evaluateRepeatedStrategy(orgObjectId, devObjectId, device, securityEvent, eventTimestamp);
      if (repeatedIncident) {
        return repeatedIncident;
      }

      // =========================================================================
      // STEP 4: Standalone High-Severity Direct Escalation
      // =========================================================================
      if (securityEvent.severity === 'critical' || securityEvent.severity === 'high') {
        return await this.createStandaloneIncident(orgObjectId, devObjectId, device, securityEvent);
      }

      // Step 5: Event remains standalone (severity < high and no correlation)
      logger.debug(`[Correlation Engine] Event ${securityEvent.eventId} remains standalone on device ${device.deviceId}`);
      return null;
    } catch (err) {
      logger.error(`[Correlation Engine] Error correlating security event ${securityEvent?.eventId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Strategy 3 (CORR-ESCALATION): Attaches new event to existing open incident and escalates severity if warranted.
   * 
   * @private
   */
  async attachToOpenIncident(incident, securityEvent) {
    const isAlreadyLinked = incident.relatedEventIds.includes(securityEvent.eventId);
    if (!isAlreadyLinked) {
      incident.relatedEventIds.push(securityEvent.eventId);
      incident.evidence.push({
        type: 'security_event',
        entityId: securityEvent._id,
        addedAt: new Date(),
        addedBy: 'system',
        note: securityEvent.explanation || `Event ${securityEvent.eventId} attached via Strategy 3 (CORR-ESCALATION)`
      });
    }

    const currentRank = SEVERITY_RANK[incident.severity] || 1;
    const incomingRank = SEVERITY_RANK[securityEvent.severity] || 1;

    let escalated = false;
    let oldSeverity = incident.severity;

    if (incomingRank > currentRank) {
      incident.severity = securityEvent.severity;
      escalated = true;
      incident.timeline.push({
        timestamp: new Date(),
        action: 'severity_escalated',
        actor: 'system',
        details: `Incident severity escalated from ${oldSeverity} to ${securityEvent.severity} due to new ${securityEvent.severity} event: ${securityEvent.explanation || securityEvent.eventId}`
      });
    } else if (!isAlreadyLinked) {
      incident.timeline.push({
        timestamp: new Date(),
        action: 'event_attached',
        actor: 'system',
        details: `Security event ${securityEvent.eventId} (${securityEvent.severity}) attached to active incident`
      });
    }

    await incident.save();

    // Back-link SecurityEvent
    await SecurityEvent.updateOne(
      { _id: securityEvent._id },
      { $set: { incidentId: incident.incidentId } }
    );

    if (escalated) {
      logger.info(`[Correlation Engine] Escalated Incident ${incident.incidentId} severity to ${incident.severity} on device ${incident.deviceId}`);
    } else {
      logger.debug(`[Correlation Engine] Attached event ${securityEvent.eventId} to Incident ${incident.incidentId}`);
    }

    return incident.toObject();
  }

  /**
   * Strategy 1 (CORR-TEMPORAL): Temporal clustering on same device within 30 minutes.
   * Criteria: >= 3 events, at least 1 >= medium severity.
   * 
   * @private
   */
  async evaluateTemporalStrategy(organizationId, deviceId, device, triggeringEvent, eventTimestamp) {
    const windowStart = new Date(eventTimestamp.getTime() - TEMPORAL_WINDOW_MS);

    // Find unassigned events for this device in the last 30 minutes
    const candidates = await SecurityEvent.find({
      organizationId,
      deviceId,
      incidentId: null,
      status: { $in: ['open', 'acknowledged'] },
      lastOccurrence: { $gte: windowStart }
    }).sort({ lastOccurrence: -1 }).lean();

    if (candidates.length < 3) {
      return null;
    }

    // Must have at least 1 event with severity >= medium
    const hasMediumOrAbove = candidates.some(e => e.severity === 'medium' || e.severity === 'high' || e.severity === 'critical');
    if (!hasMediumOrAbove) {
      return null;
    }

    // Incident severity = max severity among matched events
    let maxRank = 1;
    let incidentSeverity = 'medium';
    candidates.forEach(e => {
      const rank = SEVERITY_RANK[e.severity] || 1;
      if (rank > maxRank) {
        maxRank = rank;
        incidentSeverity = e.severity;
      }
    });

    const relatedEventIds = candidates.map(e => e.eventId);
    const initialEvidence = candidates.map(e => ({
      type: 'security_event',
      entityId: e._id,
      addedAt: new Date(),
      addedBy: 'system',
      note: e.explanation || `Rule: ${e.ruleName || e.ruleId}`
    }));

    const eventSummaries = candidates
      .slice(0, 4)
      .map(e => `${e.ruleName || e.ruleId} (${e.severity})`)
      .join(', ');

    const matchReason = `${candidates.length} events from device ${device.deviceId} within 30 minutes: ${eventSummaries}`;

    return await incidentService.createIncident({
      organizationId,
      deviceId,
      title: `Correlated Activity Cluster on ${device.name || device.deviceId}`,
      description: `Temporal clustering detected ${candidates.length} security events on device ${device.deviceId} within a 30-minute window.`,
      severity: incidentSeverity,
      category: triggeringEvent.category || 'security',
      relatedEventIds,
      correlationDetails: {
        strategyId: 'CORR-TEMPORAL',
        strategyName: 'Same-Device Temporal Clustering',
        matchReason,
        timeWindowMinutes: 30,
        eventCount: candidates.length,
        matchedAt: new Date()
      },
      initialEvidence,
      riskScoreAtCreation: device.riskScore || 0,
      impactAssessment: `Cluster of ${candidates.length} events suggests active operational degradation or targeted exploitation.`
    });
  }

  /**
   * Strategy 2 (CORR-REPEATED): Same-rule repeated clustering on same device within 60 minutes.
   * Criteria: Same ruleId triggered >= 5 times within 60 minutes.
   * 
   * @private
   */
  async evaluateRepeatedStrategy(organizationId, deviceId, device, triggeringEvent, eventTimestamp) {
    if (!triggeringEvent.ruleId) return null;

    const windowStart = new Date(eventTimestamp.getTime() - REPEATED_WINDOW_MS);

    // Find unassigned events for the same ruleId on this device in the last 60 minutes
    const candidates = await SecurityEvent.find({
      organizationId,
      deviceId,
      ruleId: triggeringEvent.ruleId,
      incidentId: null,
      lastOccurrence: { $gte: windowStart }
    }).sort({ lastOccurrence: -1 }).lean();

    // Sum occurrences across matching documents
    const totalOccurrences = candidates.reduce((acc, curr) => acc + (curr.occurrenceCount || 1), 0);

    if (totalOccurrences < 5) {
      return null;
    }

    // Severity mapping per approved PRD:
    // medium -> high, high -> critical, critical -> critical, low -> low
    const baseSeverity = triggeringEvent.severity || 'medium';
    let incidentSeverity = 'high';

    if (baseSeverity === 'critical') {
      incidentSeverity = 'critical';
    } else if (baseSeverity === 'high') {
      incidentSeverity = 'critical';
    } else if (baseSeverity === 'medium') {
      incidentSeverity = 'high';
    } else {
      incidentSeverity = 'low';
    }

    const relatedEventIds = candidates.map(e => e.eventId);
    const initialEvidence = candidates.map(e => ({
      type: 'security_event',
      entityId: e._id,
      addedAt: new Date(),
      addedBy: 'system',
      note: e.explanation || `Rule: ${e.ruleName || e.ruleId} repeated ${e.occurrenceCount || 1} times`
    }));

    const matchReason = `Rule "${triggeringEvent.ruleName || triggeringEvent.ruleId}" triggered ${totalOccurrences} times for device ${device.deviceId} within 60 minutes`;

    return await incidentService.createIncident({
      organizationId,
      deviceId,
      title: `Repeated Rule Breach: ${triggeringEvent.ruleName || triggeringEvent.ruleId} on ${device.name || device.deviceId}`,
      description: `Rule ${triggeringEvent.ruleId} breached ${totalOccurrences} times on device ${device.deviceId} within 60 minutes, escalating incident severity.`,
      severity: incidentSeverity,
      category: triggeringEvent.category || 'rate',
      relatedEventIds,
      correlationDetails: {
        strategyId: 'CORR-REPEATED',
        strategyName: 'Same-Rule Repeated',
        matchReason,
        timeWindowMinutes: 60,
        eventCount: totalOccurrences,
        matchedAt: new Date()
      },
      initialEvidence,
      riskScoreAtCreation: device.riskScore || 0,
      impactAssessment: `High-frequency repetitive rule violations indicate persistent fault condition or brute-force pattern.`
    });
  }

  /**
   * Creates a standalone incident for un-correlated high or critical severity events.
   * 
   * @private
   */
  async createStandaloneIncident(organizationId, deviceId, device, securityEvent) {
    const initialEvidence = [
      {
        type: 'security_event',
        entityId: securityEvent._id,
        addedAt: new Date(),
        addedBy: 'system',
        note: securityEvent.explanation || `Standalone high-severity trigger: ${securityEvent.ruleName || securityEvent.ruleId}`
      }
    ];

    return await incidentService.createIncident({
      organizationId,
      deviceId,
      title: `Security Alert: ${securityEvent.ruleName || securityEvent.ruleId} on ${device.name || device.deviceId}`,
      description: securityEvent.explanation || `Standalone ${securityEvent.severity} security event detected on ${device.deviceId}.`,
      severity: securityEvent.severity,
      category: securityEvent.category || 'security',
      relatedEventIds: [securityEvent.eventId],
      correlationDetails: null, // Standalone has null correlationDetails
      initialEvidence,
      riskScoreAtCreation: device.riskScore || 0,
      impactAssessment: `Direct high-priority alert requiring immediate analyst investigation.`
    });
  }
}

module.exports = new CorrelationService();
