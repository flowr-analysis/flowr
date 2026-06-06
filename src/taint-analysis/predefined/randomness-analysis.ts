import { Bottom, Top } from '../../abstract-interpretation/domains/lattice';
import { TaintAnalysisDefinition } from '../builder/taint-analysis-definition';
import { FiniteDomainBuilder } from '../builder/domain';
import { Identifier } from '../../dataflow/environments/identifier';

export const Random = Symbol('Random');
export const Deterministic = Symbol('Deterministic');

export const randomnessDomain = new FiniteDomainBuilder<Top, Bottom, [Top, Bottom, ...[typeof Random, typeof Deterministic]]>()
	.addLeqOrder(Bottom, [Random, Deterministic])
	.addLeqOrder(Random, Top)
	.addLeqOrder(Deterministic, Top)
	.build();

export const randomnessAnalysis = new TaintAnalysisDefinition('randomness', randomnessDomain)
	.through([ {
		identifier: Identifier.make('c'),
		taint:      Deterministic
	},
	{
		identifier: [
			'jitter', 'sample', 'sample.int', 'arima.sim', 'kmeans', 'princomp', 'rcauchy', 'rchisq', 'rexp',
			'rgamma', 'rgeom', 'rlnorm', 'rlogis', 'rmultinom', 'rnbinom', 'rnorm', 'rpois', 'runif', 'pointLabel',
			'some', 'rbernoulli', 'rdunif', 'generateSeedVectors',
			'rbeta', 'rf', 'rhyper', 'rweibull', 'rt', 'rvonmises', 'rwilcox', 'rxor', 'rhyper', 'rmvnorm',
			'rsignrank', 'randomForest',
			'permuted', 'permute', 'shuffle', 'shuffleSet', 'data_shuffle', 'sample_frac', 'sample_n', 'slice_sample',
		],
		taint: Random
	}]);
