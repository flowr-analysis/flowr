import type { LocationMapQuery, LocationMapQueryResult } from './location-map-query-format';
import type { BasicQueryData } from '../../base-query-format';
import type { AstIdMap, RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { tryResolveSliceCriterionToId } from '../../../slicing/criterion/parse';
import { isNotUndefined } from '../../../util/assert';

const fileIdRegex = /^(?<file>.*(\.[rR]))-/;

function fuzzyFindFile(node: RNodeWithParent | undefined, idMap: AstIdMap): string {
	if(node?.info.file) {
		return node.info.file;
	} else if(node?.info.id) {
		const file = fileIdRegex.exec(String(node.info.id));
		if(file && file.groups?.file.trim()) {
			return file.groups?.file.trim();
		}
	} else if(node?.info.parent) {
		const parent = idMap.get(node.info.parent);
		if(parent) {
			return fuzzyFindFile(parent, idMap);
		}
	}
	return '@inline';
}

/**
 * Executes a location map query
 * @see {@link LocationMapQuery}
 */
export async function executeLocationMapQuery({ analyzer }: BasicQueryData, queries: readonly LocationMapQuery[]): Promise<LocationMapQueryResult> {
	const ast = await analyzer.normalize();
	const start = Date.now();
	const criteriaOfInterest = new Set(queries
		.flatMap(q => q.ids ?? [])
		.map(c => tryResolveSliceCriterionToId(c, ast.idMap))
		.filter(isNotUndefined))
	;
	const locationMap: LocationMapQueryResult['map'] = {
		files: {},
		ids:   {}
	};
	let count = 0;
	const inverseMap = new Map<string, number>();
	await analyzer.dataflow(); // ensure all files are considered
	for(const file of analyzer.inspectContext().files.consideredFilesList()) {
		locationMap.files[count] = file;
		inverseMap.set(file, count);
		count++;
	}

	for(const [id, node] of ast.idMap.entries()) {
		if(node.location && (criteriaOfInterest.size === 0 || criteriaOfInterest.has(id))) {
			const file = fuzzyFindFile(node, ast.idMap);
			locationMap.ids[id] = [
				inverseMap.get(file) ?? -1,
				node.location
			];
		}
	}

	return {
		'.meta': {
			timing: Date.now() - start
		},
		map: locationMap
	};
}
