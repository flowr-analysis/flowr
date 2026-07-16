import { SourceRange, type SourcePosition } from '../../util/range';
import { expensiveTrace } from '../../util/log';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type {
	AstIdMap,
	RNodeWithParent
} from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { slicerLogger } from '../static/static-slicer';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';

/** An optional `(file-regex)` suffix restricting a criterion to nodes stemming from a matching file. */
type FileFilterSuffix = '' | `(${string})`;

/**
 * Either `line:column`, `line~column`, `line@variable-name`, or `$id`; all but `$id` accept a trailing
 * `(file-regex)`. See {@link SlicingCriterion.tryParse} for what each of them resolves to.
 */
export type SlicingCriterion = `${number}:${number}${FileFilterSuffix}` | `${number}~${number}${FileFilterSuffix}`
	| `${number}@${string}` | `$${NodeId | number}`;

/**
 * The helper object associated with {@link SlicingCriterion} which makes it easy
 * to parse, validate and resolve slicing criteria.
 */
export const SlicingCriterion = {
	name: 'SlicingCriterion',
	/**
	 * Checks whether a value has a valid slicing criterion syntax.
	 * This does not check whether the slicing criterion exists (represents a valid node ID).
	 * @see {@link SlicingCriterion.parse} to parse a slicing criterion to a node ID
	 */
	isValid(this: void, criterion: unknown): criterion is SlicingCriterion {
		return typeof criterion === 'string' && criterion.match(/^\d+:\d+|\d+@.+|\$.+$/) !== null;
	},
	/**
	 * Takes a criterion in the form of `line:column`, `line~column`, or `line@variable-name` and returns the corresponding node id
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
	 *
	 * | Criterion | Resolves to |
	 * | --------- | ----------- |
	 * | `2@x`      | `x` in line 2, preferring a call over the symbol it refers to |
	 * | `2@[3]x`   | the 3rd occurrence of `x` in line 2 (by column); `[-1]` for the last |
	 * | `2:5`      | the element *starting* at line 2, column 5 |
	 * | `2~5`      | the innermost element *containing* line 2, column 5 |
	 * | `$42`      | the node with the normalized id 42 |
	 *
	 * A negative line counts from the end of the input (`-1` being the last line). Every criterion but `$id`
	 * accepts a trailing `(file-regex)` (e.g. `2@x(tmp/.*)`) restricting it to a matching file.
	 * @see {@link SlicingCriterion.parse} for the version that throws an error
	 */
	tryParse(this: void, criterion: SlicingCriterion | NodeId, idMap: AstIdMap): NodeId | undefined {
		criterion = criterion.toString(); // in case it's a number
		if(criterion.startsWith('$')) {
			return NodeId.normalize(criterion.substring(1)) as NodeId;
		}
		const split = splitFileFilter(criterion);
		if(split === undefined) {
			return undefined; // a malformed file filter must not silently resolve without it
		}
		const { rest: base, file } = split;
		if(base.includes('@')) {
			const at = base.indexOf('@');
			const line = parseLineNumber(base.substring(0, at), idMap, file);
			const name = base.substring(at + 1);
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
		}
	},
	/**
	 * Converts a node id to a slicing criterion in the form of `$id`
	 */
	fromId(this: void, id: NodeId): SlicingCriterion {
		return `$${id}`;
	}
} as const;

/**
 * A slicing criterion is a list of single slicing criteria, which can be in the form of `line:column`,
 * `line~column`, `line@variable-name`, or `$id`.
 */
export type SlicingCriteria = SlicingCriterion[];


export interface DecodedCriterion {
	criterion: SlicingCriterion,
	id:        NodeId
}

export type DecodedCriteria = ReadonlyArray<DecodedCriterion>;

/**
 * The helper object associated with {@link SlicingCriteria} which makes it easy to parse, validate and resolve slicing criteria.
 */
export const SlicingCriteria = {
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
		if(candidate !== undefined && nodeInfo.type !== RType.FunctionCall || nodeInfo.type === RType.Argument || nodeInfo.type === RType.ExpressionList) {
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
		nodeInfo.type !== RType.Argument && nodeInfo.type !== RType.ExpressionList && matchesFile(nodeInfo, file)
	);
	/* a call shares its range with the symbol naming it, so keep both (`treatChildAsInner: false`) and let the
	 * preference below decide, rather than always landing on the symbol */
	const candidates = SourceRange.innermostNodes(SourceRange.nodesContaining(potentials, location[0], location[1]), false);
	// prefer the call over the symbol it refers to, exactly as locationToId does
	return (candidates.find(n => n.type === RType.FunctionCall) ?? candidates[0])?.info.id;
}

/**
 * Splits the optional trailing `(file-regex)` off a criterion (e.g. `2@x(tmp/.*)`), which restricts it to nodes
 * originating from a matching file. Returns `undefined` if the regex is malformed.
 */
function splitFileFilter(criterion: string): { rest: string, file: RegExp | undefined } | undefined {
	const match = /^(.*)\(([^()]*)\)$/.exec(criterion);
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
		if(nodeInfo.type === RType.Argument || nodeInfo.type === RType.ExpressionList) {
			continue;
		}
		const column = nodeInfo.location[1];
		// function calls have the same location as the symbol they refer to, so we need to prefer the function call
		if(!byColumn.has(column) || nodeInfo.type === RType.FunctionCall) {
			byColumn.set(column, nodeInfo);
		}
	}
	const columns = [...byColumn.keys()].sort((a, b) => a - b);
	const index = nth < 0 ? columns.length + nth : nth - 1;
	return index >= 0 && index < columns.length ? byColumn.get(columns[index])?.info.id : undefined;
}


