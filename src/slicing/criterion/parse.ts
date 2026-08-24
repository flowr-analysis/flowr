import { SourceRange, type SourcePosition } from '../../util/range';
import { expensiveTrace } from '../../util/log';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type {
	AstIdMap,
	RNodeWithParent
} from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { slicerLogger } from '../static/static-slicer';
import { RArgument } from '../../r-bridge/lang-4.x/ast/model/nodes/r-argument';
import { RExpressionList } from '../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { RFunctionCall } from '../../r-bridge/lang-4.x/ast/model/nodes/r-function-call';
import { RNode } from '../../r-bridge/lang-4.x/ast/model/model';

/** An optional `(file-regex)` suffix restricting a criterion to nodes stemming from a matching file. */
type FileFilterSuffix = '' | `(${string})`;

/** see {@link SlicingCriterion.tryParse} for what each of these formats resolves to */
export type SlicingCriterion = `${number}:${number}${FileFilterSuffix}` | `${number}~${number}${FileFilterSuffix}`
	| `${number}^${FileFilterSuffix}` | `${number}@${string}` | `$${NodeId | number}`;

/**
 * The helper object associated with {@link SlicingCriterion} which makes it easy
 * to parse, validate, and resolve slicing criteria.
 */
export const SlicingCriterion = {
	name: 'SlicingCriterion',
	/**
	 * Checks whether a value has a valid slicing criterion syntax.
	 * This does not check whether the slicing criterion exists (represents a valid node ID).
	 * @see {@link SlicingCriterion.parse} to parse a slicing criterion to a node ID
	 */
	isValid(this: void, criterion: unknown): criterion is SlicingCriterion {
		if(typeof criterion !== 'string') {
			return false;
		} else if(criterion.startsWith('$')) {
			return criterion.length > 1;
		}
		/* the file filter is optional on every form, so validate what remains once it is split off */
		const split = splitFileFilter(criterion);
		return split !== undefined && /^-?\d+([:~]\d+|\^|@.+)$/.test(split.rest);
	},
	/**
	 * Resolves a slicing criterion to the corresponding node id.
	 * @see {@link SlicingCriterion.tryParse} for a version that does not throw an error
	 */
	parse(this: void, criterion: SlicingCriterion, idMap: AstIdMap): NodeId {
		const resolved = SlicingCriterion.tryParse(criterion, idMap);
		if(resolved === undefined) {
			throw new CriteriaParseError(`invalid slicing criterion ${criterion}`);
		}
		return resolved;
	},
	/**
	 * Tries to resolve a slicing criterion to an id, but does not throw an error if it fails.
	 * The formats and what each of them resolves to are documented in the
	 * {@link https://github.com/flowr-analysis/flowr/wiki/Terminology#slicing-criterion|wiki}.
	 * @see {@link SlicingCriterion.parse} for the version that throws an error
	 */
	tryParse(this: void, criterion: SlicingCriterion | NodeId, idMap: AstIdMap): NodeId | undefined {
		criterion = criterion.toString(); // in case it's a number
		if(criterion.startsWith('$')) {
			return NodeId.normalize(criterion.slice(1));
		}
		const split = splitFileFilter(criterion);
		if(split === undefined) {
			return undefined; // a malformed file filter must not silently resolve without it
		}
		const { rest: base, file } = split;
		if(base.includes('@')) {
			const at = base.indexOf('@');
			const line = parseLineNumber(base.slice(0, Math.max(0, at)), idMap, file);
			const name = base.slice(Math.max(0, at + 1));
			if(line === undefined || name.length === 0) {
				return undefined;
			}
			// an optional `[n]` prefix picks the n-th occurrence within the line (`2@[2]a`, `2@[-1]a` for the last one)
			const nth = /^\[(-?\d+)](.+)$/.exec(name);
			return nth ?
				nthOccurrenceToId(line, nth[2], idMap, parseInt(nth[1]), file) :
				nthOccurrenceToId(line, name, idMap, 1, file);
		} else if(base.includes(':')) {
			const location = parseLocation(base, ':', idMap, file);
			return location && locationToId(location, idMap, file);
		} else if(base.includes('~')) {
			const location = parseLocation(base, '~', idMap, file);
			return location && fuzzyLocationToId(location, idMap, file);
		} else if(base.endsWith('^')) {
			const line = parseLineNumber(base.slice(0, -1), idMap, file);
			return line === undefined ? undefined : topLevelStatementToId(line, idMap, file);
		}
	},
	/**
	 * Converts a node id to a slicing criterion in the form of `$id`
	 */
	fromId(this: void, id: NodeId): SlicingCriterion {
		return `$${id}`;
	}
} as const;

