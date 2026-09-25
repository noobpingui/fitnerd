// Tests de la guardia SDD. Ejecutar desde la raíz del repo: node --test .claude/hooks/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decideWrite, decideShell, gitSubcommands, isProd, isTest } from './sdd-guard.mjs';

const ROOT = path.resolve('/repo');
const FEATURE = 'specs/001-demo';

function ctx({ stage = 'spec', approvals = {}, branch = 'feat/001-demo', bypass = false, noState = false } = {}) {
  return {
    projectDir: ROOT,
    branch,
    bypass,
    readState: (fdir) => (noState || fdir !== FEATURE ? null : { stage, approvals }),
  };
}
const write = (agent, rel, c) =>
  decideWrite({ agent_type: agent, tool_input: { file_path: path.join(ROOT, rel) } }, c);
const shell = (agent, command) => decideShell({ agent_type: agent, tool_input: { command } });
const APPROVED = { spec: { at: 'x' }, plan: { at: 'x' } };

// ---- clasificación de rutas ----
test('clasifica tests y producción', () => {
  assert.ok(isTest('backend/tests/test_services/test_x.py'));
  assert.ok(isTest('frontend/src/features/a/B.test.tsx'));
  assert.ok(isProd('backend/services/x_service.py'));
  assert.ok(isProd('frontend/src/features/a/B.tsx'));
  assert.ok(!isProd('backend/tests/conftest.py'));
  assert.ok(!isProd('frontend/README.md'));
  assert.ok(!isProd('backend/.env.example'));
});

// ---- guardia de rol ----
test('spec-writer solo escribe spec.md en la etapa spec', () => {
  assert.equal(write('spec-writer', `${FEATURE}/spec.md`, ctx()), null);
  assert.equal(write('spec-writer', `${FEATURE}/plan.md`, ctx()).decision, 'deny');
  assert.equal(write('spec-writer', 'backend/services/x.py', ctx()).decision, 'deny');
  assert.equal(write('spec-writer', `${FEATURE}/spec.md`, ctx({ stage: 'plan' })).decision, 'deny');
});

test('planner escribe plan.md y ADRs, no código', () => {
  const c = ctx({ stage: 'plan' });
  assert.equal(write('planner', `${FEATURE}/plan.md`, c), null);
  assert.equal(write('planner', 'docs/sdd/decisions/ADR-0012-algo.md', c), null);
  assert.equal(write('planner', 'backend/models/x.py', c).decision, 'deny');
});

test('test-author escribe tests pero no producción', () => {
  const c = ctx({ stage: 'tests', approvals: APPROVED });
  assert.equal(write('test-author', 'backend/tests/test_services/test_x.py', c), null);
  assert.equal(write('test-author', 'frontend/src/features/a/B.test.tsx', c), null);
  assert.equal(write('test-author', `${FEATURE}/tasks.md`, c), null);
  assert.equal(write('test-author', 'backend/services/x_service.py', c).decision, 'deny');
});

test('implementer escribe producción pero nunca tests, y solo en las etapas tests (scaffold) e implement', () => {
  const c = ctx({ stage: 'implement', approvals: APPROVED });
  assert.equal(write('implementer', 'backend/services/x_service.py', c), null);
  assert.equal(write('implementer', 'backend/.env.example', c), null);
  assert.equal(write('implementer', 'backend/tests/test_services/test_x.py', c).decision, 'deny');
  assert.equal(write('implementer', 'frontend/src/features/a/B.test.tsx', c).decision, 'deny');
  assert.equal(write('implementer', `${FEATURE}/spec.md`, c).decision, 'deny');
  assert.equal(write('implementer', 'backend/.env', c).decision, 'deny');
  assert.equal(write('implementer', 'frontend/src/lib/x.ts', ctx({ stage: 'tests', approvals: APPROVED })), null);
  assert.equal(write('implementer', 'frontend/src/lib/x.test.ts', ctx({ stage: 'tests', approvals: APPROVED })).decision, 'deny');
  assert.equal(write('implementer', 'backend/services/x.py', ctx({ stage: 'tasks', approvals: APPROVED })).decision, 'deny');
  assert.equal(write('implementer', 'backend/services/x.py', ctx({ stage: 'review', approvals: APPROVED })).decision, 'deny');
});

