import type {
	FileQueryInfo,
	FilesQuery,
	FilesQueryResult
} from './files-query-format';
import type { BasicQueryData } from '../../base-query-format';

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
				roles:   l.roles,
				content: l.content(),
				path:    l.path()
			}));
			break;
		}
		const queryRoles = new Set<string>(query.roles);
		const pathRegex = query.matchesPathRegex ? new RegExp(query.matchesPathRegex) : undefined;
		for(const file of base) {
			const fingerprint = `${file.roles?.join(':')}:::${file.path()}`;
			if(foundFingerprints.has(fingerprint)) {
				continue;
			}
			if(pathRegex && !pathRegex.test(file.path())) {
				continue;
			}
			if(query.roles && !file.roles?.every(r => queryRoles.has(r))) {
				continue;
			}
			foundFingerprints.add(fingerprint);
			files.push({
				roles:   file.roles,
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