/** several {@link SlicingCriterion}s, all of which are sliced for at once */
export type SlicingCriteria = SlicingCriterion[];


export interface DecodedCriterion {
	criterion: SlicingCriterion,
	id:        NodeId
}

export type DecodedCriteria = ReadonlyArray<DecodedCriterion>;

/**
 * The helper object associated with {@link SlicingCriteria} which makes it easy to parse, validate, and resolve slicing criteria.
 */
export const SlicingCriteria = {
	name: 'SlicingCriteria',
	/**
	 * Decodes all slicing criteria to their corresponding node ids
	 * @throws CriteriaParseError if any of the criteria can not be resolved
	 * @see {@link SlicingCriteria.convertAll}
	 */
	decodeAll(this: void, criteria: SlicingCriteria, decorated: AstIdMap): DecodedCriteria {
		return criteria.map(l => ({ criterion: l, id: SlicingCriterion.parse(l, decorated) }));
	},
	/**
	 * Converts all criteria to their id in the AST if possible, this keeps the original criterion if it can not be resolved.
	 * @see {@link SlicingCriteria.decodeAll}
	 */
	convertAll(this: void, criteria: SlicingCriteria, decorated: AstIdMap): NodeId[] {
		return criteria.map(l => SlicingCriterion.tryParse(l, decorated) ?? l);
	}
} as const;

/**
 * Thrown if the given slicing criteria can not be found
 */
export class CriteriaParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CriteriaParseError';
	}
}

function locationToId<OtherInfo>(location: SourcePosition, dataflowIdMap: AstIdMap<OtherInfo>, file?: RegExp): NodeId | undefined {
	let candidate: RNodeWithParent<OtherInfo> | undefined;
	for(const [id, nodeInfo] of dataflowIdMap.entries()) {
		if(nodeInfo.location === undefined || nodeInfo.location[0] !== location[0] || nodeInfo.location[1] !== location[1] || !matchesFile(nodeInfo, file)) {
			continue; // only consider those with position information
		}

		expensiveTrace(slicerLogger, () => `can resolve id ${id} (${JSON.stringify(nodeInfo.location)}) for location ${JSON.stringify(location)}`);
		// function calls have the same location as the symbol they refer to, so we need to prefer the function call
		if(candidate !== undefined && !RFunctionCall.is(nodeInfo) || RArgument.is(nodeInfo) || RExpressionList.is(nodeInfo)) {
			continue;
		}

		candidate = nodeInfo;
	}
	return candidate?.info.id;
}

/**
 * Resolves a `line~column` criterion: unlike {@link locationToId}, which wants a node *starting* exactly there,
 * this accepts any node whose source range *contains* the position and returns the innermost of them (the same
 * matching the search API performs for `fuzzy` with `innermostOnly`).
 */
function fuzzyLocationToId<OtherInfo>(location: SourcePosition, dataflowIdMap: AstIdMap<OtherInfo>, file?: RegExp): NodeId | undefined {
	const potentials = [...dataflowIdMap.values()].filter(nodeInfo =>
		// arguments and expression lists only wrap their content, sharing its range, so they never say more than it
		!RArgument.is(nodeInfo) && !RExpressionList.is(nodeInfo) && matchesFile(nodeInfo, file)
	);
	/* a call shares its range with the symbol naming it, so keep both (`treatChildAsInner: false`) and let the
	 * preference below decide, rather than always landing on the symbol */
	const candidates = SourceRange.innermostNodes(SourceRange.nodesContaining(potentials, location[0], location[1]), false);
	// prefer the call over the symbol it refers to, exactly as locationToId does
	return (candidates.find(n => RFunctionCall.is(n)) ?? candidates[0])?.info.id;
}

/**
 * Resolves a `line^` criterion: the top-level statement covering the line, which is what has to be excised to
 * remove that line from the program. Unlike {@link fuzzyLocationToId} this widens rather than narrows, so an
 * inner sub-expression on the line never stands in for the statement carrying it.
 */
function topLevelStatementToId<OtherInfo>(line: number, idMap: AstIdMap<OtherInfo>, file?: RegExp): NodeId | undefined {
	const potentials = [...idMap.values()].filter(nodeInfo => matchesFile(nodeInfo, file));
	let best: RNodeWithParent<OtherInfo> | undefined;
	let bestRange: SourceRange | undefined;
	for(const node of SourceRange.nodesContaining(potentials, line)) {
		const statement = RNode.topLevelStatement(node, idMap);
		const range = SourceRange.fromNode(statement);
		/* several statements may cover the line (`a <- 1; b <- 2`), the one starting first wins */
		if(range !== undefined && (bestRange === undefined || SourceRange.compare(range, bestRange) < 0)) {
			best = statement;
			bestRange = range;
		}
	}
	return best?.info.id;
}

