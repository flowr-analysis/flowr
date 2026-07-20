import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { executeConfigQuery } from './config-query-executor';
import { bold, italic, voidFormatter, type OutputFormatter } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import { FlowrConfig } from '../../../config';
import { jsonReplacer } from '../../../util/json';
import type { DeepPartial } from 'ts-essentials';
import type { ParsedQueryLine, Query, SupportedQuery } from '../../query';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import { type CommandCompletions, describeCompletion } from '../../../cli/repl/core';
import { descriptionPathInfo, type SchemaPathInfo, descriptionPathKeys, firstUnknownSchemaSegment } from '../../../util/schema';
import type { ProjectKind } from '../../../project/context/project-kind';
import { matchByPrefixOrSubsequence } from '../../../util/text/strings';

export interface ConfigQuery extends BaseQueryFormat {
	readonly type:     'config';
	readonly update?:  DeepPartial<FlowrConfig>
	/** a `.`-separated path to inspect (read) a single config value instead of dumping the whole config (repl: `path`) */
	readonly inspect?: readonly string[]
}

export interface ConfigQueryResult extends BaseQueryResult {
	readonly config:          FlowrConfig;
	/** the project-kind specialization applied to {@link config}, if any (surfaced in the repl summary) */
	readonly specialization?: { readonly kind: ProjectKind, readonly overwrite: DeepPartial<FlowrConfig> };
}

function configReplCompleter(partialLine: readonly string[], startingNewArg: boolean, _config: FlowrConfig): CommandCompletions {
	// the config query is a single token
	if(partialLine.length > 1 || (partialLine.length === 1 && startingNewArg)) {
		return { completions: [] };
	}
	const token = partialLine[0] ?? '';
	const update = token.startsWith('+');
	const raw = update ? token.slice(1) : token;
	const sigil = update ? '+' : '';
	// on the empty token also offer `+` (writes a value) before the inspectable keys (which read); label it like the keys
	const lead = token.length === 0 ? ['+'] : [];
	const leadLabels: [string, string][] = token.length === 0 ? [['+', describeCompletion('+', 'change config values')]] : [];
	// once `+key=` is typed, complete the value (its type), not more keys
	if(update && raw.includes('=')) {
		const eq = raw.indexOf('=');
		const keyPath = raw.slice(0, eq).split('.').filter(p => p.length > 0);
		const valuePart = raw.slice(eq + 1);
		const prefix = `+${raw.slice(0, eq)}=`;
		const { concrete, placeholder } = splitValueHints(configSchemaInfo(keyPath));
		const values = matchByPrefixOrSubsequence(concrete, valuePart);
		return {
			completions: values.map(v => prefix + v),
			labels:      new Map(values.map(v => [prefix + v, v])),
			hints:       placeholder !== undefined && valuePart.length === 0 ? [prefix + placeholder] : undefined
		};
	}
	const path = raw.split('.').filter(p => p.length > 0);
	const fullPath = path.slice();
	const lastPath = token.endsWith('.') ? '' : path.pop() ?? '';
	/* the schema knows every option, a value only those that are set */
	const options = configSchemaKeys(path);
	const atLeaf = lastPath.length > 0 && options.includes(lastPath) && configSchemaInfo([...path, lastPath]).type !== 'object';
	if(!atLeaf) {
		const offered = matchByPrefixOrSubsequence(options, lastPath);
		const have = offered.map(k => `${sigil}${[...path, k].join('.')}`);
		if(have.length > 0) {
			// label starts with the full completion (incl. sigil) so readline keeps the sigil on common-prefix insertion
			return { completions: [...lead, ...have], labels: new Map([...leadLabels, ...have.map((c, i): [string, string] => [c, describeCompletion(c, configSchemaInfo([...path, offered[i]]).type ?? '')])]) };
		} else if(lastPath.length > 0 && configSchemaKeys(fullPath).length > 0) {
			return { completions: [`${sigil}${fullPath.join('.')}.`] };
		}
	}
	const leafInfo = configSchemaInfo(fullPath);
	if(leafInfo.type === undefined) {
		return { completions: [] };   // not a real config key: offer nothing (in particular, never append `=`)
	}
	const leaf = `${sigil}${fullPath.join('.')}`;
	if(update) {
		const { concrete, placeholder } = splitValueHints(leafInfo);
		if(concrete.length > 0) {   // a boolean/enum offers its values to Tab
			return { completions: concrete.map(v => `${leaf}=${v}`) };
		}
		if(placeholder !== undefined) {   // a free type: complete up to `=` and only *show* the `<type>`, never insert it
			return { completions: [`${leaf}=`], hints: [`${leaf}=${placeholder}`] };
		}
	}
	return { completions: [`${leaf}${update ? '=' : ''}`] };
}

