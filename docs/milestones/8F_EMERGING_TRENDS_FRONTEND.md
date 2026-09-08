# Milestone 8F: Emerging Trend Forecasting Frontend Integration

## Overview

Milestone 8F integrates the frozen Emerging Trend Forecasting subsystem into the TRAJECT production frontend. The interface provides analysts with forward-looking visibility into early-stage topics that exhibit high momentum and rising prominence potential over the primary 24-hour forecast horizon.

## 1. Frozen Backend Contracts & Integration Architecture

The frontend exclusively consumes the frozen Milestone 8E REST endpoints:
- `GET /api/v1/forecasting/emerging-trends`: Returns precomputed topic forecasts ranked strictly in canonical descending order by `forecast_score`.
- `GET /api/v1/forecasting/status`: Returns operational health, strategy metadata (`volume_velocity_hybrid`), observation cutoff timestamp, and candidate topic counts.

### Client-Side Guarantees
- **Zero Frontend Forecasting Math**: The frontend never recalculates scores, weights, percentiles, or ranks. Scores and percentiles are computed deterministically on the backend batch artifact.
- **Strict Terminology**: All UI labels adhere to canonical terminology (*Emerging Trends*, *Emerging Trend Score*, *Forecast Horizon*, *Trajectory*, *Confidence*, *Strong Emergence*, *Moderate Emergence*, *Early Signal*, *Low Momentum*). Prohibited adversarial wording (*threat*, *malicious*, *disinformation*, *hazard*) is strictly excluded.
- **24-Hour Primary Horizon**: 24h is the primary default horizon. 6h is an auxiliary/experimental view.
- **Direct Topic Intelligence Integration**: Each forecast card provides an "Explore Topic" button navigating to `/topics/:id` (rendering `TrendDetailPage`), ensuring seamless transitions from emerging signals to detailed topic intelligence without losing topic IDs.

## 2. Component Architecture

The implementation resides in modular, typed components under `frontend/src/components/forecasting/` and `frontend/src/pages/EmergingTrends/`:

1. **`ForecastingStatusBanner`** (`src/components/forecasting/ForecastingStatusBanner.tsx`):
   - Displays real-time operational status, strategy (`volume_velocity_hybrid`), cutoff date (`2026-09-05 12:00 UTC`), generation timestamp, and total evaluated candidate topics (132).
2. **`EmergingTrendsFilters`** (`src/components/forecasting/EmergingTrendsFilters.tsx`):
   - Horizon toggle (`24h Horizon (Primary)` vs `6h Horizon (Auxiliary)`).
   - Emergence tier selector (`STRONG_EMERGENCE`, `MODERATE_EMERGENCE`, `EARLY_SIGNAL`, `LOW_MOMENTUM`).
   - Min score range slider (0.00 to 1.00).
   - Topic limit dropdown (10, 20, 50, 100).
3. **`EmergingTrendCard`** (`src/components/forecasting/EmergingTrendCard.tsx`):
   - Displays authoritative rank badge (`#1`), Emergence Tier badge, Trajectory badge with accessible Unicode directional symbol (`↑`, `↗`, `→`, `↔`, `↘`), and Confidence tier.
   - Prominently features the decimal `Emerging Trend Score` (e.g. `1.00`, `0.85`) with visual meter bar.
   - Highlights supporting components: 24h Volume (`messages_24h`) and 6h Velocity (`velocity_6h`).
   - Provides an accessible "Explore Topic" action navigating to `/topics/:id`.
4. **`EmergingTrendsSkeleton`** (`src/components/forecasting/EmergingTrendsSkeleton.tsx`):
   - Geometric placeholder cards for zero-CLS loading states.
5. **`EmergingTrendsPage`** (`src/pages/EmergingTrends/EmergingTrendsPage.tsx`):
   - Full page view integrating `PageHeader`, `ForecastingStatusBanner`, `EmergingTrendsFilters`, and responsive card grid with empty and error states.

## 3. Navigation & Routing

The application routes and navigation menus were updated without breaking any existing paths:
- Route registered: `<Route path="emerging-trends" element={<EmergingTrendsPage />} />`
- Route updated: `<Route path="topics/:id" element={<TrendDetailPage />} />`
- Desktop Sidebar: Added "Emerging Trends" with `TrendingUp` icon in the *Monitor* section.
- Top Navigation: Added "Emerging Trends" to `PRIMARY_NAV_ITEMS`.
- Mobile Navigation: Added "Emerging Trends" to `ALL_DRAWER_ITEMS`.

## 4. Verification & Quality Assurance

- **Frontend Tests**: 29 passed out of 29 in `node --test tests/*.test.js` (including 13 forecasting-specific tests verifying query parameters, decimal formatting, Unicode trajectory symbols, static audits against frontend recalculation, and static audits against prohibited terminology).
- **Backend Tests**: 14 passed out of 14 in `pytest tests/test_forecasting_production_8e.py`.
- **Production Build**: `npm run build` (`tsc && vite build`) completed with 0 errors in 10.36s.
- **Browser Automation**: Navigated to `/emerging-trends`, verified status banner, horizon toggling, card rendering, and "Explore Topic" navigation flow.
