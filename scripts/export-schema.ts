import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { print } from 'graphql';
import { typeDefs } from '../server/schema.js';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, '..', 'schema.graphql');

writeFileSync(outPath, `${print(typeDefs)}\n`);
console.log(`Wrote SDL to ${outPath}`);
