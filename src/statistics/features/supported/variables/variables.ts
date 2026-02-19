import type { Feature, FeatureProcessorInput } from '../../feature';
import type { Writable } from 'ts-essentials';
import { postProcess } from './post-process';
import { appendStatisticsFile } from '../../../output/statistics-file';
import { VertexType } from '../../../../dataflow/graph/vertex';
import { SourceRange } from '../../../../util/range';
import { RProject } from '../../../../r-bridge/lang-4.x/ast/model/nodes/r-project';
import { RSymbol } from '../../../../r-bridge/lang-4.x/ast/model/nodes/r-symbol';
import { RNode } from '../../../../r-bridge/lang-4.x/ast/model/model';


const initialVariableInfo = {
	numberOfVariableUses:  0,
	numberOfDefinitions:   0,
	numberOfRedefinitions: 0,
	// we failed to get the type/role, maybe for function call names etc.
	unknownVariables:      0
};

export type VariableInfo = Writable<typeof initialVariableInfo>;


export type DefinedVariableInformation = [
	name: string,
	location: [line: number, character: number]
];

function visitVariables(info: VariableInfo, input: FeatureProcessorInput): void {
	RProject.visitAst(input.normalizedRAst.ast,
		node => {
			if(!RSymbol.is(node) || RSymbol.isSpecial(node)) {
				return;
			}

			// search for the node in the DF graph
			const mayNode = input.dataflow.graph.get(node.info.id);

			if(mayNode === undefined) {
				info.unknownVariables++;
				appendStatisticsFile(variables.name, 'unknown', [[
					RNode.lexeme(node),
					SourceRange.getStart(node.location)
				] satisfies DefinedVariableInformation ], input.filepath);
				return;
			}

			const [dfNode] = mayNode;
			if(dfNode.tag === VertexType.VariableDefinition) {
				info.numberOfDefinitions++;
				const lexeme = RNode.lexeme(node);
				appendStatisticsFile(variables.name, 'definedVariables', [[
					lexeme,
					SourceRange.getStart(node.location)
				] satisfies DefinedVariableInformation ], input.filepath);
				// checking for redefinitions is no longer possible in its current form!
			} else if(dfNode.tag === 'use') {
				info.numberOfVariableUses++;
				appendStatisticsFile(variables.name, 'usedVariables', [[
					RNode.lexeme(node),
					SourceRange.getStart(node.location)
				] satisfies DefinedVariableInformation ], input.filepath);
			}
		}
	);
}


export const variables: Feature<VariableInfo> = {
	name:        'Variables',
	description: 'Variable Usage, Assignments, and Redefinitions',

	process(existing: VariableInfo, input: FeatureProcessorInput): VariableInfo {
		visitVariables(existing, input);
		return existing;
	},

	initialValue: initialVariableInfo,
	postProcess:  postProcess
};
