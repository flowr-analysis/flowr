import { FlowrAnalyzerPackageVersionsPlugin } from './flowr-analyzer-package-versions-plugin';
import {
	descriptionFileLog
} from '../file-plugins/flowr-analyzer-description-file-plugin';
import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { FileRole } from '../../context/flowr-file';
import { MetaPriority } from '../../context/flowr-analyzer-meta-context';

/**
 * This plugin extracts package meta information from R `DESCRIPTION` files.
 */
export class FlowrAnalyzerMetaDescriptionFilePlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name = 'flowr-analyzer-meta-file-plugin';
	public readonly description = 'This plugin does extract package meta information from R DESCRIPTION files.';
	public readonly version = new SemVer('0.1.0');

	process(ctx: FlowrAnalyzerContext): void {
		const descFiles = ctx.files.getFilesByRole(FileRole.Description);
		if(descFiles.length === 0) {
			descriptionFileLog.debug('No description file found, cannot extract package versions.');
			return;
		} else if(descFiles.length > 1) {
			descriptionFileLog.warn(`Found ${descFiles.length} description files, expected exactly one.`);
		}

		/** this will do the caching etc. for me */
		const deps = descFiles[0];

		const pkg = deps.packageName();
		ctx.meta.contribute({
			name:      pkg,
			// a DESCRIPTION marks a real package, so its name is also the namespace `a::b` resolves against
			namespace: pkg,
			version:   deps.version(),
			title:     deps.packageTitle(),
			authors:   deps.authors(),
			encoding:  deps.content().get('Encoding')?.[0],
			licenses:  deps.license(),
			declares:  {
				imports:   deps.imports(),
				depends:   deps.depends(),
				suggests:  deps.suggests(),
				linkingTo: deps.linkingTo()
			}
		}, MetaPriority.Description);
	}
}