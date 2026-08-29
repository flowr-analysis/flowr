import { LintingResultCertainty, type LintingRule, LintingRuleCertainty } from '../linter-format';
import type {  FunctionsMetadata,  FunctionsResult } from './function-finder-util';
import { functionFinderUtil } from './function-finder-util';
import { LintingRuleTag } from '../linter-tags';
import { ReadFunctions } from '../../queries/catalog/dependencies-query/function-info/read-functions';
import type { FlowrSearchElement } from '../../search/flowr-search';
import type { ParentInformation } from '../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { Ternary } from '../../util/logic';
import { SourceFunctions } from '../../queries/catalog/dependencies-query/function-info/source-functions';
import { WriteFunctions } from '../../queries/catalog/dependencies-query/function-info/write-functions';
import type { FunctionInfo } from '../../queries/catalog/dependencies-query/function-info/function-info';
import { Identifier } from '../../dataflow/environments/identifier';
import { Dataflow } from '../../dataflow/graph/df-helper';
import type { MergeableRecord } from '../../util/objects';
import { ArgProp, SemanticCallTag } from '../../dataflow/environments/built-in-props';
import type { BuiltInParam } from '../../dataflow/environments/query-fn-props';
import { BuiltInIndex } from '../../dataflow/environments/query-fn-props';

export interface NetworkFunctionsConfig extends MergeableRecord {
	/**
	 * The list of function names or more detailed {@link NetworkFunction} information that should be marked in the given context if their arguments match.
	 */
	fns: readonly (Identifier | NetworkFunction)[]
}

export interface NetworkFunction extends MergeableRecord {
	/**
	 * The name of the network function to find.
	 */
	name:                     Identifier,
	/**
	 * The {@link FunctionInfo} to use for querying the argument whose value should match {@link onlyTriggerWithArgument}.
	 * If this is not specified, flowR's default database of functions ({@link ReadFunctions}, {@link SourceFunctions}, and {@link WriteFunctions}) is queried for appropriate information on the function's read argument.
	 */
	info?:                    Omit<FunctionInfo, 'name'>
	/**
	 * Only trigger if the function's read argument is linked to a value that matches this pattern through {@link info}.
	 * If this is unset, the read argument is not queried for whether its value matches a pattern.
	 */
	onlyTriggerWithArgument?: RegExp | string
}

/**
 * What an address looks like when one is written down. A call is only a network operation for the argument it
 * is actually handed, so this is what decides that per call site rather than the name alone.
 */
const UrlPattern = /^(https?|ftps?):\/\//;

/** the parameter names that mean "the address", preferred over any other resource the same call names */
const AddressNames: ReadonlySet<string> = new Set(['url', 'urls', 'uri', 'href', 'link', 'address', 'repo', 'repo_spec', 'pull']);

/**
 * The resource parameter of a call that carries its address: the one named like an address where the call has
 * one, else the first resource it names. `curl_upload(file, url)` reads a file and sends it somewhere, so the
 * address is its second parameter rather than its first.
 */
function addressParam(params: readonly BuiltInParam[]): BuiltInParam {
	return params.find(p => AddressNames.has(p.name)) ?? params[0];
}

/**
 * Every built-in that may reach the network, read back from the {@link DefaultBuiltinConfig}: the ones labeled
 * {@link SemanticCallTag.Network} always do, and any call naming an {@link ArgProp.Resource} does whenever that
 * resource is a url rather than a path -- which is what {@link UrlPattern} decides per call site. Label a
 * built-in `Network` or give it a resource parameter and it shows up here; nothing is listed twice.
 */
export function networkFunctions(index: BuiltInIndex = BuiltInIndex.default()): NetworkFunction[] {
	const resources = new Map<string, BuiltInParam[]>();
	for(const param of index.params(ArgProp.Resource)) {
		const key = Identifier.toString(param.call);
		resources.set(key, [...resources.get(key) ?? [], param]);
	}
	const names = new Map(index.with(SemanticCallTag.Network).map(call => [Identifier.toString(call), call]));
	for(const [key, [param]] of resources) {
		if(!names.has(key)) {
			names.set(key, param.call);
		}
	}
	return [...names].map(([key, name]) => {
		const params = resources.get(key);
		const address = params === undefined ? undefined : addressParam(params);
		return {
			name,
			...(address === undefined ? {} : { info: { argIdx: address.index, argName: address.name, resolveValue: true } }),
			onlyTriggerWithArgument: UrlPattern
		};
	});
}

export const NETWORK_FUNCTIONS = {
	createSearch:        (config) => functionFinderUtil.createSearch(config.fns.map(f => Identifier.is(f) ? f : f.name)),
	processSearchResult: async(e, c, d) => {
		const df = await d.dataflow();
		const fnPool = new Map<string, FunctionInfo>([
			...ReadFunctions.concat(SourceFunctions, WriteFunctions).map(f => [Identifier.toString(Identifier.make(f.name, f.package)), f] as const),
			...c.fns.flatMap(f => Identifier.is(f) ? [] : f.info === undefined ? [] : [[Identifier.toString(f.name), { name: Identifier.toString(f.name), ...f.info }] as const])
		]);
		const onlyTriggerLookup = new Map(c.fns.flatMap(f => Identifier.is(f) ? [] : [[Identifier.toString(f.name), f.onlyTriggerWithArgument] as const]));
		return functionFinderUtil.processSearchResult(e, c, d,
			async(es) => {
				const res: (FlowrSearchElement<ParentInformation> & { certainty: LintingResultCertainty })[] = [];
				for(const e of es) {
					const identifier = Dataflow.qualify(e.node.info.id, df.graph, true) ?? (e.node.lexeme !== undefined ? Identifier.parse(e.node.lexeme) : undefined);
					if(identifier === undefined) {
						continue;
					}
					// we allow onlyTriggerLookup to contain non-namespaced functions
					const requireValue = onlyTriggerLookup.get(Identifier.toString(identifier)) ?? onlyTriggerLookup.get(Identifier.getName(identifier));
					const val = await functionFinderUtil.requireArgumentValue(e, fnPool, d, requireValue);
					if(val === Ternary.Never) {
						continue;
					}
					const x = e as unknown as FlowrSearchElement<ParentInformation> & {
						certainty: LintingResultCertainty
					};
					x.certainty = val === Ternary.Always ? LintingResultCertainty.Certain : LintingResultCertainty.Uncertain;
					res.push(x);
				}
				return res;
			}
		);
	},
	prettyPrint: functionFinderUtil.prettyPrint('network operations'),
	info:        {
		name:          'Network Functions',
		tags:          [LintingRuleTag.Reproducibility, LintingRuleTag.Security, LintingRuleTag.Performance, LintingRuleTag.Smell],
		// ensures all network functions found are actually network functions through its limited config, but doesn't find all network functions since the config is pre-crawled, and the DFG may be over-approximated
		certainty:     LintingRuleCertainty.BestEffort,
		description:   'Marks network functions that execute network operations, such as downloading files or making HTTP requests.',
		defaultConfig: {
			fns: networkFunctions()
		}
	}
} as const satisfies LintingRule<FunctionsResult, FunctionsMetadata, NetworkFunctionsConfig>;