/** an error message if `path` is not a key of the config schema (naming the first unknown segment and its real siblings), or `undefined` if it is a valid key */
function unknownConfigKey(path: readonly string[], formatter: OutputFormatter): string | undefined {
	configSchemaDescription ??= FlowrConfig.Schema.describe();
	const unknown = firstUnknownSchemaSegment(configSchemaDescription, path);
	if(unknown === undefined) {
		return undefined; // every segment is a known (or pattern-/free-form-accepted) key
	}
	const where = unknown.at.length === 0 ? 'the top level' : bold(unknown.at.join('.'), formatter);
	return `Unknown config key ${bold(path.join('.'), formatter)}: no ${bold(unknown.segment, formatter)} at ${where}. Available: ${[...unknown.available].join(', ') || '(none)'}`;
}

/** an error message if `value` does not fit the schema type at `path`, or `undefined` if it fits */
function badConfigValue(path: readonly string[], value: unknown, formatter: OutputFormatter): string | undefined {
	const info = configSchemaInfo(path);
	const expected = (t: string): string => `${bold(path.join('.'), formatter)} expects a ${t}, got ${bold(JSON.stringify(value), formatter)}`;
	if(info.valids && info.valids.length > 0 && !info.valids.includes(value)) {
		return expected(`one of ${info.valids.map(v => JSON.stringify(v)).join(', ')}`);
	}
	if(info.type === 'boolean' && typeof value !== 'boolean') {
		return expected('boolean (true/false)');
	}
	if(info.type === 'number' && typeof value !== 'number') {
		return expected('number');
	}
	if(info.type === 'string' && typeof value !== 'string') {
		return expected('string');
	}
	if(info.type === 'array' && !Array.isArray(value)) {
		return expected('list (e.g. ["a","b"])');
	}
	if(info.type === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
		return `${bold(path.join('.'), formatter)} is a config section, not a value to set; set one of its fields instead`;
	}
	return undefined;
}

/** yields each leaf `[path, value]` of a (possibly nested) config update object */
function* configUpdateLeaves(update: object, prefix: readonly string[] = []): Generator<[string[], unknown]> {
	for(const [key, value] of Object.entries(update)) {
		const path = [...prefix, key];
		if(value !== null && typeof value === 'object' && !Array.isArray(value)) {
			yield* configUpdateLeaves(value as object, path);
		} else {
			yield [path, value];
		}
	}
}

/**
 * The first schema violation (an unknown key or a wrong-typed value) in a config update, or `undefined` if it is
 * valid. Shared by the repl line parser and the {@link executeConfigQuery|executor}, so a programmatic or JSON-API
 * update is validated exactly like a `:config +key=value` line and never merges junk or a mistyped value.
 */
export function validateConfigUpdate(update: DeepPartial<FlowrConfig>, formatter: OutputFormatter = voidFormatter): string | undefined {
	for(const [path, value] of configUpdateLeaves(update as object)) {
		const err = unknownConfigKey(path, formatter) ?? badConfigValue(path, value, formatter);
		if(err !== undefined) {
			return err;
		}
	}
	return undefined;
}

function configQueryLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'config'> {
	const first = line[0] ?? '';
	if(first.startsWith('+')) {
		const [pathPart, ...valueParts] = first.slice(1).split('=');
		// build the update object
		const path = pathPart.split('.').filter(p => p.length > 0);
		if(path.length === 0 || valueParts.length !== 1) {
			return configError(output, `Invalid config update syntax, must be of the form ${bold('+path.to.field=value', output.formatter)}`);
		}
		const raw = valueParts[0];
		let value: unknown;
		try {
			value = JSON.parse(raw); // numbers, booleans, arrays, ...
		} catch{
			value = raw; // fall back to a plain string
		}
		const update = path.reduceRight<unknown>((acc, key) => ({ [key]: acc }), value) as DeepPartial<FlowrConfig>;
		const err = validateConfigUpdate(update, output.formatter);
		return err !== undefined ? configError(output, err) : { query: [{ type: 'config', update }] };
	}
	// a plain path inspects that part; an empty suffix dumps the whole config
	const path = first.split('.').filter(p => p.length > 0);
	if(path.length === 0) {
		return { query: [{ type: 'config' }] };
	}
	const unknown = unknownConfigKey(path, output.formatter);
	return unknown !== undefined ? configError(output, unknown) : { query: [{ type: 'config', inspect: path }] };
}

/** report a parse/validation error for the line and produce no query, so nothing runs and the config is not dumped */
function configError(output: ReplOutput, message: string): ParsedQueryLine<'config'> {
	output.stdout(message);
	return { query: undefined };
}

/** the dotted leaf keys of a (possibly nested) config update object */
function collectKeysFromUpdate(update: DeepPartial<FlowrConfig>): string[] {
	return [...configUpdateLeaves(update as object)].map(([path]) => path.join('.'));
}

function getValueAtPath(obj: object, path: string[]): unknown {
	let current: unknown = obj;
	for(const key of path) {
		if(current && typeof current === 'object' && (current as Record<string, unknown>)[key] !== undefined) {
			current = (current as Record<string, unknown>)[key];
		} else {
			return undefined;
		}
	}
	return current;
}

let configSchemaDescription: Joi.Description | undefined;
/** the keys the schema offers below a path, including the unset optional ones */
function configSchemaKeys(path: readonly string[]): string[] {
	configSchemaDescription ??= FlowrConfig.Schema.describe();
	return descriptionPathKeys(configSchemaDescription, path);
}

/** the Joi-schema type + description of a config path (from {@link FlowrConfig.Schema}), used to document a key inspection */
function configSchemaInfo(path: readonly string[]): SchemaPathInfo {
	configSchemaDescription ??= FlowrConfig.Schema.describe();
	return descriptionPathInfo(configSchemaDescription, path);
}

/** value completions for a config leaf: booleans, an enum's members (offered bare, like `true`/`false`), or a compact `<type>` hint */
function configValueHints(info: SchemaPathInfo): string[] {
	if(info.type === 'boolean') {
		return ['true', 'false'];
	}
	if(info.valids && info.valids.length > 0) {
		// a string enum completes as its bare member (like a boolean); non-strings keep their JSON form
		return info.valids.map(v => typeof v === 'string' ? v : JSON.stringify(v));
	}
	return info.type ? [`<${info.type}>`] : [];
}

/** the leaf's `concrete` completable values (booleans/enum members) vs a `<type>` `placeholder` that is only shown, never inserted */
function splitValueHints(info: SchemaPathInfo): { concrete: string[], placeholder: string | undefined } {
	const hints = configValueHints(info);
	return { concrete: hints.filter(v => !v.startsWith('<')), placeholder: hints.find(v => v.startsWith('<')) };
}

/** children of an inspected object listed before the rest is summarized */
const MaxInspectedChildren = 15;

/** the longest a child's value may get before only its size is shown */
const MaxInspectedValueWidth = 48;

