const mongoose = require('mongoose');
const { scopeToOrganization, matchesOrganization } = require('../src/utils/tenantScope');

describe('Multi-Tenancy Isolation Utilities (Phase 2)', () => {
  const orgA = new mongoose.Types.ObjectId();
  const orgB = new mongoose.Types.ObjectId();

  it('scopeToOrganization should correctly inject organizationId into filter', () => {
    const filter = { status: 'active' };
    const scoped = scopeToOrganization(filter, orgA);

    expect(scoped).toHaveProperty('status', 'active');
    expect(scoped).toHaveProperty('organizationId', orgA);
  });

  it('scopeToOrganization should support system-global fallback matching', () => {
    const filter = { enabled: true };
    const scoped = scopeToOrganization(filter, orgA, true);

    expect(scoped).toHaveProperty('enabled', true);
    expect(scoped).toHaveProperty('$or');
    expect(scoped.$or).toEqual([
      { organizationId: orgA },
      { organizationId: null }
    ]);
  });

  it('scopeToOrganization should throw error if organizationId is missing', () => {
    expect(() => scopeToOrganization({ status: 'active' }, null)).toThrow(
      'Organization ID is required for tenant-scoped database operations'
    );
  });

  it('matchesOrganization should return true when document matches tenant', () => {
    const doc = { organizationId: orgA };
    expect(matchesOrganization(doc, orgA)).toBe(true);
    expect(matchesOrganization(doc, orgB)).toBe(false);
  });

  it('matchesOrganization should return false for invalid inputs', () => {
    expect(matchesOrganization(null, orgA)).toBe(false);
    expect(matchesOrganization({}, orgA)).toBe(false);
    expect(matchesOrganization({ organizationId: orgA }, null)).toBe(false);
  });
});
