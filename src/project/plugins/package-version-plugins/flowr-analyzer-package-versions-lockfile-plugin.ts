import { FlowrAnalyzerPackageVersionsPlugin } from './flowr-analyzer-package-versions-plugin';
import { SemVer } from 'semver';
import { Package } from './package';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { type FlowrFileProvider, FileRole } from '../../context/flowr-file';
import { platformBasename } from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';
import { log } from '../../../util/log';
import { parse as parseToml } from 'smol-toml';
import { MetaPriority } from '../../context/flowr-analyzer-meta-context';

export const lockfileLog = log.getSubLogger({ name: 'flowr-analyzer-package-versions-lockfile-plugin' });

/** The {@link FileRole.VirtualEnv} lockfiles named `name` (e.g. `renv.lock`), collected by role like the DESCRIPTION reader. */
function virtualEnvFiles(ctx: FlowrAnalyzerContext, name: string): FlowrFileProvider[] {
	return ctx.files.getFilesByRole(FileRole.VirtualEnv).filter(f => platformBasename(f.path()) === name);
}

function pin(ctx: FlowrAnalyzerContext, name: string, version: string): void {
	const range = Package.parsePkgVersionRange(undefined, version);
	ctx.deps.addDeclaredDependency(new Package({ name, versionConstraints: range ? [range] : undefined }));
}

/** Reads package versions from an `renv.lock` (JSON). renv pins are exact. */
export class FlowrAnalyzerPackageVersionsRenvPlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name        = 'flowr-analyzer-package-versions-renv-plugin';
	public readonly description = 'Extracts package versions from an renv.lock lockfile.';
	public readonly version     = new SemVer('0.1.0');

	public process(ctx: FlowrAnalyzerContext): void {
		for(const file of virtualEnvFiles(ctx, 'renv.lock')) {
			let lock: { Packages?: Record<string, { Version?: string }> };
			try {
				lock = JSON.parse(file.content().toString()) as typeof lock;
			} catch(e) {
				lockfileLog.warn(`Could not parse renv.lock: ${(e as Error).message}`);
				continue;
			}
			for(const [pkg, meta] of Object.entries(lock.Packages ?? {})) {
				if(typeof meta?.Version === 'string') {
					pin(ctx, pkg, meta.Version);
				}
			}
		}
	}
}

/** Unlike a `DESCRIPTION`, a `packrat.lock` holds one record per package, so the records must not be merged. */
function parseDCFRecords(content: string): Map<string, string>[] {
	const records: Map<string, string>[] = [];
	let current = new Map<string, string>();
	let key: string | undefined;
	for(const line of content.split(/\r?\n/)) {
		if(line.trim().length === 0) {
			if(current.size > 0) {
				records.push(current);
				current = new Map();
			}
			key = undefined;
		} else if(/^\s/.test(line) && key !== undefined) {
			current.set(key, `${current.get(key) ?? ''} ${line.trim()}`);
		} else {
			const colon = line.indexOf(':');
			if(colon < 0) {
				continue;
			}
			key = line.slice(0, colon).trim();
			current.set(key, line.slice(colon + 1).trim());
		}
	}
	if(current.size > 0) {
		records.push(current);
	}
	return records;
}

/** Reads package versions from a `packrat.lock` (multi-record DCF, metadata first). packrat pins are exact. */
export class FlowrAnalyzerPackageVersionsPackratPlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name        = 'flowr-analyzer-package-versions-packrat-plugin';
	public readonly description = 'Extracts package versions from a packrat.lock lockfile.';
	public readonly version     = new SemVer('0.1.0');

	public process(ctx: FlowrAnalyzerContext): void {
		for(const file of virtualEnvFiles(ctx, 'packrat.lock')) {
			for(const record of parseDCFRecords(file.content().toString())) {
				const rVersion = record.get('RVersion');
				if(rVersion) {
					ctx.meta.contribute({ rVersion }, MetaPriority.Lockfile);
				}
				const name = record.get('Package');
				const version = record.get('Version');
				if(name && version) {
					pin(ctx, name, version);
				}
			}
		}
	}
}

/** The parts of an `rv.lock` we read, see https://a2-ai.github.io/rv-docs/ */
interface RvLock {
	r_version?: unknown;
	packages?:  unknown;
}

/** Reads package versions from an `rv.lock` (the resolved rv project lockfile, TOML). rv pins are exact. */
export class FlowrAnalyzerPackageVersionsRvPlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name        = 'flowr-analyzer-package-versions-rv-plugin';
	public readonly description = 'Extracts package versions from an rv.lock lockfile.';
	public readonly version     = new SemVer('0.1.0');

	public process(ctx: FlowrAnalyzerContext): void {
		for(const file of virtualEnvFiles(ctx, 'rv.lock')) {
			let lock: RvLock;
			try {
				lock = parseToml(file.content().toString()) as RvLock;
			} catch(e) {
				lockfileLog.warn(`Could not parse rv.lock: ${(e as Error).message}`);
				continue;
			}
			if(typeof lock.r_version === 'string') {
				ctx.meta.contribute({ rVersion: lock.r_version }, MetaPriority.Lockfile);
			}
			for(const pkg of Array.isArray(lock.packages) ? lock.packages : []) {
				const { name, version } = pkg as { name?: unknown, version?: unknown };
				if(typeof name === 'string' && typeof version === 'string') {
					pin(ctx, name, version);
				}
			}
		}
	}
}
