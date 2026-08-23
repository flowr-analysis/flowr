import { FlowrAnalyzerPackageVersionsPlugin } from './flowr-analyzer-package-versions-plugin';
import { SemVer } from 'semver';
import { Package } from './package';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { FileRole } from '../../context/flowr-file';
import { log } from '../../../util/log';

export const namespaceFileLog = log.getSubLogger({ name: 'flowr-analyzer-package-versions-namespace-file-plugin' });

export class FlowrAnalyzerPackageVersionsNamespaceFilePlugin extends FlowrAnalyzerPackageVersionsPlugin {
	public readonly name = 'flowr-analyzer-package-version-namespace-file-plugin';
	public readonly description = 'Extracts package versions from NAMESPACE files.';
	public readonly version = new SemVer('0.1.0');

	process(ctx: FlowrAnalyzerContext): void {
		const nmspcFiles = ctx.files.getFilesByRole(FileRole.Namespace);
		if(nmspcFiles.length === 0) {
			namespaceFileLog.debug('No namespace file found, cannot extract package versions.');
			return;
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
			/* the S4 lists are exports as much as the other two, they just say *why* the name is exported */
			const exportKinds = [
				[info.exportedSymbols, {}],
				[info.exportedFunctions, {}],
				[info.exportedS4Methods, { isS4Method: true }],
				[info.exportedS4Classes, { isS4Class: true }]
			] as const;
			for(const [names, kind] of exportKinds) {
				for(const exported of names) {
					ctx.deps.functionsContext.addFunctionInfo({
						name:          exported,
						packageOrigin: pkg,
						isExported:    true,
						isS3Generic:   false,
						...kind
					});
				}
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