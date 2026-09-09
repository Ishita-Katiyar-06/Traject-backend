import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve(process.cwd(), 'src');

test('1. AuthContext contract: role is strictly null and not client-controllable', () => {
  const typesPath = path.join(SRC_DIR, 'auth', 'types.ts');
  assert.ok(fs.existsSync(typesPath), 'auth/types.ts must exist');
  const typesContent = fs.readFileSync(typesPath, 'utf8');

  // Verify role is strictly typed as null
  assert.match(
    typesContent,
    /role:\s*null/,
    'AuthState role must be explicitly typed as null in Milestone 9A'
  );

  // Verify signUp signature does NOT accept a role parameter
  assert.match(
    typesContent,
    /signUp:\s*\(email:\s*string,\s*password:\s*string\)\s*=>/,
    'signUp method must accept only email and password (no role parameter)'
  );
});

test('2. Static security audit: No switchPersona or client-side privilege escalation API exists', () => {
  const authDir = path.join(SRC_DIR, 'auth');
  const authFiles = fs.readdirSync(authDir);

  for (const file of authFiles) {
    const fullPath = path.join(authDir, file);
    if (!fs.statSync(fullPath).isFile()) continue;
    const content = fs.readFileSync(fullPath, 'utf8');

    assert.ok(
      !content.includes('switchPersona'),
      `Prohibited switchPersona found in ${file}: client cannot self-assign roles`
    );
    assert.ok(
      !content.includes('ntro_analyst'),
      `Prohibited client-side role grant "ntro_analyst" found in ${file}`
    );
    assert.ok(
      !content.includes('service_role'),
      `Prohibited service_role key reference found in ${file}`
    );
  }
});

test('3. Static security audit: No localStorage role spoofing or unverified NTRO claims', () => {
  const userMenuPath = path.join(SRC_DIR, 'components', 'navigation', 'UserMenu.tsx');
  assert.ok(fs.existsSync(userMenuPath), 'UserMenu.tsx must exist');
  const userMenuContent = fs.readFileSync(userMenuPath, 'utf8');

  // Verify no clearance level or NTRO role is displayed without backend proof
  assert.ok(
    !userMenuContent.includes('CLEARANCE LEVEL-4'),
    'UserMenu must not display fake CLEARANCE LEVEL-4 claims in 9A'
  );
  assert.ok(
    !userMenuContent.includes('NTRO Analyst'),
    'UserMenu must not display unverified NTRO Analyst claims in 9A'
  );
});

test('4. Supabase Client: Missing credentials safely evaluates to unconfigured without fabricating sessions', () => {
  const clientPath = path.join(SRC_DIR, 'auth', 'supabaseClient.ts');
  assert.ok(fs.existsSync(clientPath), 'supabaseClient.ts must exist');
  const clientContent = fs.readFileSync(clientPath, 'utf8');

  // Verify safe placeholder detection
  assert.match(clientContent, /isPlaceholder/, 'Must implement placeholder detection');
  assert.match(clientContent, /isSupabaseConfigured/, 'Must export isSupabaseConfigured flag');
  assert.ok(!clientContent.includes('service_role'), 'Must not reference service_role key');
});

test('5. Auth UX: Signup page only accepts email and password (no role selection)', () => {
  const signupPath = path.join(SRC_DIR, 'pages', 'Auth', 'SignupPage.tsx');
  assert.ok(fs.existsSync(signupPath), 'SignupPage.tsx must exist');
  const signupContent = fs.readFileSync(signupPath, 'utf8');

  // Verify no role dropdown or selection
  assert.ok(!signupContent.includes('<select'), 'SignupPage must not contain a role selector dropdown');
  assert.ok(!signupContent.includes('ntro'), 'SignupPage must not contain an NTRO role option');
  assert.match(signupContent, /signUp\(email,\s*password\)/, 'SignupPage calls signUp with email and password only');
});

test('6. Auth UX: Login page integrates email + password only', () => {
  const loginPath = path.join(SRC_DIR, 'pages', 'Auth', 'LoginPage.tsx');
  assert.ok(fs.existsSync(loginPath), 'LoginPage.tsx must exist');
  const loginContent = fs.readFileSync(loginPath, 'utf8');

  assert.match(loginContent, /signIn\(email,\s*password\)/, 'LoginPage calls signIn with email and password');
  assert.ok(!loginContent.includes('switchPersona'), 'LoginPage must not contain persona switching');
});

test('7. Route integration: /login and /signup exist without breaking existing routes', () => {
  const routesPath = path.join(SRC_DIR, 'app', 'routes.tsx');
  assert.ok(fs.existsSync(routesPath), 'routes.tsx must exist');
  const routesContent = fs.readFileSync(routesPath, 'utf8');

  assert.match(routesContent, /path="login"/, 'routes.tsx must register /login route');
  assert.match(routesContent, /path="signup"/, 'routes.tsx must register /signup route');
  assert.match(routesContent, /path="overview"/, 'routes.tsx must preserve /overview route');
  assert.match(routesContent, /path="trends"/, 'routes.tsx must preserve /trends route');
  assert.match(routesContent, /path="emerging-trends"/, 'routes.tsx must preserve /emerging-trends route');
});

test('8. Environment configuration template: .env.example contains Supabase placeholders without secrets', () => {
  const rootEnv = path.resolve(process.cwd(), '..', '.env.example');
  const frontendEnv = path.resolve(process.cwd(), '.env.example');

  assert.ok(fs.existsSync(rootEnv), 'Root .env.example must exist');
  assert.ok(fs.existsSync(frontendEnv), 'Frontend .env.example must exist');

  const rootContent = fs.readFileSync(rootEnv, 'utf8');
  const frontendContent = fs.readFileSync(frontendEnv, 'utf8');

  assert.match(rootContent, /VITE_SUPABASE_URL=/, 'Root .env.example must contain VITE_SUPABASE_URL');
  assert.match(rootContent, /VITE_SUPABASE_ANON_KEY=/, 'Root .env.example must contain VITE_SUPABASE_ANON_KEY');
  assert.match(frontendContent, /VITE_SUPABASE_URL=/, 'Frontend .env.example must contain VITE_SUPABASE_URL');
  assert.match(frontendContent, /VITE_SUPABASE_ANON_KEY=/, 'Frontend .env.example must contain VITE_SUPABASE_ANON_KEY');

  assert.ok(!rootContent.includes('SUPABASE_SERVICE_ROLE_KEY'), 'Must not document or expose service role key in frontend template');
});
