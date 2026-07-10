import { FlowrAnalyzerPackageVersionsPlugin } from './flowr-analyzer-package-versions-plugin';
import { SemVer } from 'semver';
import { Package } from './package';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { type FlowrFileProvider, FileRole } from '../../context/flowr-file';
import { platformBasename } from '../../../dataflow/internal/process/functions/call/built-in/built-in-source';
import { log } from '../../../util/log';

export const lockfileLog = log.getSubLogger({ name: 'flowr-analyzer-package-versions-lockfile-plugin' });

/** The {@link FileRole.VirtualEnv} lockfiles named `name` (e.g. `renv.lock`), collected by role like the DESCRIPTION reader. */
function virtualEnvFiles(ctx: FlowrAnalyzerContext, name: string): FlowrFileProvider[] {
	return ctx.files.getFilesByRole(FileRole.VirtualEnv).filter(f => platformBasename(f.path()) === name);
}

function pin(ctx: FlowrAnalyzerContext, name: string, version: string): void {
	const range = Package.parsePackageVersionRange(undefined, version);
	ctx.deps.addDependency(new Package({ name, versionConstraints: range ? [range] : undefined }));
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

/** Reads package versions from an `rv.lock` (the resolved rv project lockfile, TOML). */
export class FlowrAnalyzerPackageVersionsRvPlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name        = 'flowr-analyzer-package-versions-rv-plugin';
	public readonly description = 'Extracts package versions from an rv.lock lockfile.';
	public readonly version     = new SemVer('0.1.0');

	public process(ctx: FlowrAnalyzerContext): void {
		for(const file of virtualEnvFiles(ctx, 'rv.lock')) {
			// rv.lock is TOML with repeated `[[packages]]` tables carrying `name`/`version`
			for(const block of file.content().toString().split(/\[\[packages\]\]/).slice(1)) {
				const name = /^\s*name\s*=\s*"([^"]+)"/m.exec(block)?.[1];
				const version = /^\s*version\s*=\s*"([^"]+)"/m.exec(block)?.[1];
				if(name && version) {
					pin(ctx, name, version);
				}
			}
		}
	}
}
