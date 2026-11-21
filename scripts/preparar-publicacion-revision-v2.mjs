#!/usr/bin/env node
/**
 * Empaqueta la revisión aislada del PR 47, sin compilar ni alterar sus fuentes.
 * Uso: node scripts/preparar-publicacion-revision-v2.mjs --out /ruta/absoluta/vacia
 * El destino es la raíz que debe servir el alojamiento estático.
 */
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {
  access, lstat, mkdir, mkdtemp, readFile, readdir, realpath,
  rename, rm, rmdir, writeFile,
} from 'node:fs/promises';
import {basename, dirname, extname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = await realpath(fileURLToPath(new URL('..', import.meta.url)));
const ENTRY = 'revision-v2-portal-real.html?school=1001';
const ROOT_FILES = [
  'revision-v2-portal-real.html', 'revision-v2-embed.html', 'revision-v2-modalidad.html',
  'app.css', 'pci-orientaciones.css', 'pci-model.js',
];
const CURRICULUM_FILES = [
  ...Array.from({length:4}, (_, i) => `data/db${i + 1}.txt`),
  ...Array.from({length:5}, (_, i) => `data/rest${i + 1}.txt`),
  'data/tutoria.json',
];
// Copias locales exactas de las bibliotecas versionadas de importación/exportación.
const EXTERNAL_ASSET_FILES = [
  'assets/exceljs-4.4.0.min.js', 'assets/exceljs-4.4.0-LICENSE.txt',
  'assets/xlsx-0.18.5.full.min.js', 'assets/xlsx-0.18.5-LICENSE.txt',
];
const RUNTIME_EXTENSIONS = new Set(['.js', '.mjs', '.css', '.json', '.html']);
const ASSET_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.woff', '.woff2', '.ttf']);
const CATALOG_EXTENSIONS = new Set(['.json', '.txt']);
const VENDOR_EXTENSIONS = new Set([...RUNTIME_EXTENSIONS, ...ASSET_EXTENSIONS, '.txt', '.md']);
const INDEX = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="refresh" content="0;url=${ENTRY}">
  <title>Matriz PCI · Revisión PR 47</title>
</head>
<body><a href="${ENTRY}">Abrir la revisión de Matriz PCI</a></body>
</html>
`;

function inside(path, directory) {
  const rel = relative(directory, path);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

async function exists(path) {
  try { await lstat(path); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function collect(directory, extensions, files) {
  for (const entry of (await readdir(join(ROOT, directory), {withFileTypes:true})).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
    if (entry.name.startsWith('.') || /^(?:node_modules|tests?|test-artifacts|backups?|supabase)$/.test(entry.name)) continue;
    const path = `${directory}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`No se publican enlaces simbólicos: ${path}`);
    if (entry.isDirectory()) await collect(path, extensions, files);
    else if (entry.isFile() && extensions.has(extname(entry.name)) && !/\.(?:test|spec)\.[cm]?js$/.test(entry.name)) files.add(path);
  }
}

async function validateDestination(raw) {
  if (!raw || !isAbsolute(raw)) throw new Error('--out requiere una ruta absoluta.');
  const out = resolve(raw);
  if (['/', '/workspace', '/workspace/sites', '/tmp', '/var/tmp'].includes(out)) {
    throw new Error('El destino debe ser un directorio exclusivo para esta distribución.');
  }
  if (inside(out, ROOT) || inside(ROOT, out)) throw new Error('El destino debe estar fuera del repositorio y de sus directorios superiores.');
  await mkdir(dirname(out), {recursive:true});
  const canonical = join(await realpath(dirname(out)), basename(out));
  if (inside(canonical, ROOT) || inside(ROOT, canonical)) throw new Error('El destino resuelve a un directorio del repositorio.');
  if (await exists(out)) {
    const stat = await lstat(out);
    if (!stat.isDirectory() || stat.isSymbolicLink() || (await readdir(out)).length) {
      throw new Error('El destino debe estar vacío o no existir; no se borrará su contenido.');
    }
  }
  return out;
}

