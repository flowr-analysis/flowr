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
	.from([ {
		identifier: Identifier.make('c', 'base'),
		taint:      Deterministic
	},
	{
		identifier: [
			Identifier.make('jitter', 'base'),
			Identifier.make('sample', 'base'),
			Identifier.make('sample.int', 'base'),

			// Distribution samplers and stochastic algorithms
			Identifier.make('arima.sim', 'stats'),
			Identifier.make('kmeans', 'stats'),
			Identifier.make('princomp', 'stats'),
			Identifier.make('rcauchy', 'stats'),
			Identifier.make('rchisq', 'stats'),
			Identifier.make('rexp', 'stats'),
			Identifier.make('rgamma', 'stats'),
			Identifier.make('rgeom', 'stats'),
			Identifier.make('rlnorm', 'stats'),
			Identifier.make('rlogis', 'stats'),
			Identifier.make('rmultinom', 'stats'),
			Identifier.make('rnbinom', 'stats'),
			Identifier.make('rnorm', 'stats'),
			Identifier.make('rpois', 'stats'),
			Identifier.make('runif', 'stats'),
			Identifier.make('rbeta', 'stats'),
			Identifier.make('rf', 'stats'),
			Identifier.make('rhyper', 'stats'),
			Identifier.make('rweibull', 'stats'),
			Identifier.make('rt', 'stats'),
			Identifier.make('rwilcox', 'stats'),
			Identifier.make('rsignrank', 'stats'),
		],
		taint: Random
	}]);
