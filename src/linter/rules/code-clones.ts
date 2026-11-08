import { LintingResultCertainty, type LintingResult, type LintingRule, prettyPrint, LintingRuleCertainty } from '../linter-format';
import { Q } from '../../search/flowr-search-builder';
import { SourceLocation } from '../../util/range';
import { LintingRuleTag } from '../linter-tags';
import { type CloneAlgorithm, type CloneDetectionConfig, type CloneDetectionStats, type CloneFragment, DefaultCloneDetectionConfig, detectClones } from '../../clones/clone-detector';
import { CloneIndex } from '../../clones/clone-index';
import { ClonePerspective } from '../../clones/clone-ast';

export interface CodeClonesResult extends LintingResult {
	readonly algorithm:  CloneAlgorithm;
	readonly similarity: number;
	/** the other fragment of the clone pair, the first is the one {@link LintingResult.loc} points to */
	readonly clone:      CloneFragment;
}

/**
 * The configuration of the {@link CODE_CLONES} rule: the one of {@link detectClones} and the perspective for the index.
 * An empty list of `algorithms` selects the default, so the configuration of the rule is merged into the (empty) default.
 */
export interface CodeClonesConfig extends CloneDetectionConfig {
	readonly perspective: ClonePerspective;
}

export type CodeClonesMetadata = CloneDetectionStats;

function describe(f: CloneFragment): string {
	return `${f.name ? `${f.name} at ` : ''}${SourceLocation.format(f.loc)}`;
}

/**
 * Reports each code clone pair once, located at its first fragment, with the other fragment in the result.
 * It is best-effort and off by default, as it indexes the whole project.
 * A pair is reported once per algorithm that finds it.
 * @example
 * ```ts
 * const lint = await executeLintingRule('code-clones', analyzer, { algorithms: [CloneAlgorithm.Baxter], baxter: { similarityThreshold: 0.8 } });
 * if('results' in lint) {
 *   lint.results.map(r => `${SourceLocation.format(r.loc)} ~ ${SourceLocation.format(r.clone.loc)}`);
 * }
 * ```
 */
export const CODE_CLONES = {
	createSearch:        () => Q.from([]),
	processSearchResult: async(_elements, config, analyzer) => {
		/* configured algorithms are merged into the (empty) default list, so an empty list means the default */
		const algorithms = config.algorithms.length > 0 ? config.algorithms : DefaultCloneDetectionConfig.algorithms;
		const index = await CloneIndex.build(analyzer, { perspective: config.perspective });
		const { pairs, stats } = detectClones(index, { ...config, algorithms });
		const results: CodeClonesResult[] = pairs.map(p => ({
			certainty:  LintingResultCertainty.Uncertain,
			involvedId: p.a.id,
			loc:        p.a.loc,
			algorithm:  p.algorithm,
			similarity: p.similarity,
			clone:      p.b
		}));
		return { results, '.meta': stats };
	},
	prettyPrint: prettyPrint(
		(result: CodeClonesResult) => `Code is a clone of ${describe(result.clone)} (${result.algorithm}, similarity ${result.similarity.toFixed(2)})`
	),
	info: {
		name:            'Code Clones',
		description:     'Finds duplicated code (code clones) with a configurable selection of AST, token, and fingerprint based algorithms.',
		tags:            [LintingRuleTag.Smell, LintingRuleTag.Readability, LintingRuleTag.Experimental],
		certainty:       LintingRuleCertainty.BestEffort,
		activeByDefault: false,
		defaultConfig:   () => ({ ...DefaultCloneDetectionConfig, algorithms: [], perspective: ClonePerspective.Canonical })
	}
} as const satisfies LintingRule<CodeClonesResult, CodeClonesMetadata, CodeClonesConfig>;
