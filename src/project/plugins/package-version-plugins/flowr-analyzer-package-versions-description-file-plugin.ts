import { FlowrAnalyzerPackageVersionsPlugin } from './flowr-analyzer-package-versions-plugin';
import {
	descriptionFileLog
} from '../file-plugins/flowr-analyzer-description-file-plugin';
import { SemVer } from 'semver';
import { type PackageType , Package } from './package';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { SpecialFileRole } from '../../context/flowr-file';
import type { DCF } from '../file-plugins/flowr-description-file';

const VersionRegex = /^([a-zA-Z0-9.]+)(?:\s*\(([><=~!]+)\s*([\d.]+)\))?$/;

/**
 * This plugin extracts package versions from R `DESCRIPTION` files.
 * It looks at the `Depends` and `Imports` fields to find package names and their version constraints.
 */
export class FlowrAnalyzerPackageVersionsDescriptionFilePlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name = 'flowr-analyzer-package-version-description-file-plugin';
	public readonly description = 'This plugin does...';
	public readonly version = new SemVer('0.1.0');

	process(ctx: FlowrAnalyzerContext): void {
		const descFiles = ctx.files.getFilesByRole(SpecialFileRole.Description);
		if(descFiles.length !== 1) {
			descriptionFileLog.warn(`Supporting only exactly one DESCRIPTION file, found ${descFiles.length}`);
			return;
		}

		/** this will do the caching etc. for me */
		const deps = descFiles[0].content();

		this.retrieveVersionsFromField(ctx, deps, 'Depends', 'r');
		this.retrieveVersionsFromField(ctx, deps, 'Imports', 'package');
	}

	private retrieveVersionsFromField(ctx: FlowrAnalyzerContext, file: DCF, field: string, type?: PackageType): void {
		for(const entry of file.get(field) ?? []) {
			const match = VersionRegex.exec(entry);

			if(match) {
				const [, name, operator, version] = match;

				const range = Package.parsePackageVersionRange(operator, version);
				ctx.deps.addDependency(new Package(name, type, undefined, range));
			}
		}
	}
}