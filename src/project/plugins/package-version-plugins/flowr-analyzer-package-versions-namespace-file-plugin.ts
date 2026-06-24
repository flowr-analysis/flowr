import { FlowrAnalyzerPackageVersionsPlugin } from './flowr-analyzer-package-versions-plugin';
import { SemVer } from 'semver';
import { Package } from './package';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { FileRole } from '../../context/flowr-file';
import { log } from '../../../util/log';

export const namespaceFileLog = log.getSubLogger({ name: 'flowr-analyzer-package-versions-namespace-file-plugin' });

export class FlowrAnalyzerPackageVersionsNamespaceFilePlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name = 'flowr-analyzer-package-version-namespace-file-plugin';
	public readonly description = 'This plugin extracts package versions from R NAMESPACE files.';
	public readonly version = new SemVer('0.1.0');

	process(ctx: FlowrAnalyzerContext): void {
		const nmspcFiles = ctx.files.getFilesByRole(FileRole.Namespace);
		if(nmspcFiles.length === 0) {
			namespaceFileLog.debug('No namespace file found, cannot extract package versions.');
		} else if(nmspcFiles.length > 1) {
			namespaceFileLog.warn(`Found ${nmspcFiles.length} namespace files, expected exactly one.`);
		}

		/** this will do the caching etc. for me */
		const deps = nmspcFiles[0].content();

		for(const pkg in deps) {
			const info = deps[pkg];
			ctx.deps.addDependency(new Package(
				{
					name:          pkg,
					namespaceInfo: info
				}
			));
			for(const exportedSymbol of info.exportedSymbols) {
				ctx.deps.functionsContext.addFunctionInfo({
					name:          exportedSymbol,
					packageOrigin: pkg,
					isExported:    true,
					isS3Generic:   false,
				});
			}
			for(const exportedFunction of info.exportedFunctions) {
				ctx.deps.functionsContext.addFunctionInfo({
					name:          exportedFunction,
					packageOrigin: pkg,
					isExported:    true,
					isS3Generic:   false,
				});
			}
			for(const [genericName, classes] of info.exportS3Generics.entries()) {
				for(const s3TypeDispatch of classes) {
					ctx.deps.functionsContext.addFunctionInfo({
						name:           genericName,
						packageOrigin:  pkg,
						isExported:     true,
						isS3Generic:    true,
						s3TypeDispatch: s3TypeDispatch,
					});
				}
			}
		}
	}
}