import { type IPipelineStep, PipelineStepStage } from '../../pipeline-step';
import { internalPrinter, StepOutputFormat } from '../../../print/print';
import type { DeepReadonly } from 'ts-essentials';
import type { SyntaxNode, Tree } from 'web-tree-sitter';
import type { ParseRequiredInput } from '../../../../r-bridge/parser';
import { parseRequests } from '../../../../r-bridge/parser';
import { TreeSitterType } from '../../../../r-bridge/lang-4.x/tree-sitter/tree-sitter-types';

export interface ParseStepOutputTS {
    readonly parsed: Tree
}

export interface TreeSitterParseJson {
	readonly '.meta': {
		readonly tokenCount:           number,
		readonly tokenCountNoComments: number
	},
	readonly str: string
}

export const PARSE_WITH_TREE_SITTER_STEP = {
	name:              'parse',
	humanReadableName: 'parse with tree-sitter',
	description:       'Parse the given R code into an AST using tree-sitter',
	processor:         parseRequests<Tree>,
	executed:          PipelineStepStage.OncePerFile,
	printer:           {
		[StepOutputFormat.Internal]: internalPrinter,
		[StepOutputFormat.Json]:     ({ parsed }) => {
			const countChildren = function(node: SyntaxNode, ignoreComments: boolean): number {
				let ret = node.type === TreeSitterType.Comment && ignoreComments ? 0 : 1;
				for(const child of node.children) {
					ret += countChildren(child, ignoreComments);
				}
				return ret;
			};
			const out: TreeSitterParseJson = {
				'.meta': {
					tokenCount:           countChildren(parsed.rootNode, false),
					tokenCountNoComments: countChildren(parsed.rootNode, true)
				},
				str: parsed.rootNode.toString()
			};
			return JSON.stringify(out);
		}
	},
	dependencies:  [],
	requiredInput: undefined as unknown as ParseRequiredInput<Tree>
} as const satisfies DeepReadonly<IPipelineStep<'parse', typeof parseRequests<Tree>>>;
