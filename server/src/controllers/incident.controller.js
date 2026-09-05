const incidentService = require('../services/incident.service');

class IncidentController {
  /**
   * @route   GET /api/v1/incidents
   * @desc    List incidents with filtering & pagination
   * @access  viewer+
   */
  async listIncidents(req, res, next) {
    try {
      const result = await incidentService.listIncidents(req.organizationId, req.query);
      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * @route   GET /api/v1/incidents/stats
   * @desc    Get aggregate incident statistics, MTTA, and MTTR
   * @access  viewer+
   */
  async getIncidentStats(req, res, next) {
    try {
      const stats = await incidentService.getIncidentStats(req.organizationId);
      return res.status(200).json({
        success: true,
        ...stats
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * @route   GET /api/v1/incidents/:id
   * @desc    Get full incident details with timeline, notes, evidence, and security events
   * @access  viewer+
   */
  async getIncidentById(req, res, next) {
    try {
      const incident = await incidentService.getIncidentById(req.params.id, req.organizationId);
      return res.status(200).json({
        success: true,
        incident
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * @route   PATCH /api/v1/incidents/:id/status
   * @desc    Transition incident lifecycle state
   * @access  operator+ (close requires security_analyst+)
   */
  async updateIncidentStatus(req, res, next) {
    try {
      const { status, note } = req.body;
      const incident = await incidentService.updateIncidentStatus(
        req.params.id,
        req.organizationId,
        status,
        note,
        req.user
      );
      return res.status(200).json({
        success: true,
        message: `Incident status updated to '${status}'`,
        incident
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * @route   PATCH /api/v1/incidents/:id/assign
   * @desc    Assign or unassign incident to a user
   * @access  operator+
   */
  async assignIncident(req, res, next) {
    try {
      const { assignedTo } = req.body;
      const incident = await incidentService.assignIncident(
        req.params.id,
        req.organizationId,
        assignedTo,
        req.user
      );
      return res.status(200).json({
        success: true,
        message: assignedTo ? 'Incident assigned successfully' : 'Incident unassigned successfully',
        incident
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * @route   POST /api/v1/incidents/:id/notes
   * @desc    Add investigation note
   * @access  operator+
   */
  async addNote(req, res, next) {
    try {
      const { content } = req.body;
      const incident = await incidentService.addNote(
        req.params.id,
        req.organizationId,
        content,
        req.user
      );
      return res.status(201).json({
        success: true,
        message: 'Note added to incident investigation',
        incident
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * @route   POST /api/v1/incidents/:id/actions
   * @desc    Record response action and execute approved device containment operations
   * @access  operator+ (quarantine: operator+, revoke key: security_analyst+)
   */
  async recordResponseAction(req, res, next) {
    try {
      const { action, details } = req.body;
      const incident = await incidentService.recordResponseAction(
        req.params.id,
        req.organizationId,
        action,
        details,
        req.user
      );
      return res.status(201).json({
        success: true,
        message: `Response action '${action}' recorded`,
        incident
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * @route   POST /api/v1/incidents/:id/evidence
   * @desc    Attach forensic evidence item
   * @access  operator+
   */
  async addEvidence(req, res, next) {
    try {
      const incident = await incidentService.addEvidence(
        req.params.id,
        req.organizationId,
        req.body,
        req.user
      );
      return res.status(201).json({
        success: true,
        message: 'Evidence attached to incident',
        incident
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * @route   POST /api/v1/incidents/:id/resolve
   * @desc    Submit formal resolution documentation and mark incident resolved
   * @access  operator+
   */
  async resolveIncident(req, res, next) {
    try {
      const incident = await incidentService.resolveIncident(
        req.params.id,
        req.organizationId,
        req.body,
        req.user
      );
      return res.status(200).json({
        success: true,
        message: 'Incident marked as resolved',
        incident
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * @route   GET /api/v1/devices/:id/incidents
   * @desc    Get incidents for a specific device
   * @access  viewer+
   */
  async getDeviceIncidents(req, res, next) {
    try {
      const result = await incidentService.getDeviceIncidents(
        req.params.id,
        req.organizationId,
        req.query
      );
      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new IncidentController();