/**
 * Splits the optional trailing `(file-regex)` off a criterion (e.g. `2@x(tmp/.*)`), which restricts it to nodes
 * originating from a matching file. The regex may contain escaped parentheses (`3^(a\(b\)\.R)`).
 * Returns `undefined` if the regex is malformed.
 */
function splitFileFilter(criterion: string): { rest: string, file: RegExp | undefined } | undefined {
	const match = /^([^()]*)\(((?:\\.|[^()])*)\)$/.exec(criterion);
	if(match === null) {
		return { rest: criterion, file: undefined };
	}
	try {
		return { rest: match[1], file: new RegExp(match[2]) };
	} catch{
		return undefined;
	}
}

/** Whether the node stems from a file matching the criterion's `(file-regex)` suffix (if any). */
function matchesFile<OtherInfo>(nodeInfo: RNodeWithParent<OtherInfo>, file: RegExp | undefined): boolean {
	return file === undefined || file.test(nodeInfo.info.file ?? '');
}

/**
 * The last line covered by the given AST (restricted to `file`), used to resolve lines counted from the end.
 */
function lastLineOf<OtherInfo>(dataflowIdMap: AstIdMap<OtherInfo>, file: RegExp | undefined): number {
	let last = 0;
	for(const nodeInfo of dataflowIdMap.values()) {
		const range = SourceRange.fromNode(nodeInfo);
		if(range !== undefined && range[2] > last && matchesFile(nodeInfo, file)) {
			last = range[2];
		}
	}
	return last;
}

/**
 * Parses the line part of a criterion, resolving a negative line (`-1` being the last line) against the AST.
 * Returns `undefined` if it is not a number at all (e.g. `x@y`), so the criterion can be rejected as invalid.
 */
function parseLineNumber<OtherInfo>(text: string, dataflowIdMap: AstIdMap<OtherInfo>, file: RegExp | undefined): number | undefined {
	if(!/^-?\d+$/.test(text)) {
		return undefined;
	}
	const line = parseInt(text);
	return line < 0 ? lastLineOf(dataflowIdMap, file) + line + 1 : line;
}

/** Parses a `line<sep>column` criterion, rejecting anything that is not a pair of numbers. */
function parseLocation<OtherInfo>(criterion: string, separator: string, dataflowIdMap: AstIdMap<OtherInfo>, file: RegExp | undefined): SourcePosition | undefined {
	const parts = criterion.split(separator);
	if(parts.length !== 2 || !/^\d+$/.test(parts[1])) {
		return undefined;
	}
	const line = parseLineNumber(parts[0], dataflowIdMap, file);
	return line === undefined ? undefined : [line, parseInt(parts[1])];
}

/**
 * Resolves the `nth` occurrence of `name` in the given line (as written by the optional `[n]` prefix of
 * `line@[n]name`); `n` is 1-based and may be negative to count from the end of the line (`-1` being the last).
 * Occurrences are counted by column, as a function call and the symbol it refers to share a position and are
 * thus one and the same occurrence.
 */
function nthOccurrenceToId<OtherInfo>(line: number, name: string, dataflowIdMap: AstIdMap<OtherInfo>, nth: number, file?: RegExp): NodeId | undefined {
	const byColumn = new Map<number, RNodeWithParent<OtherInfo>>();

	for(const nodeInfo of dataflowIdMap.values()) {
		if(nodeInfo.location === undefined || nodeInfo.location[0] !== line || nodeInfo.lexeme !== name || !matchesFile(nodeInfo, file)) {
			continue;
		}
		if(RArgument.is(nodeInfo) || RExpressionList.is(nodeInfo)) {
			continue;
		}
		const column = nodeInfo.location[1];
		// function calls have the same location as the symbol they refer to, so we need to prefer the function call
		if(!byColumn.has(column) || RFunctionCall.is(nodeInfo)) {
			byColumn.set(column, nodeInfo);
		}
	}
	const columns = [...byColumn.keys()].sort((a, b) => a - b);
	const index = nth < 0 ? columns.length + nth : nth - 1;
	return index >= 0 && index < columns.length ? byColumn.get(columns[index])?.info.id : undefined;
}