async function packageRevision(out) {
  const files = new Set([...ROOT_FILES, ...CURRICULUM_FILES, ...EXTERNAL_ASSET_FILES]);
  await collect('src', RUNTIME_EXTENSIONS, files);
  await collect('assets', ASSET_EXTENSIONS, files);
  await collect('vendor/pci-sec-aprende-v2', VENDOR_EXTENSIONS, files);
  await collect('data/integracion-curricular/referencia-v2', CATALOG_EXTENSIONS, files);
  await collect('data/tecnica', CATALOG_EXTENSIONS, files);
  // Se conservan recursos técnicos; sus antiguas páginas de acceso no se publican.
  await collect('tecnica', new Set(['.js', '.css', '.json', '.txt']), files);

  for (const path of files) {
    if (/school\d+-seed|(?:^|\/)(?:supabase|tests?|test-artifacts|backups?)(?:\/|$)/i.test(path)) {
      throw new Error(`Archivo ajeno a la revisión estática: ${path}`);
    }
    const stat = await lstat(join(ROOT, path));
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`La fuente no es un archivo regular: ${path}`);
    await access(join(ROOT, path), constants.R_OK);
  }

  // La página debe conservar la simulación antes del módulo de acceso del portal.
  const portal = await readFile(join(ROOT, ROOT_FILES[0]), 'utf8');
  const mockPosition = portal.indexOf('src/preview-pr47-mock.js');
  const accessPosition = portal.indexOf('src/orientaciones-online.mjs');
  if (mockPosition < 0 || accessPosition < mockPosition || !portal.includes('src/preview-pr47-revision-v2.mjs')) {
    throw new Error('La entrada de revisión no tiene conectada su simulación completa.');
  }
  if (!files.has('src/preview-pr47-revision-v2.mjs')) throw new Error('Falta el módulo exclusivo de revisión.');

  // Las rutas dinámicas de las modalidades están declaradas por el motor original.
  const manifest = JSON.parse(await readFile(join(ROOT, 'src/v2-familia/manifiesto-paridad-v2.json'), 'utf8'));
  for (const module of manifest.modulos) {
    for (const path of Object.values(module.archivos || {}).filter(Boolean)) {
      if (!files.has(path)) throw new Error(`Falta un módulo de la modalidad: ${path}`);
    }
  }

  const staging = await mkdtemp(join(dirname(out), `.${basename(out)}-stage-`));
  try {
    const hashes = [];
    let bytes = Buffer.byteLength(INDEX);
    for (const path of [...files].sort()) {
      const content = await readFile(join(ROOT, path));
      const target = join(staging, path);
      await mkdir(dirname(target), {recursive:true});
      // Copiamos el mismo buffer que se verifica: ningún transformador modifica V2.
      await writeFile(target, content, {flag:'wx'});
      hashes.push(`${path}\0${createHash('sha256').update(content).digest('hex')}\n`);
      bytes += content.length;
    }
    await writeFile(join(staging, 'index.html'), INDEX, {flag:'wx'});
    hashes.push(`index.html\0${createHash('sha256').update(INDEX).digest('hex')}\n`);
    const contentHash = createHash('sha256').update(hashes.join('')).digest('hex');
    const metadata = {version:'revision-pr47/1', entrada:ENTRY, archivos:files.size + 1, sha256:contentHash};
    await writeFile(join(staging, 'revision-publicada.json'), JSON.stringify(metadata, null, 2) + '\n', {flag:'wx'});
    // rmdir rechaza un destino al que otro proceso haya agregado archivos.
    if (await exists(out)) await rmdir(out);
    await rename(staging, out);
    return {out, ...metadata, bytes};
  } catch (error) {
    await rm(staging, {recursive:true, force:true});
    throw error;
  }
}

try {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--out') throw new Error('Uso: node scripts/preparar-publicacion-revision-v2.mjs --out /ruta/absoluta/vacia');
  const out = await validateDestination(args[1]);
  console.log(JSON.stringify(await packageRevision(out), null, 2));
} catch (error) {
  console.error(`No se pudo preparar la revisión: ${error.message}`);
  process.exitCode = 1;
}
