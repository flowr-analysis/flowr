import { FlowrAnalyzerPackageVersionsPlugin } from './flowr-analyzer-package-versions-plugin';
import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { FileRole } from '../../context/flowr-file';
import { MetaPriority } from '../../context/flowr-analyzer-meta-context';
import { FlowrRProjectFile, FlowrUvrManifestFile } from '../file-plugins/files/flowr-manifest-files';

/**
 * Extracts the project metadata and the declared dependencies from a project manifest. The name is contributed
 * without a namespace: such a project is no package, so `a::b` must not resolve against it.
 */
abstract class FlowrAnalyzerMetaManifestFilePlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly version = new SemVer('0.1.0');
	/** the manifest flavor this plugin reads, the others are left to their own plugin */
	protected abstract readonly reads: abstract new (...args: never[]) => object;

	process(ctx: FlowrAnalyzerContext): void {
		for(const file of ctx.files.getFilesByRole(FileRole.Manifest)) {
			if(!(file instanceof this.reads)) {
				continue;
			}
			const declares = file.declares();
			ctx.meta.contribute({
				name:     file.projectName(),
				rVersion: file.rVersion(),
				declares
			}, MetaPriority.Manifest);
			// like a `DESCRIPTION` `Suggests`, anything but the imports is reported but not needed to run the project
			for(const pkg of declares.imports ?? []) {
				ctx.deps.addDeclaredDependency(pkg);
			}
		}
	}
}

/** Reads an rv `rproject.toml`. */
export class FlowrAnalyzerMetaRProjectFilePlugin extends FlowrAnalyzerMetaManifestFilePlugin {
	public readonly name = 'flowr-analyzer-meta-rproject-file-plugin';
	public readonly description = 'Extracts project meta information and dependencies from an rproject.toml.';
	protected readonly reads = FlowrRProjectFile;
}

/** Reads a uvr `uvr.toml`, whose `[dev-dependencies]` land in `suggests`. */
export class FlowrAnalyzerMetaUvrManifestFilePlugin extends FlowrAnalyzerMetaManifestFilePlugin {
	public readonly name = 'flowr-analyzer-meta-uvr-manifest-file-plugin';
	public readonly description = 'Extracts project meta information and dependencies from a uvr.toml.';
	protected readonly reads = FlowrUvrManifestFile;
}
