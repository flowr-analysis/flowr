import { LintingResultCertainty, type LintingResult, type LintingRule, LintingPrettyPrintContext, LintingRuleCertainty } from '../linter-format';
import type { MergeableRecord } from '../../util/objects';
import { Q } from '../../search/flowr-search-builder';
import { SourceLocation } from '../../util/range';
import { LintingRuleTag } from '../linter-tags';
import { FileRole } from '../../project/context/flowr-file';
import { FlowrDescriptionFile } from '../../project/plugins/file-plugins/files/flowr-description-file';

export interface SoftwareHasLicenseResult extends LintingResult {
	readonly message: string
}

export interface SoftwareHasLicenseConfig extends MergeableRecord {
	/** Whether to also inspect the DESCRIPTION file for a License field */
	readonly checkDescriptionFile: boolean
}

export type SoftwareHasLicenseMetadata = MergeableRecord;

export const SOFTWARE_HAS_LICENSE = {
	createSearch:        () => Q.fromQuery({ type: 'dependencies', enabledCategories: [] }),
	processSearchResult: (_elements, config, data) => {
		const ctx = data.analyzer.inspectContext();
		const licenseFiles = ctx.files.getFilesByRole(FileRole.License);
		let hasLicense = licenseFiles.length > 0;
		if(!hasLicense && config.checkDescriptionFile) {
			for(const f of ctx.files.getFilesByRole(FileRole.Description)) {
				if(FlowrDescriptionFile.from(f).license()) {
					hasLicense = true;
					break;
				}
			}
		}
		const results: SoftwareHasLicenseResult[] = hasLicense ? [] : [{
			certainty:  LintingResultCertainty.Certain,
			involvedId: undefined,
			loc:        SourceLocation.invalid(),
			message:    'No license found in the project'
		}];
		return { results, '.meta': {} };
	},
	prettyPrint: {
		[LintingPrettyPrintContext.Query]: (result: SoftwareHasLicenseResult) => result.message,
		[LintingPrettyPrintContext.Full]:  (result: SoftwareHasLicenseResult) => result.message
	},
	info: {
		name:          'Software Has License',
		description:   'Checks whether the software project provides a license (via a LICENSE file or the DESCRIPTION file License field).',
		tags:          [LintingRuleTag.Security, LintingRuleTag.Usability],
		certainty:     LintingRuleCertainty.BestEffort,
		defaultConfig: {
			checkDescriptionFile: true
		}
	}
} as const satisfies LintingRule<SoftwareHasLicenseResult, SoftwareHasLicenseMetadata, SoftwareHasLicenseConfig>;
