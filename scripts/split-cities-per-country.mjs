// Split the giant cities dataset in src/utils/cities.ts into per-country JSON files under public/cities/
// Uses src/utils/countries.ts to determine which country codes to generate.
// Run with: node scripts/split-cities-per-country.mjs

import fs from 'fs';
import path from 'path';

const root = path.resolve(process.cwd());
const citiesTsPath = path.join(root, 'src', 'utils', 'cities.ts');
const countriesTsPath = path.join(root, 'src', 'utils', 'countries.ts');
const outDir = path.join(root, 'public', 'cities');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

function extractCountries(ts) {
  // Very light parser to pick name/code pairs from the TS countries array
  const re = /\{\s*name:\s*"([^"]+)",\s*code:\s*"([A-Z]{2})"/g;
  const out = [];
  let m;
  while ((m = re.exec(ts)) !== null) {
    out.push({ name: m[1], code: m[2] });
  }
  return out;
}

function extractCitiesArray(ts) {
  // Anchor: exported const name
  const anchor = 'export const countryCitiesByName';
  const anchorIdx = ts.indexOf(anchor);
  if (anchorIdx === -1) throw new Error('Could not find exported const countryCitiesByName');
  // Find first '[' after anchor
  const idxStart = ts.indexOf('[', anchorIdx);
  if (idxStart === -1) throw new Error('Could not find opening [ after anchor');
  // Heuristic for end: find the closing '];' after start and use the ']' position
  const closeSeq = '];';
  const closeIdx = ts.lastIndexOf(closeSeq);
  if (closeIdx === -1) throw new Error('Could not find closing "];"');
  const idxEnd = closeIdx; // position of ']'
  if (idxEnd <= idxStart) throw new Error('Invalid bracket range for cities array');

  const jsonSlice = ts.slice(idxStart, idxEnd + 1);
  try {
    const data = JSON.parse(jsonSlice);
    if (!Array.isArray(data)) throw new Error('Top-level is not an array');
    return data;
  } catch (e) {
    throw new Error('Failed to parse cities JSON slice: ' + e.message);
  }
}

function main() {
  console.log('Reading countries and cities...');
  const countriesTs = readFile(countriesTsPath);
  const citiesTs = readFile(citiesTsPath);

  const countries = extractCountries(countriesTs);
  const citiesByName = extractCitiesArray(citiesTs);

  // Build lookup from country name (lower) to city list
  const nameMap = new Map();
  for (const entry of citiesByName) {
    const nm = (entry?.name || '').toString().toLowerCase();
    const list = Array.isArray(entry?.cities) ? entry.cities : [];
    if (!nm) continue;
    nameMap.set(nm, list);
  }

  ensureDir(outDir);
  let count = 0;
  for (const c of countries) {
    const list = nameMap.get(c.name.toLowerCase()) || [];
    const outPath = path.join(outDir, `${c.code.toUpperCase()}.json`);
    fs.writeFileSync(outPath, JSON.stringify(list, null, 0));
    count++;
  }
  console.log(`Wrote ${count} files to ${path.relative(root, outDir)}`);
}

main();
