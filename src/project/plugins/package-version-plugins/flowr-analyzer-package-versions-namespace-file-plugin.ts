import { FlowrAnalyzerPackageVersionsPlugin } from './flowr-analyzer-package-versions-plugin';
import {
	descriptionFileLog
} from '../file-plugins/flowr-analyzer-description-file-plugin';
import { SemVer } from 'semver';
import { Package } from './package';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { SpecialFileRole } from '../../context/flowr-file';
import type { NAMESPACEFormat } from '../file-plugins/flowr-namespace-file';

/**
 *
 */
export class FlowrAnalyzerPackageVersionsNamespaceFilePlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name = 'flowr-analyzer-package-version-namespace-file-plugin';
	public readonly description = 'This plugin does...';
	public readonly version = new SemVer('0.1.0');

	process(ctx: FlowrAnalyzerContext): void {
		const nmspcFiles = ctx.files.getFilesByRole(SpecialFileRole.Namespace);
		if(nmspcFiles.length !== 1) {
			descriptionFileLog.warn(`Supporting only exactly one NAMESPACE file, found ${nmspcFiles.length}`);
			return;
		}

		/** this will do the caching etc. for me */
		const deps = nmspcFiles[0].content() as NAMESPACEFormat;

		for(const pkg in deps) {
			ctx.deps.addDependency(new Package(pkg, undefined, undefined, deps[pkg]));
		}
	}
}