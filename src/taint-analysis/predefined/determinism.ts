import { TaintAnalysisDefinition } from '../builder/taint-analysis-definition';
import { securityAnalysis } from './security-analysis';
import { randomnessAnalysis } from './randomness-analysis';

/**
 * Composite taint analysis combining security and randomness analyses.
 * Tracks both security concerns (user/network/file input) and randomness properties (deterministic vs random)
 * simultaneously during a single control-flow traversal.
 */
export const determinism = TaintAnalysisDefinition.compose(
	'determinism',
	[securityAnalysis, randomnessAnalysis],
	{ report: 'Indeterminism flowing to sensitive functions' }
);
