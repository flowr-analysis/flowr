import { log } from '../../../util/log';
import type { ProjectQuery, ProjectQueryResult } from './project-query-format';
import type { BasicQueryData } from '../../base-query-format';
import { FileRole } from '../../../project/context/flowr-file';
import type { FlowrDescriptionFile } from '../../../project/plugins/file-plugins/files/flowr-description-file';

/**
 * Executes the given project queries.
 */
export async function executeProjectQuery({ analyzer }: BasicQueryData, queries: readonly ProjectQuery[]): Promise<ProjectQueryResult> {
	if(queries.length !== 1) {
		log.warn('Project query expects only up to one query, but got', queries.length);
	}
	const withDf = queries.some(q => q.withDf);
	// we need to know what is considered by the analyzer
	if(withDf) {
		await analyzer.dataflow();
	}

	const descFile = analyzer.inspectContext().files.getFilesByRole(FileRole.Description);
	const desc: FlowrDescriptionFile | undefined = descFile[0];
	return {
		'.meta': {
			/* there is no sense in measuring a get */
			timing: 0
		},
		files:    Array.from(analyzer.inspectContext().files.consideredFilesList()),
		authors:  desc.authors(),
		encoding: desc.content().get('Encoding')?.[0],
		version:  desc.content().get('Version')?.[0],
		licenses: desc.license()
	};
}
