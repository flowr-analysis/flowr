import type { Feature, FeatureProcessorInput } from '../../feature';
import type { Writable } from 'ts-essentials';
import { emptyCommonSyntaxTypeCounts, updateCommonSyntaxTypeCounts } from '../../common-syntax-probability';
import { postProcess } from './post-process';
import type { RNodeWithParent } from '../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { visitAst } from '../../../../r-bridge/lang-4.x/ast/model/processing/visitor';
import { RType } from '../../../../r-bridge/lang-4.x/ast/model/type';
import { OperatorDatabase, Operators } from '../../../../r-bridge/lang-4.x/ast/model/operators';


const initialAssignmentInfo = {
	// operator to occurrence count
	assignmentOperator:       {} as Record<string, bigint>,
	assigned:                 emptyCommonSyntaxTypeCounts(),
	// find combinations like `` is most often used for functions?
	deepestNesting:           0,
	nestedOperatorAssignment: 0
};

export type AssignmentInfo = Writable<typeof initialAssignmentInfo>

export const AssignmentOperators: ReadonlySet<string> = new Set(Operators.filter(op => OperatorDatabase[op].usedAs === 'assignment'));

function visitAssignment(info: AssignmentInfo, input: FeatureProcessorInput): void {
	const assignmentStack: RNodeWithParent[] = [];

	visitAst(input.normalizedRAst.ast,
		node => {
			if(node.type !== RType.BinaryOp || !AssignmentOperators.has(node.operator)) {
				return;
			}

			if(assignmentStack.length > 0) {
				info.nestedOperatorAssignment++;
				info.deepestNesting = Math.max(info.deepestNesting, assignmentStack.length);
			}

			assignmentStack.push(node);

			info.assignmentOperator[node.operator] = ((info.assignmentOperator[node.operator] as bigint | undefined) ?? 0n) + 1n;

			switch(node.operator) {
				case '->':
				case '->>':
					info.assigned = updateCommonSyntaxTypeCounts(info.assigned, node.lhs);
					break;
				default:
					info.assigned = updateCommonSyntaxTypeCounts(info.assigned, node.rhs);
					break;
			}

		}, node => {
			// drop again :D
			if(node.type === RType.BinaryOp && node.flavor === 'assignment') {
				assignmentStack.pop();
			}
		}
	);
}

export const assignments: Feature<AssignmentInfo> = {
	name:        'Assignments',
	description: 'all ways to assign something in R',

	process(existing: AssignmentInfo, input: FeatureProcessorInput): AssignmentInfo {
		visitAssignment(existing, input);
		return existing;
	},

	initialValue: initialAssignmentInfo,
	postProcess:  postProcess
};
