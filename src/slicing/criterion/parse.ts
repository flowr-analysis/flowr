import type { SourcePosition } from '../../util/range';
import { expensiveTrace } from '../../util/log';
import { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type {
	AstIdMap,
	RNodeWithParent
} from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { slicerLogger } from '../static/static-slicer';
import { RType } from '../../r-bridge/lang-4.x/ast/model/type';

/** Either `line:column`, `line@variable-name`, or `$id` */
export type SingleSlicingCriterion = `${number}:${number}` | `${number}@${string}` | `$${NodeId|number}`;

/**
 * The helper object associated with {@link SingleSlicingCriterion} which makes it easy
 * to parse, validate and resolve slicing criteria.
 */
export const SingleSlicingCriterion = {
	/**
	 * Takes a criterion in the form of `line:column` or `line@variable-name` and returns the corresponding node id
	 * @see {@link SingleSlicingCriterion.tryParse} for a version that does not throw an error
	 */
	parse(this: void, criterion: SingleSlicingCriterion, idMap: AstIdMap): NodeId {
		const resolved = SingleSlicingCriterion.tryParse(criterion, idMap);
		if(resolved === undefined) {
			throw new CriteriaParseError(`invalid slicing criterion ${criterion}`);
		}
		return resolved;
	},
	/**
	 * Tries to resolve a slicing criterion to an id, but does not throw an error if it fails.
	 * @see {@link SingleSlicingCriterion.parse} for the version that throws an error
	 */
	tryParse(this: void, criterion: SingleSlicingCriterion | NodeId, idMap: AstIdMap): NodeId | undefined {
		criterion = criterion.toString(); // in case it's a number
		if(criterion.startsWith('$')) {
			return NodeId.normalize(criterion.substring(1)) as NodeId;
		} else if(criterion.includes('@')) {
			const at = criterion.indexOf('@');
			const line = parseInt(criterion.substring(0, at));
			const name = criterion.substring(at + 1);
			return conventionalCriteriaToId(line, name, idMap);
		} else if(criterion.includes(':')) {
			const [line, column] = criterion.split(':').map(c => parseInt(c));
			return locationToId([line, column], idMap);
		}
	}
} as const;

export type SlicingCriteria = SingleSlicingCriterion[];

/**
 * Thrown if the given slicing criteria can not be found
 */
export class CriteriaParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CriteriaParseError';
	}
}

function locationToId<OtherInfo>(location: SourcePosition, dataflowIdMap: AstIdMap<OtherInfo>): NodeId | undefined {
	let candidate: RNodeWithParent<OtherInfo> | undefined;
	for(const [id, nodeInfo] of dataflowIdMap.entries()) {
		if(nodeInfo.location === undefined || nodeInfo.location[0] !== location[0] || nodeInfo.location[1] !== location[1]) {
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

function conventionalCriteriaToId<OtherInfo>(line: number, name: string, dataflowIdMap: AstIdMap<OtherInfo>): NodeId | undefined {
	let candidate: RNodeWithParent<OtherInfo> | undefined;

	for(const nodeInfo of dataflowIdMap.values()) {
		if(nodeInfo.location === undefined || nodeInfo.location[0] !== line || nodeInfo.lexeme !== name) {
			continue;
		}

		// function calls have the same location as the symbol they refer to, so we need to prefer the function call
		if(candidate !== undefined && nodeInfo.type !== RType.FunctionCall || nodeInfo.type === RType.Argument || nodeInfo.type === RType.ExpressionList) {
			continue;
		}
		candidate = nodeInfo;
	}
	return candidate?.info.id;
}

export interface DecodedCriterion {
	criterion: SingleSlicingCriterion,
	id:        NodeId
}

export type DecodedCriteria = ReadonlyArray<DecodedCriterion>;

/**
 * Converts all slicing criteria to their corresponding node ids
 * @throws CriteriaParseError if any of the criteria can not be resolved
 */
export function convertAllSlicingCriteriaToIds(criteria: SlicingCriteria, decorated: AstIdMap): DecodedCriteria {
	return criteria.map(l => ({ criterion: l, id: SingleSlicingCriterion.parse(l, decorated) }));
}
