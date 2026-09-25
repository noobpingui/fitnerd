#!/usr/bin/env node
// Guardia SDD: hook PreToolUse de Claude Code (ADR-0008). Documentacion: docs/sdd/hooks.md
//
//   node sdd-guard.mjs write   -> Write | Edit | MultiEdit | NotebookEdit
//   node sdd-guard.mjs shell   -> Bash | PowerShell
//
// Lee el JSON del hook por stdin. Para bloquear o pedir confirmacion imprime
// { hookSpecificOutput: { permissionDecision: "deny" | "ask", ... } }.
// Si no imprime nada, se aplica el flujo normal de permisos.
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const SDD_AGENTS = [
  'spec-writer', 'planner', 'task-breaker', 'test-author',
  'implementer', 'verifier', 'reviewer', 'doc-keeper',
];

// Etapas de state.json en las que cada agente puede escribir.
export const AGENT_STAGES = {
  'spec-writer': ['spec'],
  planner: ['plan'],
  'task-breaker': ['tasks'],
  'test-author': ['tests'],
  implementer: ['tests', 'implement'], // 'tests': solo modo scaffold (ADR-0012)
  verifier: ['tests', 'verify'],
  reviewer: ['review'],
  'doc-keeper': ['docs'],
};

// Subcomandos git permitidos a un subagente (solo lectura).
const READONLY_GIT = new Set([
  'status', 'diff', 'log', 'show', 'rev-parse', 'ls-files', 'blame', 'grep',
  'merge-base', 'describe', 'cat-file', 'rev-list', 'shortlog',
]);

// ---------- clasificacion de rutas (relativas al repo, con '/') ----------
export const isTest = (rel) =>
  rel.startsWith('backend/tests/') ||
  rel.startsWith('frontend/src/test/') ||
  /^frontend\/src\/.+\.test\.[jt]sx?$/.test(rel);

export const isEnvExample = (rel) => /^((backend|frontend)\/)?\.env\.example$/.test(rel);

export const isRealEnv = (rel) => /(^|\/)\.env(\.[^/]+)?$/.test(rel) && !rel.endsWith('.env.example');

export const isProd = (rel) =>
  /^(backend|frontend)\//.test(rel) &&
  !isTest(rel) &&
  !isEnvExample(rel) &&
  !/(^|\/)README\.md$/.test(rel);

export function featureDirFromBranch(branch) {
  const m = /^(?:feat|fix)\/(\d{3}-[a-z0-9-]+)$/.exec(branch || '');
  return m ? `specs/${m[1]}` : null;
}

function allowedFor(agent, rel, fdir) {
  const f = (name) => rel === `${fdir}/${name}`;
  switch (agent) {
    case 'spec-writer': return f('spec.md');
    case 'planner': return f('plan.md') || /^docs\/sdd\/decisions\/(ADR-\d{4}-[^/]+|README)\.md$/.test(rel);
    case 'task-breaker': return f('tasks.md');
    case 'test-author': return isTest(rel) || f('tasks.md');
    case 'implementer': return isProd(rel) || isEnvExample(rel) || f('tasks.md');
    case 'verifier': return f('verify-report.md') || f('state.json');
    case 'reviewer': return f('review.md');
    case 'doc-keeper':
      return rel === 'README.md' || rel === 'frontend/README.md' || isEnvExample(rel) || f('docs-report.md') ||
        (rel.startsWith('docs/') && !rel.startsWith('docs/sdd/decisions/'));
    default: return false;
  }
}

const ALLOWED_TEXT = {
  'spec-writer': '<feature>/spec.md',
  planner: '<feature>/plan.md, docs/sdd/decisions/ADR-*.md y su README.md',
  'task-breaker': '<feature>/tasks.md',
  'test-author': 'backend/tests/**, frontend/src/**/*.test.ts(x), frontend/src/test/** y las casillas de <feature>/tasks.md',
  implementer: 'código de producción en backend/ y frontend/ (sin tests), .env.example y las casillas de <feature>/tasks.md',
  verifier: '<feature>/verify-report.md y <feature>/state.json',
  reviewer: '<feature>/review.md',
  'doc-keeper': 'README.md, frontend/README.md, .env.example, docs/** (salvo docs/sdd/decisions/) y <feature>/docs-report.md',
};

const approved = (state, stage) => Boolean(state && state.approvals && state.approvals[stage]);

