import type {
	FileQueryInfo,
	FilesQuery,
	FilesQueryResult
} from './files-query-format';
import type { BasicQueryData } from '../../base-query-format';
import type { FileRole } from '../../../project/context/flowr-file';

/**
 * Executes the given files queries using the provided analyzer.
 */
export function executeFileQuery({ analyzer }: BasicQueryData, queries: readonly FilesQuery[]): Promise<FilesQueryResult> {
	const start = Date.now();
	analyzer.inspectContext().resolvePreAnalysis();

	const base = analyzer.inspectContext().files.getAllFiles();

	let files: FileQueryInfo[] = [];
	const foundFingerprints = new Set<string>();
	for(const query of queries) {
		if(query.matchesPathRegex === undefined && query.roles === undefined) {
			files = base.map(l => ({
				role:    l.role,
				content: l.content(),
				path:    l.path()
			}));
			break;
		}
		const pathRegex = query.matchesPathRegex ? new RegExp(query.matchesPathRegex) : undefined;
		for(const file of base) {
			const fingerprint = `${file.role}:::${file.path()}`;
			if(foundFingerprints.has(fingerprint)) {
				continue;
			}
			if(pathRegex && !pathRegex.test(file.path())) {
				continue;
			}
			if(query.roles && !query.roles.includes(file.role ?? '' as FileRole)) {
				continue;
			}
			foundFingerprints.add(fingerprint);
			files.push({
				role:    file.role,
				content: file.content(),
				path:    file.path()
			});
		}
	}

	return Promise.resolve({
		'.meta': {
			timing: Date.now() - start
		},
		files
	});
}
