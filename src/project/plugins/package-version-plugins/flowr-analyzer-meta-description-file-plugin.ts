import { FlowrAnalyzerPackageVersionsPlugin } from './flowr-analyzer-package-versions-plugin';
import { DescriptionFile } from '../file-plugins/flowr-analyzer-description-file-plugin';
import { SemVer } from 'semver';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { MetaPriority } from '../../context/flowr-analyzer-meta-context';

/**
 * This plugin extracts package meta information from R `DESCRIPTION` files.
 */
export class FlowrAnalyzerMetaDescriptionFilePlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name = 'flowr-analyzer-meta-file-plugin';
	public readonly description = 'Extracts package meta information from DESCRIPTION files.';
	public readonly version = new SemVer('0.1.0');

	process(ctx: FlowrAnalyzerContext): void {
		const deps = DescriptionFile.single(ctx, 'No description file found, cannot extract package versions.');
		if(deps === undefined) {
			return;
		}

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
				linkingTo: deps.linkingTo(),
				enhances:  deps.enhances()
			}
		}, MetaPriority.Description);
	}
}