// ---------- decisiones (funciones puras: testeables) ----------
// ctx = { projectDir, branch, readState(fdir) -> obj|null, bypass: bool }
// Devuelve null (sin decision) o { decision: 'deny'|'ask', reason }.
export function decideWrite(input, ctx) {
  const agent = input.agent_type || null;
  const ti = input.tool_input || {};
  const target = ti.file_path || ti.notebook_path || ti.path;
  if (!target) return null;

  const abs = path.resolve(ctx.projectDir, target);
  const rel = path.relative(ctx.projectDir, abs).split(path.sep).join('/');
  const outside = rel.startsWith('..') || path.isAbsolute(rel);
  const fdir = featureDirFromBranch(ctx.branch);
  const state = fdir ? ctx.readState(fdir) : null;

  // --- Guardia de rol y ruta: solo para agentes SDD ---
  if (SDD_AGENTS.includes(agent)) {
    const deny = (why) => ({
      decision: 'deny',
      reason: `[SDD role-guard] ${agent} no puede escribir en "${rel}": ${why}. ` +
        `Rutas permitidas para ${agent}: ${ALLOWED_TEXT[agent]}. ` +
        'Si crees que necesitas escribir ahí, termina con STATUS: NEEDS_INPUT y explícalo.',
    });
    if (outside) return deny('la ruta está fuera del repositorio');
    if (!fdir) return deny(`la rama actual "${ctx.branch}" no es una rama de feature (feat/NNN-slug o fix/NNN-slug)`);
    if (!state) return deny(`no existe ${fdir}/state.json`);
    if (!AGENT_STAGES[agent].includes(state.stage)) {
      return deny(`la etapa actual es "${state.stage}" y ${agent} solo actúa en: ${AGENT_STAGES[agent].join(', ')}`);
    }
    if (isRealEnv(rel)) return deny('los archivos .env reales nunca se editan (solo .env.example)');
    if (!allowedFor(agent, rel, fdir)) return deny('la ruta no pertenece a su rol');
    if (isProd(rel) && !(approved(state, 'spec') && approved(state, 'plan'))) {
      return deny('la spec y el plan no están aprobados en state.json');
    }
    return null;
  }

  // --- Otros subagentes (Explore, general-purpose...): no tocan .env real ---
  if (agent && isRealEnv(rel)) {
    return { decision: 'deny', reason: `[SDD role-guard] el subagente ${agent} no puede editar ${rel}.` };
  }

  // --- Guardia de etapa: sesión principal y cualquier otro agente ---
  if (!outside && isProd(rel) && !ctx.bypass) {
    const hint = 'Ejecuta el flujo (/sdd-new, /sdd-run) o, solo en un hotfix o excepción del Art. 1.2 de la ' +
      'constitución, reinicia Claude Code con SDD_BYPASS=1 (ver docs/sdd/hooks.md).';
    if (!fdir) {
      return { decision: 'deny', reason: `[SDD stage-guard] "${rel}" es código de producción y la rama "${ctx.branch}" no es una rama de feature SDD. ${hint}` };
    }
    if (!state) {
      return { decision: 'deny', reason: `[SDD stage-guard] no existe ${fdir}/state.json. ${hint}` };
    }
    if (!(approved(state, 'spec') && approved(state, 'plan'))) {
      return { decision: 'deny', reason: `[SDD stage-guard] la feature ${fdir} no tiene la spec y el plan aprobados; no se puede editar "${rel}". ${hint}` };
    }
  }
  return null;
}

// Devuelve la lista de subcomandos git presentes en un comando de shell.
export function gitSubcommands(command) {
  const re = /(?:^|[\s;&|(`{])git(?:\.exe)?((?:\s+(?:-C|-c)\s+\S+|\s+--?[\w-]+(?:=\S+)?)*)\s+([a-z][a-z-]*)/g;
  const out = [];
  let m;
  while ((m = re.exec(command || '')) !== null) out.push(m[2]);
  return out;
}

export function decideShell(input) {
  const agent = input.agent_type || null;
  const command = (input.tool_input && input.tool_input.command) || '';
  const subs = gitSubcommands(command);
  if (subs.length === 0) return null;

  if (agent) {
    const bad = subs.filter((s) => !READONLY_GIT.has(s) && !(s === 'branch' && /git\s+branch\s*(--show-current|--list\b|$|\s*[;&|])/.test(command)));
    if (bad.length) {
      return {
        decision: 'deny',
        reason: `[SDD git-guard] los subagentes solo pueden usar git de lectura (${[...READONLY_GIT].join(', ')}). ` +
          `Bloqueado: git ${bad.join(', git ')}. Los commits, pushes y cambios de rama los hace solo el orquestador, con aprobación del usuario.`,
      };
    }
    return null;
  }

  if (subs.includes('commit') || subs.includes('push')) {
    const what = subs.includes('push') ? 'push' : 'commit';
    return {
      decision: 'ask',
      reason: `[SDD git-guard] git ${what}: confirma que ya viste y aprobaste el resumen de la Regla ${what === 'push' ? 'C (ramas y commits a subir)' : 'B (archivos, resumen y mensaje)'}.`,
    };
  }
  return null;
}

// ---------- entorno real ----------
function currentBranch(projectDir) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: projectDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function readState(projectDir) {
  return (fdir) => {
    const p = path.join(projectDir, fdir, 'state.json');
    if (!existsSync(p)) return null;
    try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return { stage: '__invalid__', approvals: {} }; }
  };
}

function emit(result) {
  if (!result) return;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: result.decision,
      permissionDecisionReason: result.reason,
    },
  }));
}

function main() {
  const mode = process.argv[2];
  let input = {};
  try {
    input = JSON.parse(readFileSync(0, 'utf8') || '{}');
    const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
    if (mode === 'write') {
      emit(decideWrite(input, {
        projectDir,
        branch: currentBranch(projectDir),
        readState: readState(projectDir),
        bypass: process.env.SDD_BYPASS === '1',
      }));
    } else if (mode === 'shell') {
      emit(decideShell(input));
    }
  } catch (err) {
    // Si falla el hook: los agentes SDD se bloquean (fail-closed) y el resto de actores
    // sigue adelante con un aviso (fail-open).
    if (SDD_AGENTS.includes(input.agent_type)) {
      emit({ decision: 'deny', reason: `[SDD guard] error interno del hook (${err.message}); se bloquea por seguridad.` });
    } else {
      process.stderr.write(`[SDD guard] aviso: error interno del hook ignorado: ${err.message}\n`);
    }
  }
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
