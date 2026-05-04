import { Scaled, ScaleDomain, Unscaled } from './scale-domain';
import { Bottom, Top } from '../abstract-interpretation/domains/lattice';
import type { FlowrAnalyzer } from '../project/flowr-analyzer';
import { TaintAnalysis } from './dsl';

/**
 *
 */
export async function runScaleAnalysis(analyzer: FlowrAnalyzer) {
	return await new TaintAnalysis(new ScaleDomain(Top), analyzer)
		.through({
			'c':     { taint: Unscaled },
			'scale': { taint: Scaled },
		})
		.to({
			'mean': {
				taint: {
					pos:  0,
					cond: (taint) => taint == Scaled ? Bottom : taint
				}
			},
		})
		.report('Warning: Mean of scaled value is always zero')
		.run();
}