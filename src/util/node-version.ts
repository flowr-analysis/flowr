/**
 * The node version flowR requires, taken from the `engines.node` field of the package.json so that the
 * package manager, the setup script, and the documentation all state the same thing.
 * @module
 */
import fs from 'fs';
import path from 'path';

let cached: string | undefined = undefined;

/** The `engines.node` range of the package.json, e.g. `>=22`. */
export function supportedNodeVersions(): string {
	if(cached === undefined) {
		const raw = fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf-8');
		const { engines } = JSON.parse(raw) as { engines?: { node?: string } };
		cached = engines?.node ?? '>=22';
	}
	return cached;
}

/** The oldest major node version flowR runs on, derived from {@link supportedNodeVersions}. */
export function minimumNodeMajor(): number {
	return Number(/\d+/.exec(supportedNodeVersions())?.[0] ?? 22);
}
