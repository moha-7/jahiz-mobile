import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { HttpError } from '../../utils/httpError.js';
import { ok } from '../../utils/response.js';
import { includeTripRelations } from '../trips/trips.service.js';
import { buildTripRecommendations } from './recommendation.service.js';

const router = Router();
router.use(requireAuth);

router.get('/trips/:tripId/recommendations', asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const trip = await prisma.trip.findFirst({
    where: { id: req.params.tripId, userId: user.id, status: { not: 'DELETED' } },
    include: includeTripRelations()
  });
  if (!trip) throw new HttpError(404, 'Trip not found');
  const result = await buildTripRecommendations(trip as any);
  res.json(ok(result));
}));

export default router;
