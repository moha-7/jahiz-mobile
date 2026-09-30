import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const shared = readFileSync(new URL('../shared/recommendation-engine.js', import.meta.url), 'utf8');
const engine = readFileSync(new URL('./engine.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('./main.jsx', import.meta.url), 'utf8');
const backendService = readFileSync(new URL('../backend/src/modules/recommendations/recommendation.service.ts', import.meta.url), 'utf8');
const backendRoute = readFileSync(new URL('../backend/src/modules/recommendations/recommendation.routes.ts', import.meta.url), 'utf8');
const app = readFileSync(new URL('../backend/src/app.ts', import.meta.url), 'utf8');

test('frontend and backend consume the same recommendation engine', () => {
  assert.match(engine, /generateRecommendations/);
  assert.match(backendService, /shared\/recommendation-engine\.js/);
  assert.match(shared, /RECOMMENDATION_ENGINE_VERSION = "4\.29\.42"/);
});

test('saved trip recommendation endpoint is authenticated and registered', () => {
  assert.match(backendRoute, /router\.use\(requireAuth\)/);
  assert.match(backendRoute, /\/trips\/:tripId\/recommendations/);
  assert.match(app, /recommendationRoutes/);
});

test('smart CTA uses first ranked recommendation and full wizard stays separate', () => {
  assert.match(main, /nextAction: recs\[0\] \|\| status\.nextAction/);
  assert.match(main, /Full plan editor/);
  assert.match(main, /Recommended fix/);
});

test('recommendations page avoids duplicate intelligence panels', () => {
  assert.match(main, /RecommendationPageHeader/);
  assert.match(main, /<Recs recs=\{recs\} onAction=\{followCoachAction\}/);
});