/** a nested object is only summarized, inspecting it directly unfolds it */
function compactValue(value: unknown): string {
	const json = JSON.stringify(value, jsonReplacer);
	if(value === null || typeof value !== 'object' || json.length <= MaxInspectedValueWidth) {
		return json;
	}
	const keys = Array.isArray(value) ? value.length : Object.keys(value).length;
	return Array.isArray(value) ? `[${keys} entries]` : `{${keys} keys}`;
}

/** an object reads better as its children than as one json blob */
function inspectedChildren(value: object, path: readonly string[], formatter: OutputFormatter): string[] {
	const entries = Object.entries(value);
	const shown = entries.slice(0, MaxInspectedChildren);
	const longest = Math.max(...shown.map(([key]) => key.length));
	const lines = shown.map(([key, child]) => {
		const type = configSchemaInfo([...path, key]).type;
		return `           - ${(key + ':').padEnd(longest + 1)} ${compactValue(child)}`
			+ (type ? ` ${italic(`(${type})`, formatter)}` : '');
	});
	if(entries.length > shown.length) {
		lines.push(`           ${italic(`... and ${entries.length - shown.length} more, inspect them with ${path.join('.')}.<key>`, formatter)}`);
	}
	return lines;
}

export const ConfigQueryDefinition = {
	executor:        executeConfigQuery,
	asciiSummarizer: (formatter: OutputFormatter, _analyzer: unknown, queryResults: BaseQueryResult, result: string[], queries: readonly Query[]) => {
		const out = queryResults as ConfigQueryResult;
		result.push(`Query: ${bold('config', formatter)} (${printAsMs(out['.meta'].timing, 0)})`);
		const configQueries = queries.filter(q => q.type === 'config');
		const inspects = configQueries.filter(q => q.inspect).map(q => q.inspect as readonly string[]);
		if(configQueries.some(q => q.update)) {
			const updatedKeys = configQueries.flatMap(q => q.update ? collectKeysFromUpdate(q.update) : []);
			result.push('   ╰ Updated configuration:');
			for(const key of updatedKeys) {
				const path = key.split('.');
				const newValue = getValueAtPath(out.config, path);
				result.push(`       - ${key}: ${JSON.stringify(newValue, jsonReplacer)}`);
			}
		} else if(inspects.length > 0) {
			result.push('   ╰ Config:');
			for(const path of inspects) {
				const info = configSchemaInfo(path);
				const value = getValueAtPath(out.config, [...path]);
				const type = info.type ? ` ${italic(`(${info.type})`, formatter)}` : '';
				const children = value !== null && typeof value === 'object' && !Array.isArray(value)
					? inspectedChildren(value, path, formatter) : undefined;
				result.push(`       - ${path.join('.')}${type}${children ? '' : `: ${JSON.stringify(value, jsonReplacer)}`}`);
				if(info.description) {
					result.push(`           ${italic(info.description, formatter)}`);
				}
				result.push(...children ?? []);
			}
		} else {
			result.push(`   ╰ Config:\n${JSON.stringify(out.config, jsonReplacer, 4)}`);
		}
		if(out.specialization) {
			const keys = collectKeysFromUpdate(out.specialization.overwrite);
			result.push(`   ╰ Specialized for project kind ${bold(out.specialization.kind, formatter)} (overrides ${keys.join(', ') || '(nothing)'})`);
		} else {
			result.push(`   ╰ ${italic('No project-kind specialization in effect', formatter)}`);
		}
		return true;
	},
	completer: configReplCompleter,
	fromLine:  configQueryLineParser,
	schema:    Joi.object({
		type:    Joi.string().valid('config').required().description('The type of the query.'),
		update:  Joi.object().optional().description('An optional partial configuration to update the current configuration with before returning it. Only the provided fields will be updated, all other fields will remain unchanged.'),
		inspect: Joi.array().items(Joi.string()).optional().description('An optional `.`-separated path (as a string array) to read a single configuration value instead of returning the whole configuration.')
	}).description('The config query retrieves the current configuration of the flowR instance and optionally also updates it.'),
	flattenInvolvedNodes: () => []
} as const satisfies SupportedQuery<'config'>;
