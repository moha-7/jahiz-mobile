import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HttpError } from '../../utils/httpError.js';
import { ok } from '../../utils/response.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../rbac/requirePermission.js';
import { forceSyncRate, getRate } from './fx.service.js';

const router = Router();
const querySchema = z.object({ from: z.string().min(3).max(3), to: z.string().min(3).max(3), refresh: z.string().optional() });
const syncSchema = z.object({ base: z.string().min(3).max(3) });

router.get('/rate', asyncHandler(async (req, res) => {
  const { from, to, refresh } = querySchema.parse(req.query);
  try {
    const result = await getRate(from, to, { forceRefresh: refresh === '1' || refresh === 'true', waitForRefresh: refresh === '1' || refresh === 'true' });
    res.json(ok(result));
  } catch (error: any) {
    throw new HttpError(502, error?.message || 'Unable to fetch exchange rate');
  }
}));

router.post('/sync', requireAuth, requirePermission('canManagePresets'), asyncHandler(async (req, res) => {
  const { base } = syncSchema.parse(req.body);
  const result = await forceSyncRate(base);
  res.json(ok({ ...result, note: 'Persistent FX snapshot refreshed by an administrator.' }));
}));

export default router;
