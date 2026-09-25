#!/usr/bin/env node
// Ratchet de ruff para el verifier SDD (ADR-0009).
// Compara las violaciones de ruff de cada archivo .py del backend cambiado en la rama
// entre la base (main) y el estado actual (disco). Falla SOLO si aparecen violaciones nuevas,
// asi el codigo existente (con ~145 violaciones previas) no bloquea features que lo tocan.
//
// Uso (desde la raiz del repo):  node .claude/sdd/scripts/ruff-new.mjs [base]   (por defecto: state.json.base_branch o main)
// Salida: 0 = sin violaciones nuevas · 1 = hay violaciones nuevas · 2 = error de entorno (ruff no instalado)
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
// Base: argumento explícito; si no, state.json.base_branch de la feature de la rama actual; si no, main.
function defaultBase() {
  try {
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    const m = /^(?:feat|fix)\/(\d{3}-[a-z0-9-]+)$/.exec(branch);
    if (m) return JSON.parse(readFileSync(path.join(root, 'specs', m[1], 'state.json'), 'utf8')).base_branch || 'main';
  } catch { /* sin feature activa */ }
  return 'main';
}
const base = process.argv[2] || defaultBase();
const backend = path.join(root, 'backend');

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
}

function pythonBin() {
  for (const p of ['.venv/Scripts/python.exe', '.venv/bin/python']) {
    if (existsSync(path.join(backend, p))) return path.join(backend, p);
  }
  return 'python';
}

function changedPyFiles() {
  const committed = git(['diff', '--name-only', '--diff-filter=AMR', `${base}...HEAD`]).split('\n');
  const working = git(['status', '--porcelain']).split('\n').map((l) => l.slice(3).trim());
  return [...new Set([...committed, ...working])]
    .filter((f) => /^backend\/.+\.py$/.test(f) && !f.startsWith('backend/migrations/'))
    .filter((f) => existsSync(path.join(root, f)));
}

// Ejecuta ruff sobre un contenido (stdin) haciendose pasar por `relToBackend`, con cwd=backend
// para que tome backend/pyproject.toml.
function ruff(py, content, relToBackend) {
  const r = spawnSync(py, ['-m', 'ruff', 'check', '--output-format', 'json', '--stdin-filename', relToBackend, '-'], {
    cwd: backend, input: content, encoding: 'utf8',
  });
  if (r.error || /No module named ruff/.test(r.stderr || '')) {
    console.error('ERROR DE ENTORNO: ruff no esta instalado. Ejecuta en backend/: <python> -m pip install -r requirements-dev.txt');
    process.exit(2);
  }
  return JSON.parse(r.stdout || '[]');
}

function countByCode(violations) {
  const c = {};
  for (const v of violations) c[v.code] = (c[v.code] || 0) + 1;
  return c;
}

const py = pythonBin();
const files = changedPyFiles();
let newTotal = 0;

if (files.length === 0) {
  console.log('ruff-new: no hay archivos .py del backend cambiados. OK');
  process.exit(0);
}

for (const f of files) {
  const rel = path.relative('backend', f).replace(/\\/g, '/');
  const head = ruff(py, readFileSync(path.join(root, f), 'utf8'), rel);
  let baseContent = '';
  try { baseContent = git(['show', `${base}:${f}`]); } catch { /* archivo nuevo en la rama */ }
  const before = baseContent ? countByCode(ruff(py, baseContent, rel)) : {};
  const after = countByCode(head);

  const increased = Object.keys(after).filter((code) => after[code] > (before[code] || 0));
  if (increased.length === 0) {
    console.log(`OK    ${f}  (violaciones previas toleradas: ${head.length})`);
    continue;
  }
  for (const code of increased) {
    const delta = after[code] - (before[code] || 0);
    newTotal += delta;
    console.log(`NUEVO ${f}  ${code} +${delta} (base ${before[code] || 0} -> ahora ${after[code]})`);
    for (const v of head.filter((x) => x.code === code)) {
      console.log(`        L${v.location.row}: ${v.message}`);
    }
  }
}

console.log(newTotal === 0 ? 'ruff-new: sin violaciones nuevas. OK' : `ruff-new: ${newTotal} violacion(es) nueva(s). FAIL`);
process.exit(newTotal === 0 ? 0 : 1);
