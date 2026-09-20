import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import Joi from 'joi';
import type { ParsedQueryLine, SupportedQuery } from '../../query';
import { bold, faint, italic, type OutputFormatter } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import type { NodeId } from '../../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { FlowrConfig } from '../../../config';
import { executeFunctionInfoQuery } from './function-info-query-executor';
import type { BuiltinModel } from './function-origin';

/**
 * Answers "where does this function come from?" for a bare name: which packages export it (from the loaded
 * signature database(s), optionally restricted to {@link packages}), the signature/details of each hit, and
 * whether flowR itself carries a built-in definition for it. The built-in part is answered regardless of the
 * database result, so a primitive with no package at all (`if`, `[`) still gets a real answer.
 */
export interface FunctionInfoQuery extends BaseQueryFormat {
	readonly type:      'function-info';
	/** the bare function/symbol name to look up */
	readonly name:      string;
	/** restrict the package list to these names; every exporting package when omitted */
	readonly packages?: readonly string[];
}

/** what the signature database states about `name` in one exporting package */
export interface FunctionInfoPackageHit {
	readonly package:     string;
	readonly exported:    boolean;
	readonly parameters?: readonly string[];
	readonly file?:       string;
	readonly line?:       number;
}

export interface FunctionInfoQueryResult extends BaseQueryResult {
	readonly name:     string;
	/** the packages the database knows to export {@link FunctionInfoQueryResult.name}, with their details */
	readonly packages: readonly FunctionInfoPackageHit[];
	/** flowR's own built-in definitions for the name, empty when it has none */
	readonly builtin:  readonly BuiltinModel[];
}

function functionInfoLineParser(_output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'function-info'> {
	const [name, ...packages] = line.filter(t => t.length > 0);
	if(!name) {
		return { query: undefined };
	}
	return { query: [{ type: 'function-info', name, ...(packages.length > 0 ? { packages } : {}) }] };
}

export const FunctionInfoQueryDefinition = {
	title:           'Function Info Query',
	executor:        executeFunctionInfoQuery,
	fromLine:        functionInfoLineParser,
	syntax:          '@function-info <name> [<package>...]',
	asciiSummarizer: (formatter: OutputFormatter, _analyzer, queryResults, result) => {
		const out = queryResults as FunctionInfoQueryResult;
		result.push(`Query: ${bold('function-info', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		if(out.packages.length === 0 && out.builtin.length === 0) {
			result.push(`   ╰ ${italic(`No package or built-in definition known for ${out.name}`, formatter)}`);
			return true;
		}
		for(const hit of out.packages) {
			const where = hit.file ? ` ${faint(`(${hit.file}${hit.line !== undefined ? `:${hit.line}` : ''})`, formatter)}` : '';
			const params = hit.parameters?.length ? ` ${faint(`(${hit.parameters.join(', ')})`, formatter)}` : '';
			result.push(`   ╰ ${bold(hit.package, formatter)}${params}${hit.exported ? '' : faint(' (internal)', formatter)}${where}`);
		}
		for(const b of out.builtin) {
			const ns = b.namespace ? `${b.namespace}::` : '';
			const bits = [
				b.processor ? `processor ${b.processor}` : undefined,
				b.evalHandler ? `eval ${b.evalHandler}` : undefined,
				b.assumePrimitive ? 'primitive' : undefined,
				...b.tags
			].filter((s): s is string => s !== undefined);
			result.push(`   ╰ ${italic('flowR built-in', formatter)} ${bold(`${ns}${out.name}`, formatter)} [${b.kind}]${bits.length ? ` ${faint(bits.join(', '), formatter)}` : ''}`);
		}
		return true;
	},
	schema: Joi.object({
		type:     Joi.string().valid('function-info').required().description('The type of the query.'),
		name:     Joi.string().required().description('The bare function/symbol name to look up.'),
		packages: Joi.array().items(Joi.string()).optional().description('Restrict the package list to these names; every exporting package is considered when omitted.')
	}).description('Reports which packages export a function name, its signature/details in each, and whether flowR itself carries a built-in definition for it.'),
	flattenInvolvedNodes: (): NodeId[] => []
} as const satisfies SupportedQuery<'function-info'>;