test('verifier, reviewer y doc-keeper solo escriben sus artefactos', () => {
  assert.equal(write('verifier', `${FEATURE}/state.json`, ctx({ stage: 'verify' })), null);
  assert.equal(write('verifier', `${FEATURE}/verify-report.md`, ctx({ stage: 'tests' })), null);
  assert.equal(write('verifier', 'backend/services/x.py', ctx({ stage: 'verify', approvals: APPROVED })).decision, 'deny');
  assert.equal(write('reviewer', `${FEATURE}/review.md`, ctx({ stage: 'review' })), null);
  assert.equal(write('reviewer', 'frontend/src/App.tsx', ctx({ stage: 'review' })).decision, 'deny');
  assert.equal(write('doc-keeper', 'README.md', ctx({ stage: 'docs' })), null);
  assert.equal(write('doc-keeper', 'docs/api.md', ctx({ stage: 'docs' })), null);
  assert.equal(write('doc-keeper', 'CLAUDE.md', ctx({ stage: 'docs' })), null);
  assert.equal(write('reviewer', 'CLAUDE.md', ctx({ stage: 'review' })).decision, 'deny');
  assert.equal(write('doc-keeper', 'docs/sdd/decisions/ADR-0001-orquestacion.md', ctx({ stage: 'docs' })).decision, 'deny');
});

test('un agente SDD fuera de una rama de feature queda bloqueado', () => {
  assert.equal(write('spec-writer', `${FEATURE}/spec.md`, ctx({ branch: 'main' })).decision, 'deny');
  assert.equal(write('spec-writer', `${FEATURE}/spec.md`, ctx({ noState: true })).decision, 'deny');
});

// ---- guardia de etapa (sesión principal) ----
test('la sesión principal no edita producción sin la spec y el plan aprobados', () => {
  assert.equal(write(null, 'backend/services/x.py', ctx({ branch: 'main' })).decision, 'deny');
  assert.equal(write(null, 'backend/services/x.py', ctx({ stage: 'plan', approvals: { spec: { at: 'x' } } })).decision, 'deny');
  assert.equal(write(null, 'backend/services/x.py', ctx({ stage: 'implement', approvals: APPROVED })), null);
});

test('SDD_BYPASS=1 abre la guardia de etapa, pero no la de rol', () => {
  assert.equal(write(null, 'backend/services/x.py', ctx({ branch: 'main', bypass: true })), null);
  assert.equal(write('test-author', 'backend/services/x.py', ctx({ stage: 'tests', approvals: APPROVED, bypass: true })).decision, 'deny');
});

test('la sesión principal edita libremente fuera del código de producción', () => {
  assert.equal(write(null, '.claude/sdd/protocol.md', ctx({ branch: 'chore/sdd-harness' })), null);
  assert.equal(write(null, `${FEATURE}/state.json`, ctx()), null);
  assert.equal(write(null, 'backend/tests/test_x.py', ctx({ branch: 'main' })), null);
});

test('otros subagentes no tocan un .env real', () => {
  assert.equal(write('general-purpose', '.env', ctx()).decision, 'deny');
});

// ---- guardia de git ----
test('detecta subcomandos git con opciones globales', () => {
  assert.deepEqual(gitSubcommands('git -C backend commit -m x'), ['commit']);
  assert.deepEqual(gitSubcommands('npm test && git push origin feat/001-demo'), ['push']);
  assert.deepEqual(gitSubcommands('git status; git diff main...HEAD'), ['status', 'diff']);
  assert.deepEqual(gitSubcommands('npm run build'), []);
});

test('la sesión principal: commit y push piden confirmación; el resto pasa', () => {
  assert.equal(shell(null, 'git commit -m "x"').decision, 'ask');
  assert.equal(shell(null, 'git push -u origin feat/001-demo').decision, 'ask');
  assert.equal(shell(null, 'git status --short'), null);
  assert.equal(shell(null, 'git checkout -b feat/001-demo'), null);
});

test('los subagentes solo usan git de lectura', () => {
  assert.equal(shell('verifier', 'git diff --name-only main...HEAD'), null);
  assert.equal(shell('reviewer', 'git log --oneline main..HEAD'), null);
  assert.equal(shell('verifier', 'git branch --show-current'), null);
  assert.equal(shell('implementer', 'git commit -am x').decision, 'deny');
  assert.equal(shell('test-author', 'npm test && git push').decision, 'deny');
  assert.equal(shell('implementer', 'git stash').decision, 'deny');
  assert.equal(shell('Explore', 'git checkout main').decision, 'deny');
  assert.equal(shell('implementer', 'npm test'), null);
});

// ---- protocolo real stdin → stdout ----
test('el proceso responde con JSON de hook válido', () => {
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'sdd-guard.mjs');
  const run = (mode, payload) => spawnSync(process.execPath, [script, mode], { input: JSON.stringify(payload), encoding: 'utf8' });

  const ask = run('shell', { tool_input: { command: 'git push' } });
  assert.equal(ask.status, 0);
  assert.equal(JSON.parse(ask.stdout).hookSpecificOutput.permissionDecision, 'ask');

  const none = run('shell', { tool_input: { command: 'ls' } });
  assert.equal(none.status, 0);
  assert.equal(none.stdout, '');

  const broken = spawnSync(process.execPath, [script, 'write'], { input: '{no es json', encoding: 'utf8' });
  assert.equal(broken.status, 0, 'un error interno no debe romper la sesión principal');
});
