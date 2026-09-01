/**
 * Counts what the running flowR version carries, so a release also shows how the feature set grew.
 * @module
 */
/* the query module has to come first, the linter rules import back into it */
import { SupportedQueries } from '../../queries/query';
import { LintingRules } from '../../linter/linter-rules';
import { DefaultBuiltinConfig } from '../../dataflow/environments/default-builtin-config';
import { BuiltInProcName } from '../../dataflow/environments/built-in-proc-name';
import { BuiltInPlugins } from '../../project/plugins/plugin-registry';
import { PluginType } from '../../project/plugins/flowr-analyzer-plugin';
import type { FlowrFeatureCounts } from './stats';

const DefaultProcessors: readonly string[] = [BuiltInProcName.Default, BuiltInProcName.DefaultReadAllArgs];

/** how many linting rules carry each tag, a rule usually carries several */
function countRuleTags(): Record<string, number> {
	const tags: Record<string, number> = {};
	for(const rule of Object.values(LintingRules ?? {}) as { info?: { tags?: unknown } }[]) {
		const own = rule?.info?.tags;
		if(!Array.isArray(own)) {
			continue;
		}
		for(const tag of own) {
			if(typeof tag === 'string') {
				tags[tag] = (tags[tag] ?? 0) + 1;
			}
		}
	}
	return tags;
}

/** which built-in plugins carry each `PluginType`, which a plugin only states on the instance */
function pluginsByType(): Record<string, string[]> {
	/* every type the version defines, so one nothing is registered for reads as none rather than as missing */
	const types: Record<string, string[]> = Object.fromEntries(Object.values(PluginType).map(t => [t, []]));
	for(const entry of (Array.isArray(BuiltInPlugins) ? BuiltInPlugins : []) as readonly [string, new () => { type?: unknown }][]) {
		let type: unknown;
		try {
			type = new entry[1]().type;
		} catch{
			continue;
		}
		if(typeof type === 'string') {
			(types[type] ??= []).push(entry[0]);
		}
	}
	return types;
}

/**
 * Counts the linting rules, their tags, the queries, the built-in plugins by their type, and the built-in
 * definitions by the handler they use.
 * Every count is defensive, as this also runs against older definitions when the history is filled in.
 */
export function countFeatures(): FlowrFeatureCounts {
	const builtins = (Array.isArray(DefaultBuiltinConfig) ? DefaultBuiltinConfig : []) as readonly Partial<Record<'processor' | 'evalHandler', unknown>>[];
	let def = 0, custom = 0, evals = 0;
	for(const entry of builtins) {
		const processor = entry?.processor;
		if(typeof processor === 'string') {
			if(DefaultProcessors.includes(processor)) {
				def++;
			} else {
				custom++;
			}
		}
		if(entry?.evalHandler !== undefined) {
			evals++;
		}
	}
	const plugins = pluginsByType();
	return {
		lintingRules:                      Object.keys(LintingRules ?? {}).length,
		plugins:                           Array.isArray(BuiltInPlugins) ? BuiltInPlugins.length : 0,
		pluginsByType:                     plugins,
		queries:                           Object.keys(SupportedQueries ?? {}).length,
		builtinDefinitions:                builtins.length,
		builtinDefinitionsDefault:         def,
		builtinDefinitionsCustom:          custom,
		builtinDefinitionsWithEvalHandler: evals,
		lintingRulesByTag:                 countRuleTags()
	};
}
