import { FlowrAnalyzerPackageVersionsPlugin } from './flowr-analyzer-package-versions-plugin';
import {
	descriptionFileLog
} from '../file-plugins/flowr-analyzer-description-file-plugin';
import { SemVer } from 'semver';
import { type PackageType } from './package';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { FileRole } from '../../context/flowr-file';
import type { DCF } from '../file-plugins/files/flowr-description-file';
import { parsePackagesWithVersions } from '../file-plugins/files/flowr-description-file';
import type { DeepReadonly } from 'ts-essentials';


/**
 * This plugin extracts package versions from R `DESCRIPTION` files.
 * It looks at the `Depends` and `Imports` fields to find package names and their version constraints.
 */
export class FlowrAnalyzerPackageVersionsDescriptionFilePlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name = 'flowr-analyzer-package-version-description-file-plugin';
	public readonly description = 'This plugin does...';
	public readonly version = new SemVer('0.1.0');

	process(ctx: FlowrAnalyzerContext): void {
		const descFiles = ctx.files.getFilesByRole(FileRole.Description);
		if(descFiles.length === 0) {
			descriptionFileLog.warn('No description file found, cannot extract package versions.');
			return;
		} else if(descFiles.length > 1) {
			descriptionFileLog.warn(`Found ${descFiles.length} description files, expected exactly one.`);
		}

		/** this will do the caching etc. for me */
		const deps = descFiles[0].content();

		this.retrieveVersionsFromField(ctx, deps, 'Depends', 'r');
		this.retrieveVersionsFromField(ctx, deps, 'Imports', 'package');
	}

	private retrieveVersionsFromField(ctx: FlowrAnalyzerContext, file: DeepReadonly<DCF>, field: string, type?: PackageType): void {
		for(const pkg of parsePackagesWithVersions(file.get(field) ?? [], type)) {
			ctx.deps.addDependency(pkg);
		}
	}
}