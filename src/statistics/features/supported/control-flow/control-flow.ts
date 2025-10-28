import type { Feature, FeatureProcessorInput } from '../../feature';
import type { Writable } from 'ts-essentials';
import { emptyCommonSyntaxTypeCounts, updateCommonSyntaxTypeCounts } from '../../common-syntax-probability';
import { postProcess } from './post-process';
import { unpackArgument } from '../../../../dataflow/internal/process/functions/call/argument/unpack-argument';
import type { ParentInformation, RNodeWithParent } from '../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RType } from '../../../../r-bridge/lang-4.x/ast/model/type';
import { visitAst } from '../../../../r-bridge/lang-4.x/ast/model/processing/visitor';
import type { RExpressionList } from '../../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';

const initialControlflowInfo = {
	ifThen:           emptyCommonSyntaxTypeCounts(),
	thenBody:         emptyCommonSyntaxTypeCounts(),
	ifThenElse:       emptyCommonSyntaxTypeCounts(),
	elseBody:         emptyCommonSyntaxTypeCounts(),
	/** can be nested with if-s or if-then-else's */
	nestedIfThen:     0,
	nestedIfThenElse: 0,
	deepestNesting:   0,
	/** switch(...) */
	switchCase:       emptyCommonSyntaxTypeCounts()
};

export type ControlflowInfo = Writable<typeof initialControlflowInfo>

function visitIfThenElse(info: ControlflowInfo, input: FeatureProcessorInput): void {
	const ifThenElseStack: RNodeWithParent[] = [];

	visitAst(input.normalizedRAst.ast,
		node => {
			if(node.type !== RType.IfThenElse) {
				if(node.type === RType.FunctionCall && node.named && node.functionName.content === 'switch') {
					const initialArg = unpackArgument(node.arguments[0]);
					if(initialArg) {
						info.switchCase = updateCommonSyntaxTypeCounts(info.switchCase, initialArg);
					}
				}
				return;
			}
			const ifThenElse = node.otherwise !== undefined;

			if(ifThenElseStack.length > 0) {
				if(ifThenElse) {
					info.nestedIfThenElse++;
				} else {
					info.nestedIfThen++;
				}
				info.deepestNesting = Math.max(info.deepestNesting, ifThenElseStack.length);
			}
			ifThenElseStack.push(node);

			info.thenBody = updateCommonSyntaxTypeCounts(info.thenBody, ...node.then.children);
			if(ifThenElse) {
				info.ifThenElse = updateCommonSyntaxTypeCounts(info.ifThenElse, node.condition);
				info.elseBody = updateCommonSyntaxTypeCounts(info.elseBody, ...(node.otherwise as RExpressionList<ParentInformation>).children);
			} else {
				info.ifThen = updateCommonSyntaxTypeCounts(info.ifThen, node.condition);
			}
		}, node => {
			// drop again :D
			if(node.type === RType.IfThenElse) {
				ifThenElseStack.pop();
			}
		}
	);
}


export const controlflow: Feature<ControlflowInfo> = {
	name:        'Controlflow',
	description: 'Deals with if-then-else and switch-case',

	process(existing: ControlflowInfo, input: FeatureProcessorInput): ControlflowInfo {
		visitIfThenElse(existing, input);
		return existing;
	},
	initialValue: initialControlflowInfo,
	postProcess:  postProcess
};
