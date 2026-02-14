import { withTreeSitter } from '../_helper/shell';
import { assert, describe, test } from 'vitest';
import type { SingleSlicingCriterion } from '../../../src/slicing/criterion/parse';
import { tryResolveSliceCriterionToId } from '../../../src/slicing/criterion/parse';
import { FlowrAnalyzerBuilder } from '../../../src/project/flowr-analyzer-builder';
import { requestFromInput } from '../../../src/r-bridge/retriever';
import type { CfgSimplificationPassName } from '../../../src/control-flow/cfg-simplification';
import { cfgToMermaid, cfgToMermaidUrl } from '../../../src/util/mermaid/cfg';
import { isNotUndefined } from '../../../src/util/assert';

describe('CFG Mermaid Visualization', withTreeSitter(parser => {
	function assertMermaidVisualization(
		code: string,
		expectedMermaid: RegExp[],
		{ simplifications, compact, selectedVertices }: {
			simplifications?:  CfgSimplificationPassName[],
			compact?:          boolean,
			selectedVertices?: readonly SingleSlicingCriterion[]
		} = {}
	): void {
		test(`Mermaid visualization for:\n${code}`, async() => {
			const analyzer = await new FlowrAnalyzerBuilder().setParser(parser).build();
			analyzer.addRequest(requestFromInput(code));
			const cfg = await analyzer.controlflow(simplifications);
			const norm = await analyzer.normalize();
			const translateIds = selectedVertices?.map(v =>
				tryResolveSliceCriterionToId(v, norm.idMap)
			).filter(isNotUndefined) ?? [];
			const mermaid = cfgToMermaid(cfg, norm, {
				prefix:         '',
				simplify:       compact,
				includeOnlyIds: translateIds.length > 0 ? new Set(translateIds) : undefined
			}).split('\n').filter(l => l.trim().length > 0);
			try {
				assert.isAtLeast(mermaid.length, expectedMermaid.length, 'Number of mermaid lines does not match expectation');
				for(let i = 0; i < expectedMermaid.length; i++) {
					assert.match(mermaid[i], expectedMermaid[i], `Mermaid line ${i + 1} does not match expectation`);
				}
			} catch(e) {
				console.log('Generated mermaid diagram:\n', mermaid.join('\n'));
				console.log(cfgToMermaidUrl(cfg, norm, {
					simplify:       compact,
					includeOnlyIds: translateIds.length > 0 ? new Set(translateIds) : undefined
				}));
				throw e;
			}
		});
	}

	assertMermaidVisualization('x', [
		/RExpressionList/,
		/RSymbol/,
		/.*/,
		/n1-e/,
		/n0.*n1/,
		/n1-e.*n0/,
		/style n1.*/
	]);
	assertMermaidVisualization(`x <- true
if(x) {
    print(x)
}`, [
		/RExpressionList/,
		/RSymbol/,
		/.*/,
		/RSymbol/,
		/.*/,
		/RBinaryOp/,
		/.*/,
		/n2-e/,
		/RIfThenElse/
	]);
	assertMermaidVisualization(`x <- true
if(x) {
    print(x)
}`, [
		/RSymbol/,
		/.*/,
		/RFunctionCall/,
		/.*/,
		/n9-e/,
		/RArgument/,
		/.*/,
		/RSymbol/,
		/.*/,
		/n8-e/,
		/n6.*n9/,
		/n7.*n8/,
		/n8-e.*n7/,
		/n8.*n6/,
		/n9-e.*n8-e/
	], {
		selectedVertices: ['3@print', '3@x']
	});
}));