import { ok, fail } from './http.js';
import * as repo from './rbac-repo.js';
import { resolveEffectiveAccess, hasPermission } from './rbac-engine.js';

function tenantIdFromReq(req) {
  return String(req.headers['x-blinkone-tenant-id'] || req.query.tenant_id || '').trim();
}

function userIdFromReq(req) {
  return String(req.headers['x-blinkone-user-id'] || req.query.user_id || '').trim();
}

function requireRbacPermission(permission) {
  return async (req, res, next) => {
    const tenantId = tenantIdFromReq(req);
    const userId = userIdFromReq(req);
    if (!tenantId || !userId) {
      return fail(res, 'FORBIDDEN', 'Tenant and user context required', 403);
    }
    const platformRole = req.headers['x-blinkone-platform-role'];
    if (platformRole === 'platform_admin') return next();

    const effective = await resolveEffectiveAccess({
      tenantId,
      chatwootUserId: userId,
      isPlatformAdmin: false,
    });
    if (!hasPermission(effective, permission)) {
      return fail(res, 'FORBIDDEN', `Missing permission: ${permission}`, 403);
    }
    return next();
  };
}

export function mountRbacRoutes(app, auth) {
  app.get('/v1/rbac/catalog', auth, async (_req, res) => {
    const catalog = await repo.getCatalog();
    if (!catalog) return fail(res, 'NOT_CONFIGURED', 'Postgres required', 501);
    return ok(res, catalog);
  });

  app.get('/v1/rbac/effective', auth, async (req, res) => {
    const tenantId = tenantIdFromReq(req);
    const userId = userIdFromReq(req);
    if (!tenantId || !userId) {
      return fail(res, 'VALIDATION_ERROR', 'x-blinkone-tenant-id and x-blinkone-user-id required', 400);
    }
    const isPlatformAdmin = req.headers['x-blinkone-platform-role'] === 'platform_admin';
    const effective = await resolveEffectiveAccess({
      tenantId,
      chatwootUserId: userId,
      chatwootRole: req.query.chatwoot_role,
      isPlatformAdmin,
      email: req.query.email,
      name: req.query.name,
    });
    return ok(res, effective);
  });

  app.get('/v1/rbac/roles', auth, requireRbacPermission('roles.view'), async (req, res) => {
    const tenantId = tenantIdFromReq(req);
    if (!tenantId) return fail(res, 'VALIDATION_ERROR', 'tenant required', 400);
    return ok(res, await repo.listRoles(tenantId));
  });

  app.get('/v1/rbac/roles/:id', auth, requireRbacPermission('roles.view'), async (req, res) => {
    const tenantId = tenantIdFromReq(req);
    const role = await repo.getRole(tenantId, req.params.id);
    if (!role) return fail(res, 'NOT_FOUND', 'Role not found', 404);
    return ok(res, role);
  });

  app.post('/v1/rbac/roles', auth, requireRbacPermission('roles.create'), async (req, res) => {
    const tenantId = tenantIdFromReq(req);
    const body = req.body ?? {};
    if (!body.name?.trim()) return fail(res, 'VALIDATION_ERROR', 'name required', 400);
    try {
      const role = await repo.createRole(tenantId, body);
      return ok(res, role, 201);
    } catch (e) {
      if (e.code === '23505') return fail(res, 'CONFLICT', 'Role name already exists', 409);
      throw e;
    }
  });

  app.patch('/v1/rbac/roles/:id', auth, requireRbacPermission('roles.edit'), async (req, res) => {
    const tenantId = tenantIdFromReq(req);
    const role = await repo.updateRole(tenantId, req.params.id, req.body ?? {});
    if (!role) return fail(res, 'NOT_FOUND', 'Role not found', 404);
    return ok(res, role);
  });

  app.delete('/v1/rbac/roles/:id', auth, requireRbacPermission('roles.delete'), async (req, res) => {
    const tenantId = tenantIdFromReq(req);
    const id = await repo.deleteRole(tenantId, req.params.id);
    if (!id) return fail(res, 'NOT_FOUND', 'Role not found or is system role', 404);
    return ok(res, { id });
  });

  app.get('/v1/rbac/users', auth, requireRbacPermission('users.view'), async (req, res) => {
    const tenantId = tenantIdFromReq(req);
    return ok(res, await repo.listUsers(tenantId));
  });

  app.get('/v1/rbac/users/seats', auth, requireRbacPermission('users.view'), async (req, res) => {
    const tenantId = tenantIdFromReq(req);
    return ok(res, await repo.getSeatStatus(tenantId));
  });

  app.post('/v1/rbac/users/invite', auth, requireRbacPermission('users.edit'), async (req, res) => {
    const tenantId = tenantIdFromReq(req);
    try {
      const user = await repo.inviteUser(tenantId, req.body ?? {});
      return ok(res, user, 201);
    } catch (e) {
      if (e.code === 'VALIDATION') return fail(res, 'VALIDATION_ERROR', e.message, 400);
      if (e.code === 'LIMIT_EXCEEDED') return fail(res, 'LIMIT_EXCEEDED', e.message, 402);
      if (e.code === 'NOT_CONFIGURED') return fail(res, 'NOT_CONFIGURED', e.message, 503);
      if (String(e.message || '').includes('422') || String(e.message || '').includes('Email')) {
        return fail(res, 'CONFLICT', 'Email already registered in Chatwoot — link the existing agent instead.', 409);
      }
      throw e;
    }
  });

  app.post('/v1/rbac/users', auth, requireRbacPermission('users.edit'), async (req, res) => {
    const tenantId = tenantIdFromReq(req);
    try {
      const body = req.body ?? {};
      const cwId = Number(body.chatwootUserId);
      if (Number.isFinite(cwId)) {
        await repo.assertSeatAvailable(tenantId, cwId);
      }
      const user = await repo.upsertUser(tenantId, body);
      return ok(res, user, 201);
    } catch (e) {
      if (e.code === 'VALIDATION') return fail(res, 'VALIDATION_ERROR', e.message, 400);
      if (e.code === 'LIMIT_EXCEEDED') return fail(res, 'LIMIT_EXCEEDED', e.message, 402);
      throw e;
    }
  });

  app.delete('/v1/rbac/users/:id', auth, requireRbacPermission('users.edit'), async (req, res) => {
    const tenantId = tenantIdFromReq(req);
    const actorId = userIdFromReq(req);
    try {
      const result = await repo.deleteUser(tenantId, req.params.id, actorId);
      if (!result) return fail(res, 'NOT_FOUND', 'User not found', 404);
      return ok(res, result);
    } catch (e) {
      if (e.code === 'VALIDATION') return fail(res, 'VALIDATION_ERROR', e.message, 400);
      return fail(res, 'ERROR', e.message || 'Delete failed', 502);
    }
  });
}
