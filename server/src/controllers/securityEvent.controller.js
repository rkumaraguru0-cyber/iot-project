const securityEventService = require('../services/securityEvent.service');

class SecurityEventController {
  /**
   * List security events for organization with pagination, filtering, search
   * GET /api/v1/security-events
   */
  async listSecurityEvents(req, res, next) {
    try {
      const result = await securityEventService.listSecurityEvents(req.organizationId, req.query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single security event by ID or eventId
   * GET /api/v1/security-events/:id
   */
  async getSecurityEventById(req, res, next) {
    try {
      const event = await securityEventService.getSecurityEventById(req.params.id, req.organizationId);
      res.status(200).json({ event });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get security events for a specific device
   * GET /api/v1/devices/:id/security-events
   */
  async getDeviceSecurityEvents(req, res, next) {
    try {
      const result = await securityEventService.getDeviceSecurityEvents(req.params.id, req.organizationId, req.query);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update security event status (triage action)
   * PATCH /api/v1/security-events/:id/status
   */
  async updateEventStatus(req, res, next) {
    try {
      const updated = await securityEventService.updateEventStatus(
        req.params.id,
        req.organizationId,
        req.body.status,
        req.body.resolutionNote,
        req.user
      );
      res.status(200).json({
        message: 'Security event status updated successfully',
        event: updated
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SecurityEventController();
