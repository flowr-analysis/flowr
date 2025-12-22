import {
	descriptionFileLog
} from '../file-plugins/flowr-analyzer-description-file-plugin';
import { SemVer } from 'semver';
import { FlowrAnalyzerLoadingOrderPlugin } from './flowr-analyzer-loading-order-plugin';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import { FileRole } from '../../context/flowr-file';

/**
 * This plugin extracts loading order information from R `DESCRIPTION` files.
 * It looks at the `Collate` field to determine the order in which files should be loaded.
 * If no `Collate` field is present, it does nothing.
 */
export class FlowrAnalyzerLoadingOrderDescriptionFilePlugin extends FlowrAnalyzerLoadingOrderPlugin {
	public readonly name = 'flowr-analyzer-package-version-description-file-plugin';
	public readonly description = 'This plugin determines loading order based on the Collate field in DESCRIPTION files.';
	public readonly version = new SemVer('0.1.0');

	process(ctx: FlowrAnalyzerContext): void {
		const descFiles = ctx.files.getFilesByRole(FileRole.Description);
		if(descFiles.length === 0) {
			descriptionFileLog.warn('No description file found, cannot determine loading order from Collate field.');
			return;
		} else if(descFiles.length > 1) {
			descriptionFileLog.warn(`Found ${descFiles.length} description files, expected exactly one.`);
		}

		/** this will do the caching etc. for me */
		const deps = descFiles[0].content();
		if(deps.has('Collate')) {
			const collate = deps.get('Collate') ?? [];
			/* we probably have to do some more guesswork here */
			const unordered = ctx.files.loadingOrder.getUnorderedRequests();
			// sort them by their path index in the Collate field
			const sorted = unordered.slice().sort((a, b) => {
				const aPath = a.request === 'file' ? a.content : undefined;
				const bPath = b.request === 'file' ? b.content : undefined;
				const aIndex = aPath ? collate.findIndex(c => aPath.endsWith(c.trim())) : -1;
				const bIndex = bPath ? collate.findIndex(c => bPath.endsWith(c.trim())) : -1;
				if(aIndex === -1 && bIndex === -1) {
					return 0; // both not found, keep original order
				} else if(aIndex === -1) {
					return 1; // a not found, b found -> a after b
				} else if(bIndex === -1) {
					return -1; // b not found, a found -> a before b
				} else {
					return aIndex - bIndex; // both found, sort by index
				}
			});
			ctx.files.loadingOrder.addGuess(sorted, true);
		} else {
			descriptionFileLog.info(`No Collate field in DESCRIPTION file ${descFiles[0].path().toString()}`);
		}
	}
}