import { FlowrAnalyzerPackageVersionsPlugin } from './flowr-analyzer-package-versions-plugin';
import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { FileRole } from '../../context/flowr-file';
import { MetaPriority } from '../../context/flowr-analyzer-meta-context';
import { type ProjectManifest, FlowrRigProjectFile, FlowrRProjectFile, FlowrUvrManifestFile, rigScriptManifest } from '../file-plugins/files/flowr-manifest-files';

/**
 * Contributes what a manifest declares: its metadata, and the packages needed to run the project. The name is
 * contributed without a namespace, such a project is no package, so `a::b` must not resolve against it.
 */
function contributeManifest(ctx: FlowrAnalyzerContext, manifest: ProjectManifest): void {
	const declares = manifest.declares();
	ctx.meta.contribute({
		name:     manifest.projectName(),
		rVersion: manifest.rVersion(),
		declares
	}, MetaPriority.Manifest);
	// like a `DESCRIPTION` `Suggests`, anything but the imports (and depends) is reported but not needed to run the project
	for(const pkg of [...declares.depends ?? [], ...declares.imports ?? []]) {
		ctx.deps.addDeclaredDependency(pkg);
	}
}

/** Extracts the project metadata and the declared dependencies from a project manifest. */
abstract class FlowrAnalyzerMetaManifestFilePlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly version = new SemVer('0.1.0');
	/** the manifest flavor this plugin reads, the others are left to their own plugin */
	protected abstract readonly reads: abstract new (...args: never[]) => object;

	process(ctx: FlowrAnalyzerContext): void {
		for(const file of ctx.files.getFilesByRole(FileRole.Manifest)) {
			if(file instanceof this.reads) {
				contributeManifest(ctx, file);
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

/** Reads a rig `rproj.toml`, whose dependency groups and optional dependencies land in `suggests`. */
export class FlowrAnalyzerMetaRigProjectFilePlugin extends FlowrAnalyzerMetaManifestFilePlugin {
	public readonly name = 'flowr-analyzer-meta-rig-project-file-plugin';
	public readonly description = 'Extracts project meta information and dependencies from a rig rproj.toml.';
	protected readonly reads = FlowrRigProjectFile;
}

/**
 * Reads the inline `# /// script` block a rig script states its dependencies in (see {@link rigScriptManifest}),
 * in R scripts and notebooks alike, as the code of a notebook is what its top is checked for.
 */
export class FlowrAnalyzerMetaRigScriptPlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name = 'flowr-analyzer-meta-rig-script-plugin';
	public readonly description = 'Extracts the dependencies a rig script declares in its inline # /// script block.';
	public readonly version = new SemVer('0.1.0');

	process(ctx: FlowrAnalyzerContext): void {
		for(const file of ctx.files.getFilesByRole(FileRole.Source)) {
			const manifest = rigScriptManifest(file.content().toString(), file.path());
			if(manifest !== undefined) {
				contributeManifest(ctx, manifest);
			}
		}
	}
}
