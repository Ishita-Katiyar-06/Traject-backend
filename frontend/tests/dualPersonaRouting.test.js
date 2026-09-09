import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.resolve(__dirname, '../src');

test('1. Dual Persona Shells: PublicShell and NtroShell exist and maintain clear boundaries', () => {
  const publicShellPath = path.join(SRC_DIR, 'shells', 'PublicShell.tsx');
  const ntroShellPath = path.join(SRC_DIR, 'shells', 'NtroShell.tsx');

  assert.ok(fs.existsSync(publicShellPath), 'PublicShell.tsx must exist');
  assert.ok(fs.existsSync(ntroShellPath), 'NtroShell.tsx must exist');

  const publicShellContent = fs.readFileSync(publicShellPath, 'utf8');
  const ntroShellContent = fs.readFileSync(ntroShellPath, 'utf8');

  // PublicShell must only expose public routes and clean branding
  assert.ok(publicShellContent.includes('/trends'), 'PublicShell must link to /trends');
  assert.ok(publicShellContent.includes('/emerging-trends'), 'PublicShell must link to /emerging-trends');
  assert.ok(!publicShellContent.includes('LiveAlertToast'), 'PublicShell must NOT contain live alert toast telemetry');
  assert.ok(!publicShellContent.includes('CLEARANCE LEVEL-4'), 'PublicShell must NOT display CLEARANCE LEVEL-4');

  // NtroShell must wrap live stream telemetry and institutional navigation
  assert.ok(ntroShellContent.includes('LiveStreamProvider'), 'NtroShell must provide LiveStreamProvider');
  assert.ok(ntroShellContent.includes('TopNavigation'), 'NtroShell must mount TopNavigation');
});

test('2. Institutional Console: TopNavigation routes to console and switches to public view', () => {
  const topNavPath = path.join(SRC_DIR, 'layout', 'TopNavigation.tsx');
  assert.ok(fs.existsSync(topNavPath), 'TopNavigation.tsx must exist');

  const topNavContent = fs.readFileSync(topNavPath, 'utf8');
  assert.ok(topNavContent.includes('/console/overview'), 'TopNavigation must route to /console/overview');
  assert.ok(topNavContent.includes('/console/alerts'), 'TopNavigation must route to /console/alerts');
  assert.ok(topNavContent.includes('Public View'), 'TopNavigation must include quick link to Public View');
});

test('3. Role Security: RoleContext strictly extracts trusted role from app_metadata', () => {
  const roleContextPath = path.join(SRC_DIR, 'contexts', 'RoleContext.tsx');
  assert.ok(fs.existsSync(roleContextPath), 'RoleContext.tsx must exist');

  const roleContextContent = fs.readFileSync(roleContextPath, 'utf8');

  // Must verify server-controlled app_metadata
  assert.ok(roleContextContent.includes('app_metadata'), 'RoleContext must inspect app_metadata');
  assert.ok(roleContextContent.includes('ntro_analyst'), 'RoleContext must recognize ntro_analyst role');
  assert.ok(!roleContextContent.includes('localStorage.getItem'), 'RoleContext must not read role from localStorage');
});

test('4. Route Protection: ProtectedRoute blocks public users from NTRO console', () => {
  const protectedRoutePath = path.join(SRC_DIR, 'components', 'auth', 'ProtectedRoute.tsx');
  assert.ok(fs.existsSync(protectedRoutePath), 'ProtectedRoute.tsx must exist');

  const protectedRouteContent = fs.readFileSync(protectedRoutePath, 'utf8');
  assert.ok(protectedRouteContent.includes('UnauthorizedPage'), 'ProtectedRoute must route unauthorized users to UnauthorizedPage');
  assert.ok(protectedRouteContent.includes('isNtroAnalyst'), 'ProtectedRoute must verify isNtroAnalyst');
});

test('5. Route Segregation: routes.tsx mounts PublicShell on public routes and ProtectedRoute on console', () => {
  const routesPath = path.join(SRC_DIR, 'app', 'routes.tsx');
  assert.ok(fs.existsSync(routesPath), 'routes.tsx must exist');

  const routesContent = fs.readFileSync(routesPath, 'utf8');
  assert.ok(routesContent.includes('<PublicShell'), 'routes.tsx must mount PublicShell');
  assert.ok(routesContent.includes('<NtroShell'), 'routes.tsx must mount NtroShell');
  assert.ok(routesContent.includes('path="console"'), 'routes.tsx must register /console path');
  assert.ok(routesContent.includes('requiredRole="ntro_analyst"'), 'routes.tsx must protect console with ntro_analyst requirement');
  assert.ok(routesContent.includes('path="unauthorized"'), 'routes.tsx must register /unauthorized path');
});

test('6. Static Security Audit: UserMenu adheres to zero-spoofing constraints', () => {
  const userMenuPath = path.join(SRC_DIR, 'components', 'navigation', 'UserMenu.tsx');
  const userMenuContent = fs.readFileSync(userMenuPath, 'utf8');

  // Must never contain hardcoded fake clearance or role text
  assert.ok(!userMenuContent.includes('CLEARANCE LEVEL-4'), 'UserMenu must not contain CLEARANCE LEVEL-4');
  assert.ok(!userMenuContent.includes('NTRO Analyst'), 'UserMenu must not contain fake NTRO Analyst text');
  assert.ok(userMenuContent.includes('useRole'), 'UserMenu must consume useRole hook');
});
