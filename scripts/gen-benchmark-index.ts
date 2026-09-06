/**
 * Writes the benchmark history page from its template so it carries the same version link as the landing page,
 * the signature browser and the playground.
 *
 * Run it with `npx ts-node --transpile-only scripts/gen-benchmark-index.ts`.
 */
import path from 'path';
import { template, writePage } from './html-page';

const Target = path.join('wiki', 'stats', 'benchmark', 'index.html');

console.log(`  wrote ${Target} (${(writePage(Target, template('benchmark-template.html')) / 1024).toFixed(1)} kB)`);
