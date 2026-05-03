import type { FnTaintMapper } from './function-mapper';
import { ScaleDomain, Unscaled } from './scale-domain';
import { TaintInferenceVisitor } from './taint-visitor';
import { Top } from '../abstract-interpretation/domains/lattice';
import type { FlowrAnalyzer } from '../project/flowr-analyzer';

const ScaleTaintMapper = {
	'c':    { taint: Unscaled },
	//'scale': { taint: Scaled },
	'mean': { taint: Top },
} as const satisfies FnTaintMapper<ScaleDomain>;

/**
 *
 */
export async function runScaleAnalysis(analyzer: FlowrAnalyzer) {
	const visitor = new TaintInferenceVisitor(new ScaleDomain(Top), ScaleTaintMapper, {
		controlFlow:   await analyzer.controlflow(),
		ctx:           analyzer.inspectContext(),
		dfg:           (await analyzer.dataflow()).graph,
		normalizedAst: await analyzer.normalize()
	});
	visitor.start();
	return visitor.getEndState();
}