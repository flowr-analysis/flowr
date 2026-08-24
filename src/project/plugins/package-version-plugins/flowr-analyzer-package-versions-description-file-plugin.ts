import { FlowrAnalyzerPackageVersionsPlugin } from './flowr-analyzer-package-versions-plugin';
import { DescriptionFile } from '../file-plugins/flowr-analyzer-description-file-plugin';
import { SemVer } from 'semver';
import type { Package } from './package';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';


/**
 * This plugin extracts package versions from R `DESCRIPTION` files.
 * It looks at the `Depends` and `Imports` fields to find package names and their version constraints.
 */
export class FlowrAnalyzerPackageVersionsDescriptionFilePlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name = 'flowr-analyzer-package-version-description-file-plugin';
	public readonly description = 'Extracts package versions from DESCRIPTION files.';
	public readonly version = new SemVer('0.1.0');

	process(ctx: FlowrAnalyzerContext): void {
		const deps = DescriptionFile.single(ctx, 'No description file found, cannot extract package versions.');
		if(deps === undefined) {
			return;
		}

		this.retrieveVersionsFromField(ctx, deps.depends() ?? []);
		this.retrieveVersionsFromField(ctx, deps.imports() ?? []);
	}

	private retrieveVersionsFromField(ctx: FlowrAnalyzerContext, pkgs: readonly Package[]): void {
		for(const pkg of pkgs) {
			ctx.deps.addDeclaredDependency(pkg);
		}
	}
}