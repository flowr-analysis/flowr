import { FlowrAnalyzerPackageVersionsPlugin } from './flowr-analyzer-package-versions-plugin';
import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { FileRole } from '../../context/flowr-file';
import { MetaPriority } from '../../context/flowr-analyzer-meta-context';

/**
 * Extracts the project metadata and the declared dependencies from the `rproject.toml` of an rv project.
 * The name is contributed without a namespace: an rv project is no package, so `a::b` must not resolve against it.
 */
export class FlowrAnalyzerMetaRProjectFilePlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name = 'flowr-analyzer-meta-rproject-file-plugin';
	public readonly description = 'This plugin extracts project meta information and dependencies from an rproject.toml.';
	public readonly version = new SemVer('0.1.0');

	process(ctx: FlowrAnalyzerContext): void {
		for(const file of ctx.files.getFilesByRole(FileRole.Manifest)) {
			const deps = file.dependencies();
			ctx.meta.contribute({
				name:     file.projectName(),
				rVersion: file.rVersion(),
				// rv does not group its dependencies, they are all needed to run the project
				declares: { imports: deps }
			}, MetaPriority.Manifest);
			for(const pkg of deps) {
				ctx.deps.addDeclaredDependency(pkg);
			}
		}
	}
}
