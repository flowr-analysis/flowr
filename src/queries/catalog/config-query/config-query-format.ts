import type { BaseQueryFormat, BaseQueryResult } from '../../base-query-format';
import { executeConfigQuery } from './config-query-executor';
import { bold, italic, type OutputFormatter } from '../../../util/text/ansi';
import { printAsMs } from '../../../util/text/time';
import Joi from 'joi';
import { FlowrConfig } from '../../../config';
import { jsonReplacer } from '../../../util/json';
import type { DeepPartial } from 'ts-essentials';
import type { ParsedQueryLine, Query, SupportedQuery } from '../../query';
import type { ReplOutput } from '../../../cli/repl/commands/repl-main';
import type { CommandCompletions } from '../../../cli/repl/core';
import { descriptionPathInfo, type SchemaPathInfo } from '../../../util/schema';

export interface ConfigQuery extends BaseQueryFormat {
	readonly type:     'config';
	readonly update?:  DeepPartial<FlowrConfig>
	/** a `.`-separated path to inspect (read) a single config value instead of dumping the whole config (repl: `?path`) */
	readonly inspect?: readonly string[]
}

export interface ConfigQueryResult extends BaseQueryResult {
	readonly config: FlowrConfig;
}

function configReplCompleter(partialLine: readonly string[], _startingNewArg: boolean, config: FlowrConfig): CommandCompletions {
	if(partialLine.length === 0) {
		// `+` updates a field, `?` inspects (reads) one
		return { completions: ['+', '?'] };
	} else if(partialLine.length === 1 && (partialLine[0].startsWith('+') || partialLine[0].startsWith('?'))) {
		const inspect = partialLine[0].startsWith('?');   // a read: complete the key path, but never append `=`
		const raw = partialLine[0].slice(1);
		// once a value is being assigned (`key=...`), the path is fixed: complete the value (its type), not more keys
		if(raw.includes('=')) {
			if(inspect) {
				return { completions: [] };   // `?` reads a value, it never assigns one
			}
			const eq = raw.indexOf('=');
			const keyPath = raw.slice(0, eq).split('.').filter(p => p.length > 0);
			const valuePart = raw.slice(eq + 1);
			const prefix = `${partialLine[0].slice(0, 1)}${raw.slice(0, eq)}=`;
			const values = configValueHints(configSchemaInfo(keyPath)).filter(v => v.startsWith(valuePart) && v !== valuePart);
			return { completions: values.map(v => prefix + v) };
		}
		const path = raw.split('.').filter(p => p.length > 0);
		const fullPath = path.slice();
		const lastPath = partialLine[0].endsWith('.') ? '' : path.pop() ?? '';
		const subConfig = path.reduce<object | undefined>((obj, key) => (
			obj && (obj as Record<string, unknown>)[key] !== undefined && typeof (obj as Record<string, unknown>)[key] === 'object') ? (obj as Record<string, unknown>)[key] as object : obj, config);
		if(subConfig && !((subConfig as Record<string, unknown>)[lastPath] !== undefined && typeof (subConfig as Record<string, unknown>)[lastPath] !== 'object')) {
			const have = Object.keys(subConfig)
				.filter(k => k.startsWith(lastPath) && k !== lastPath)
				.map(k => `${partialLine[0].slice(0, 1)}${[...path, k].join('.')}`);
			if(have.length > 0) {
				return { completions: have };
			} else if(lastPath.length > 0) {
				return { completions: [`${partialLine[0].slice(0, 1)}${fullPath.join('.')}.`] };
			}
		}
		const leaf = `${partialLine[0].slice(0, 1)}${fullPath.join('.')}`;
		if(!inspect) {
			const values = configValueHints(configSchemaInfo(fullPath));   // a boolean/enum offers its values, others a `<type>` hint
			if(values.length > 0) {
				return { completions: values.map(v => `${leaf}=${v}`) };
			}
		}
		return { completions: [`${leaf}${inspect ? '' : '='}`] };
	}

	return { completions: [] };
}

function configQueryLineParser(output: ReplOutput, line: readonly string[], _config: FlowrConfig): ParsedQueryLine<'config'> {
	if(line.length > 0 && line[0].startsWith('?')) {
		// inspect a single key, e.g. `?solver.sigdb.enabled`
		const path = line[0].slice(1).split('.').filter(p => p.length > 0);
		if(path.length === 0) {
			output.stdout(`Invalid config inspect syntax, must be of the form ${bold('?path.to.field', output.formatter)}`);
		} else {
			return { query: [{ type: 'config', inspect: path }] };
		}
	}
	if(line.length > 0 && line[0].startsWith('+')) {
		const [pathPart, ...valueParts] = line[0].slice(1).split('=');
		// build the update object
		const path = pathPart.split('.').filter(p => p.length > 0);
		if(path.length === 0 || valueParts.length !== 1) {
			output.stdout(`Invalid config update syntax, must be of the form ${bold('+path.to.field=value', output.formatter)}`);
		} else {
			const update: DeepPartial<FlowrConfig> = {};
			const value = valueParts[0];
			let current: Record<string, unknown> = update;
			for(let i = 0; i < path.length; i++) {
				const key = path[i];
				if(i === path.length - 1) {
					// last part, set the value
					// try to parse as JSON first
					try {
						current[key] = JSON.parse(value);
					} catch{
						// fallback to string
						current[key] = value;
					}
				} else {
					current[key] = {};
					current = current[key] as Record<string, unknown>;
				}
			}
			return { query: [{ type: 'config', update }]
			};
		}
	}
	return { query: [{ type: 'config' }]
	};
}

function collectKeysFromUpdate(update: DeepPartial<FlowrConfig>, prefix: string = ''): string[] {
	// only collect leaf keys
	const keys: string[] = [];
	for(const [key, value] of Object.entries(update)) {
		const fullKey = prefix ? `${prefix}.${key}` : key;
		if(value && typeof value === 'object' && !Array.isArray(value)) {
			keys.push(...collectKeysFromUpdate(value as DeepPartial<FlowrConfig>, fullKey));
		} else {
			keys.push(fullKey);
		}
	}
	return keys;
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
/** the Joi-schema type + description of a config path (from {@link FlowrConfig.Schema}), used to document a `?key` inspection */
function configSchemaInfo(path: readonly string[]): SchemaPathInfo {
	configSchemaDescription ??= FlowrConfig.Schema.describe();
	return descriptionPathInfo(configSchemaDescription, path);
}

/** value completions for a config leaf: both booleans, an enum's members, or a compact `<type>` hint */
function configValueHints(info: SchemaPathInfo): string[] {
	if(info.type === 'boolean') {
		return ['true', 'false'];
	}
	if(info.valids && info.valids.length > 0) {
		return info.valids.map(v => JSON.stringify(v));
	}
	return info.type ? [`<${info.type}>`] : [];
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
				const value = JSON.stringify(getValueAtPath(out.config, [...path]), jsonReplacer);
				result.push(`       - ${path.join('.')}${info.type ? ` ${italic(`(${info.type})`, formatter)}` : ''}: ${value}`);
				if(info.description) {
					result.push(`           ${italic(info.description, formatter)}`);
				}
			}
		} else {
			result.push(`   ╰ Config:\n${JSON.stringify(out.config, jsonReplacer, 4)}`);
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
