

import {
	descriptionFileLog
} from '../file-plugins/flowr-analyzer-description-file-plugin';
import { SemVer } from 'semver';
import { FlowrAnalyzerLoadingOrderPlugin } from './flowr-analyzer-loading-order-plugin';
import { SpecialFileRole } from '../../context/flowr-analyzer-files-context';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';

export class FlowrAnalyzerLoadingOrderDescriptionFilePlugin extends FlowrAnalyzerLoadingOrderPlugin {
	public readonly name = 'flowr-analyzer-package-version-description-file-plugin';
	public readonly description = 'This plugin determines loading order based on the Collate field in DESCRIPTION files.';
	public readonly version = new SemVer('0.1.0');

	process(ctx: FlowrAnalyzerContext): void {
		const descFiles = ctx.files.getFilesByRole(SpecialFileRole.Description);
		if(descFiles.length !== 1) {
			descriptionFileLog.warn(`Supporting only exactly one DESCRIPTION file, found ${descFiles.length}`);
			return;
		}

		/** this will do the caching etc. for me */
		const deps = descFiles[0].content();
		if(deps.has('Collate')) {
			// TODO: analyzer.context().files.loadingOrder.addGuess(deps.get('Collate'))
		} else {
			descriptionFileLog.info(`No Collate field in DESCRIPTION file ${descFiles[0].path().toString()}`);
		}
	}
}