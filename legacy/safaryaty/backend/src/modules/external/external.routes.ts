import { Router } from 'express';
import { ok } from '../../utils/response.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { requirePermission } from '../rbac/requirePermission.js';
import { forceCountrySync, getCountriesEnvelope, getCountryEnvelope } from './countryMetadata.service.js';
import { getCostProfileEnvelope } from './costProfile.adapter.js';

const router = Router();


router.get('/cost-profile', asyncHandler(async (req, res) => {
  const result = await getCostProfileEnvelope({
    destinationCountry: String(req.query.country || ''),
    tripCurrency: String(req.query.currency || 'USD'),
    comfortLevel: String(req.query.comfort || 'Balanced'),
    days: Math.max(1, Number(req.query.days || 7)),
    travelers: Math.max(1, Number(req.query.travelers || 1))
  });
  res.json(ok(result));
}));
router.get('/countries', asyncHandler(async (_req, res) => {
  const result = await getCountriesEnvelope();
  res.json(ok(result));
}));

router.get('/countries/:code', asyncHandler(async (req, res) => {
  const result = await getCountryEnvelope(req.params.code);
  res.json(ok(result));
}));

router.post('/countries/sync', requireAuth, requirePermission('canManagePresets'), asyncHandler(async (_req, res) => {
  const result = await forceCountrySync();
  res.json(ok({ ...result, notes: [...result.notes, 'Persistent country snapshot refreshed by an administrator.'] }));
}));

export default router;
