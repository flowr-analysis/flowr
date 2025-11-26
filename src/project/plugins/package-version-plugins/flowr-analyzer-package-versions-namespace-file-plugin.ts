import { FlowrAnalyzerPackageVersionsPlugin } from './flowr-analyzer-package-versions-plugin';
import {
	descriptionFileLog
} from '../file-plugins/flowr-analyzer-description-file-plugin';
import { SemVer } from 'semver';
import { Package } from './package';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { FileRole } from '../../context/flowr-file';
import type { NamespaceFormat } from '../file-plugins/flowr-namespace-file';

export class FlowrAnalyzerPackageVersionsNamespaceFilePlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name = 'flowr-analyzer-package-version-namespace-file-plugin';
	public readonly description = 'This plugin does...';
	public readonly version = new SemVer('0.1.0');

	process(ctx: FlowrAnalyzerContext): void {
		const nmspcFiles = ctx.files.getFilesByRole(FileRole.Namespace);
		if(nmspcFiles.length !== 1) {
			descriptionFileLog.warn(`Supporting only exactly one NAMESPACE file, found ${nmspcFiles.length}`);
			return;
		}

		/** this will do the caching etc. for me */
		const deps = nmspcFiles[0].content() as NamespaceFormat;

		for(const pkg in deps) {
			const info = deps[pkg];
			ctx.deps.addDependency(new Package(
				{
					name:          pkg,
					namespaceInfo: info
				}
			));
			for(const exportedSymbol of info.exportedSymbols) {
				ctx.functions.addFunctionInfo({
					name:          exportedSymbol,
					packageOrigin: pkg,
					isExported:    true,
					isS3Generic:   false,
				});
			}
			for(const exportedFunction of info.exportedFunctions) {
				ctx.functions.addFunctionInfo({
					name:          exportedFunction,
					packageOrigin: pkg,
					isExported:    true,
					isS3Generic:   false,
				});
			}
			for(const [genericName, classes] of info.exportS3Generics.entries()) {
				for(const className of classes) {
					ctx.functions.addFunctionInfo({
						name:          genericName,
						packageOrigin: pkg,
						isExported:    true,
						isS3Generic:   true,
						className:     className,
					});
				}
			}
		}
	}
}