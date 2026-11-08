import { FlowrAnalyzerPackageVersionsPlugin } from './flowr-analyzer-package-versions-plugin';
import { SemVer } from 'semver';
import { Package } from './package';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { type FlowrFileProvider, FileRole } from '../../context/flowr-file';
import { RPath } from '../../../util/files';
import { log } from '../../../util/log';
import { parse as parseToml } from 'smol-toml';
import { MetaPriority } from '../../context/flowr-analyzer-meta-context';
import { parseDCFRecords } from '../file-plugins/files/flowr-description-file';

export const lockfileLog = log.getSubLogger({ name: 'flowr-analyzer-package-versions-lockfile-plugin' });

/** The {@link FileRole.VirtualEnv} lockfiles named `name` (e.g. `renv.lock`), matched case-insensitively like the role is assigned. */
function virtualEnvFiles(ctx: FlowrAnalyzerContext, name: string | RegExp): FlowrFileProvider[] {
	return ctx.files.getFilesByRole(FileRole.VirtualEnv).filter(f => {
		const base = RPath.basename(f.path());
		return typeof name === 'string' ? base.toLowerCase() === name : name.test(base);
	});
}

/** Declares the dependency `name` pinned to the given `version`. */
export function pin(ctx: FlowrAnalyzerContext, name: string, version: string): void {
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

/** Reads package versions from a `packrat.lock` (multi-record DCF, metadata first). packrat pins are exact. */
export class FlowrAnalyzerPackageVersionsPackratPlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name        = 'flowr-analyzer-package-versions-packrat-plugin';
	public readonly description = 'Extracts package versions from a packrat.lock lockfile.';
	public readonly version     = new SemVer('0.1.0');

	public process(ctx: FlowrAnalyzerContext): void {
		for(const file of virtualEnvFiles(ctx, 'packrat.lock')) {
			for(const record of parseDCFRecords(file)) {
				const rVersion = record.get('RVersion')?.[0];
				if(rVersion) {
					ctx.meta.contribute({ rVersion }, MetaPriority.Lockfile);
				}
				const name = record.get('Package')?.[0];
				const version = record.get('Version')?.[0];
				if(name && version) {
					pin(ctx, name, version);
				}
			}
		}
	}
}

/**
 * Reads every TOML lockfile called `fileName`: contributes the R version it states and pins each `name`/`version`
 * pair it lists. `read` says where that lockfile's dialect keeps the two, which is all they differ in.
 */
function pinFromTomlLock<Lock>(ctx: FlowrAnalyzerContext, fileName: string | RegExp, read: (lock: Lock) => { rVersion: unknown, packages: unknown }): void {
	for(const file of virtualEnvFiles(ctx, fileName)) {
		let lock: Lock;
		try {
			lock = parseToml(file.content().toString()) as Lock;
		} catch(e) {
			lockfileLog.warn(`Could not parse ${fileName}: ${(e as Error).message}`);
			continue;
		}
		const { rVersion, packages } = read(lock);
		if(typeof rVersion === 'string') {
			ctx.meta.contribute({ rVersion }, MetaPriority.Lockfile);
		}
		for(const pkg of Array.isArray(packages) ? packages : []) {
			const { name, version } = pkg as { name?: unknown, version?: unknown };
			if(typeof name === 'string' && typeof version === 'string') {
				pin(ctx, name, version);
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
		pinFromTomlLock<RvLock>(ctx, 'rv.lock', lock => ({ rVersion: lock.r_version, packages: lock.packages }));
	}
}

/** The parts of a `uvr.lock` we read, see https://github.com/nbafrank/uvr */
interface UvrLock {
	r?:       { version?: unknown };
	package?: unknown;
}

/** Reads package versions from a `uvr.lock` (TOML). uvr pins are exact, the dev-dependencies among them. */
export class FlowrAnalyzerPackageVersionsUvrPlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name        = 'flowr-analyzer-package-versions-uvr-plugin';
	public readonly description = 'Extracts package versions from a uvr.lock lockfile.';
	public readonly version     = new SemVer('0.1.0');

	public process(ctx: FlowrAnalyzerContext): void {
		pinFromTomlLock<UvrLock>(ctx, 'uvr.lock', lock => ({ rVersion: lock.r?.version, packages: lock.package }));
	}
}

/** The parts of a rig `rproj.lock` (or a script's `<script>.R.lock`) we read, see `src/rproj.rs` of rig */
interface RigPackage {
	package?: unknown;
	version?: unknown;
}

interface RigTarget {
	r_version?: unknown;
	packages?:  readonly RigPackage[];
}

interface RigLock {
	targets?: readonly RigTarget[];
}

/** a rig lockfile: the project's `rproj.lock`, or `analysis.R.lock` beside the script `analysis.R` */
export const RigLockFilePattern = /^(rproj|.+\.r)\.lock$/i;

/**
 * Reads package versions from a rig lockfile (TOML). rig solves one target per R version and platform, and the
 * targets may pin a package (or R) differently, so only what all targets listing it agree on is a pin.
 */
export class FlowrAnalyzerPackageVersionsRigPlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name        = 'flowr-analyzer-package-versions-rig-plugin';
	public readonly description = 'Extracts package versions from a rig rproj.lock or script lockfile.';
	public readonly version     = new SemVer('0.1.0');

	public process(ctx: FlowrAnalyzerContext): void {
		pinFromTomlLock<RigLock>(ctx, RigLockFilePattern, lock => {
			const targets: readonly RigTarget[] = Array.isArray(lock.targets) ? lock.targets as readonly RigTarget[] : [];
			const versions = new Map<unknown, Set<unknown>>();
			for(const p of targets.flatMap((t): readonly RigPackage[] => Array.isArray(t.packages) ? t.packages as readonly RigPackage[] : [])) {
				(versions.get(p.package) ?? versions.set(p.package, new Set()).get(p.package))?.add(p.version);
			}
			const rVersions = new Set(targets.map(t => t.r_version));
			return {
				rVersion: rVersions.size === 1 ? [...rVersions][0] : undefined,
				packages: [...versions].filter(([, vs]) => vs.size === 1).map(([name, vs]) => ({ name, version: [...vs][0] }))
			};
		});
	}
}
