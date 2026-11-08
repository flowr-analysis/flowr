import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import Joi from 'joi';
import type { ParsedQueryLine, QueryResults, SupportedQuery } from '../../query';
import { queryHeader } from '../../query-print';
import { bold, faint, type OutputFormatter } from '../../../util/text/ansi';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfig } from '../../../config';
import type { DeepPartial } from 'ts-essentials';
import { CloneAlgorithm, type CloneDetectionConfig, type CloneDetectionStats, type ClonePair, CloneScope, CloneUnit } from '../../../clones/clone-detector';
import { ClonePerspective, CloneTokenization } from '../../../clones/clone-ast';
import type { SerializedCloneIndex } from '../../../clones/clone-index';
import { SourceLocation } from '../../../util/range';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import { executeCodeClonesQuery } from './code-clones-query-executor';
import { queryLineCode } from '../../../cli/repl/parser/slice-query-parser';

/**
 * Finds code clones in all files of the analysis with a configurable selection of algorithms.
 * Keep in mind that:
 * - the `config` is merged into the defaults of {@link DefaultCloneDetectionConfig}, so state only what you change
 * - only the `dataflow` perspective needs the dataflow analysis
 * - `against` must use the perspective of the query, otherwise the query throws, and with it only clones between the analyzed files and the stored ones are reported
 * - nodes of fragments from `against` are marked `external` and are not part of the nodes this query involves
 * @example
 * ```ts
 * const { pairs } = await analyzer.query({ type: 'code-clones', algorithms: [CloneAlgorithm.Gst, CloneAlgorithm.Baxter], config: { gst: { threshold: 0.9 } } });
 * const { index } = await analyzer.query({ type: 'code-clones', exportIndex: true }); // store it, search it later with `against: [index]`
 * ```
 */
export interface CodeClonesQuery extends BaseQueryFormat {
	readonly type:         'code-clones';
	/** the algorithms to run, `gst` if omitted */
	readonly algorithms?:  readonly CloneAlgorithm[];
	/** how the code is presented to the algorithms, `canonical` if omitted */
	readonly perspective?: ClonePerspective;
	/** thresholds and options of the algorithms, merged into the defaults */
	readonly config?:      DeepPartial<Omit<CloneDetectionConfig, 'algorithms'>>;
	/** also return the clone index of the analyzed files, to store it and search against it later */
	readonly exportIndex?: boolean;
	/** previously exported indices: then only clones between the analyzed files and these are reported */
	readonly against?:     readonly SerializedCloneIndex[];
}

export interface CodeClonesQueryResult extends BaseQueryResult {
	readonly pairs:  readonly ClonePair[];
	readonly stats:  CloneDetectionStats;
	readonly index?: SerializedCloneIndex;
}

function codeClonesLineParser(_output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'code-clones'> {
	const known = new Set<string>(Object.values(CloneAlgorithm));
	/* only the leading words name algorithms, the rest is the code */
	let from = 0;
	while(from < line.length && known.has(line[from])) {
		from++;
	}
	const algorithms = line.slice(0, from) as CloneAlgorithm[];
	return {
		query: [{ type: 'code-clones', ...(algorithms.length > 0 ? { algorithms } : {}) }],
		rCode: queryLineCode(line, from)
	};
}

function fragmentText(f: ClonePair['a'], formatter: OutputFormatter): string {
	const name = f.name ? `${bold(f.name, formatter)} ` : '';
	return `${name}${faint(SourceLocation.format(f.loc), formatter)}`;
}

export const CodeClonesQueryDefinition = {
	title:           'Code Clones Query',
	executor:        executeCodeClonesQuery,
	fromLine:        codeClonesLineParser,
	syntax:          '@code-clones [baxter|gst|winnowing ...] [<code>]',
	asciiSummarizer: (formatter: OutputFormatter, _analyzer, queryResults, result) => {
		const out = queryResults as Partial<CodeClonesQueryResult> & BaseQueryResult;
		if(out.pairs === undefined || out.stats === undefined) {
			return false;
		}
		result.push(queryHeader('code-clones', formatter, out['.meta'].timing));
		result.push(`   ╰ ${out.pairs.length} clone pair${out.pairs.length === 1 ? '' : 's'} in ${out.stats.files} file${out.stats.files === 1 ? '' : 's'}`);
		for(const p of [...out.pairs].sort((x, y) => y.similarity - x.similarity)) {
			result.push(`      ╰ [${p.algorithm} ${p.similarity.toFixed(2)}] ${fragmentText(p.a, formatter)} ~ ${fragmentText(p.b, formatter)}`);
		}
		return true;
	},
	schema: Joi.object({
		type:        Joi.string().valid('code-clones').required().description('The type of the query.'),
		algorithms:  Joi.array().items(Joi.string().valid(...Object.values(CloneAlgorithm))).optional().description('The clone detection algorithms to run (default: gst).'),
		perspective: Joi.string().valid(...Object.values(ClonePerspective)).optional().description('How the code is presented to the algorithms: as written (syntax), with sugar and newer R features rewritten (canonical, default), or additionally with single-use temporaries inlined along the dataflow (dataflow).'),
		config:      Joi.object({
			scope:     Joi.string().valid(...Object.values(CloneScope)).optional(),
			maxPairs:  Joi.number().integer().min(0).optional(),
			gst:       Joi.object({ tokens: Joi.string().valid(...Object.values(CloneTokenization)), minimumMatchLength: Joi.number().integer().min(1), threshold: Joi.number().greater(0).max(1), unit: Joi.string().valid(...Object.values(CloneUnit)) }).optional(),
			winnowing: Joi.object({ tokens: Joi.string().valid(...Object.values(CloneTokenization)), k: Joi.number().integer().min(1), t: Joi.number().integer().min(1), threshold: Joi.number().min(0).max(1), maxDocumentFrequency: Joi.number().integer().min(1), unit: Joi.string().valid(...Object.values(CloneUnit)) }).optional(),
			baxter:    Joi.object({ massThreshold: Joi.number().integer().min(1), similarityThreshold: Joi.number().min(0).max(1) }).optional()
		}).optional().description('Thresholds and options of the algorithms, merged into the defaults.'),
		exportIndex: Joi.boolean().optional().description('Also return the clone index of the analyzed files, to search against it later.'),
		against:     Joi.array().items(Joi.object({
			format:      Joi.string().valid('flowr-clone-index').required(),
			version:     Joi.number().valid(2).required(),
			perspective: Joi.string().valid(...Object.values(ClonePerspective)).required(),
			files:       Joi.array().items(Joi.object()).required()
		}).unknown(false)).optional().description('Previously exported clone indices to search the analyzed files against. They must use the same perspective as the query.')
	}).description('Finds code clones with a configurable selection of algorithms (AST, token, and fingerprint based).'),
	flattenInvolvedNodes: (queryResults: BaseQueryResult): NodeId[] => {
		const out = queryResults as QueryResults<'code-clones'>['code-clones'];
		return (out.pairs ?? []).flatMap(p => [p.a, p.b]).filter(f => !f.external).map(f => f.id);
	}
} as const satisfies SupportedQuery<'code-clones'>;
