import { FlowrAnalyzerPackageVersionsPlugin } from './flowr-analyzer-package-versions-plugin';
import { SemVer } from 'semver';
import path from 'path';
import { Package } from './package';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { FlowrFileProvider } from '../../context/flowr-file';
import { log } from '../../../util/log';

export const lockfileLog = log.getSubLogger({ name: 'flowr-analyzer-package-versions-lockfile-plugin' });

function fileByName(ctx: FlowrAnalyzerContext, name: string): FlowrFileProvider | undefined {
	return ctx.files.getAllFiles().find(f => path.basename(f.path()) === name);
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
		const file = fileByName(ctx, 'renv.lock');
		if(!file) {
			return;
		}
		let lock: { Packages?: Record<string, { Version?: string }> };
		try {
			lock = JSON.parse(file.content().toString()) as typeof lock;
		} catch(e) {
			lockfileLog.warn(`Could not parse renv.lock: ${(e as Error).message}`);
			return;
		}
		for(const [pkg, meta] of Object.entries(lock.Packages ?? {})) {
			if(typeof meta?.Version === 'string') {
				pin(ctx, pkg, meta.Version);
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
		const file = fileByName(ctx, 'rv.lock');
		if(!file) {
			return;
		}
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
