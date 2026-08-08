import type { LocationMapQuery, LocationMapQueryResult } from './location-map-query-format';
import { LocationMapSpan } from './location-map-query-format';
import { RNode } from '../../../r-bridge/lang-4.x/ast/model/model';
import type { SourceRange } from '../../../util/range';
import type { BasicQueryData } from '../../base-query-format';
import type { AstIdMap, RNodeWithParent } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { isNotUndefined } from '../../../util/assert';
import { SlicingCriterion } from '../../../slicing/criterion/parse';

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

/** The range reported for a node under the requested {@link LocationMapSpan}, falling back to its own location. */
function rangeOf(node: RNodeWithParent, idMap: AstIdMap, span: LocationMapSpan): SourceRange {
	if(span === LocationMapSpan.Token) {
		return node.location as SourceRange;
	}
	const of = span === LocationMapSpan.Statement ? RNode.topLevelStatement(node, idMap) : node;
	return RNode.span(of) ?? node.location as SourceRange;
}

/**
 * Executes a location map query
 * @see {@link LocationMapQuery}
 */
export async function executeLocationMapQuery({ analyzer }: BasicQueryData, queries: readonly LocationMapQuery[]): Promise<LocationMapQueryResult> {
	const ast = await analyzer.normalize();
	const start = Date.now();
	const requested = queries.flatMap(q => q.ids ?? []);
	const criteriaOfInterest = new Set(requested.map(c => SlicingCriterion.tryParse(c, ast.idMap)).filter(isNotUndefined));
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

	const span = queries.find(q => q.span !== undefined)?.span ?? LocationMapSpan.Token;
	for(const [id, node] of ast.idMap.entries()) {
		/* asking for ids none of which resolve yields nothing, not everything */
		if(node.location && (requested.length === 0 || criteriaOfInterest.has(id))) {
			const file = fuzzyFindFile(node, ast.idMap);
			locationMap.ids[id] = [
				inverseMap.get(file) ?? -1,
				rangeOf(node, ast.idMap, span)
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
