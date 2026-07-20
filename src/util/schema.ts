import type Joi from 'joi';
import { type OutputFormatter, italic, formatter,  bold, ColorEffect, Colors } from './text/ansi';

interface SchemaLine {
	level: number;
	text:  string;
}

/** the leaf type, description, and any enumerated valid values of a schema path */
export interface SchemaPathInfo {
	readonly type?:        string;
	readonly description?: string;
	readonly valids?:      readonly unknown[];
}

/**
 * A `.pattern()` object (`versionOverrides`, `specializeConfig`, ...) as `{ value, keyValids? }`: the value schema
 * any key maps to, plus the keys the pattern restricts to when its key schema is a `.valid(...)` enum (e.g.
 * `specializeConfig`'s ProjectKinds); `keyValids` is absent for a free-string key. `undefined` when not a pattern
 * object. Only the first pattern is considered -- the config schema uses a single pattern per object.
 */
function patternObject(node: Joi.Description | undefined): { readonly value: Joi.Description | undefined, readonly keyValids?: readonly unknown[] } | undefined {
	const patterns = (node as { patterns?: { schema?: { allow?: readonly unknown[] }, rule?: Joi.Description }[] } | undefined)?.patterns;
	if(!patterns || patterns.length === 0) {
		return undefined;
	}
	const allow = patterns[0].schema?.allow;
	return allow && allow.length > 0 ? { value: patterns[0].rule, keyValids: allow } : { value: patterns[0].rule };
}

/**
 * Descend one key into a Joi {@link Joi.Description|description}: an explicit sub-key, or -- for a `.pattern()`
 * object -- the {@link patternObject|pattern's value schema}, since any key matches there.
 */
function descendDescription(node: Joi.Description | undefined, key: string): Joi.Description | undefined {
	return (node?.keys as Record<string, Joi.Description> | undefined)?.[key] ?? patternObject(node)?.value;
}

/** walk a Joi schema {@link Joi.Description|description} down a key path (see {@link descendDescription}) */
function descendDescriptionPath(description: Joi.Description, path: readonly string[]): Joi.Description | undefined {
	let node: Joi.Description | undefined = description;
	for(const key of path) {
		node = descendDescription(node, key);
		if(node === undefined) {
			return undefined;
		}
	}
	return node;
}

/** walk a Joi schema {@link Joi.Description|description} down a key path, returning the leaf's {@link SchemaPathInfo} (empty if the path does not exist) */
export function descriptionPathInfo(description: Joi.Description, path: readonly string[]): SchemaPathInfo {
	const node = descendDescriptionPath(description, path);
	if(node === undefined) {
		return {};
	}
	const allow = (node as { allow?: readonly unknown[] }).allow;
	return {
		type:        node.type,
		description: (node.flags as { description?: string } | undefined)?.description,
		valids:      allow && allow.length > 0 ? allow : undefined
	};
}

/** {@link descriptionPathInfo} straight from a schema (describes it once per call) */
export function schemaPathInfo(schema: Joi.Schema, path: readonly string[]): SchemaPathInfo {
	return descriptionPathInfo(schema.describe(), path);
}

/** Joi types that cannot have sub-keys, so a config path may not descend into them. */
const ScalarSchemaTypes = new Set(['boolean', 'number', 'string', 'array', 'date', 'binary', 'symbol', 'function']);

/**
 * The first path segment the schema does not accept, with the keys that ARE accepted there and the path to that
 * point -- or `undefined` when the whole path is a settable key. Used to reject typo'd config keys. A `.pattern()`
 * object accepts any key (validation continues into its value schema) and an `.unknown(true)` object (e.g. a
 * `specializeConfig` entry, which may overwrite any config key) accepts any key, so neither is reported as unknown.
 */
export function firstUnknownSchemaSegment(description: Joi.Description, path: readonly string[]): { readonly segment: string, readonly available: readonly string[], readonly at: readonly string[] } | undefined {
	let node: Joi.Description | undefined = description;
	for(let i = 0; i < path.length; i++) {
		const explicit: Joi.Description | undefined = (node?.keys as Record<string, Joi.Description> | undefined)?.[path[i]];
		if(explicit === undefined) {
			const pattern = patternObject(node);
			if(pattern !== undefined) {
				if(pattern.keyValids !== undefined && !pattern.keyValids.includes(path[i])) {
					return { segment: path[i], available: pattern.keyValids.map(v => String(v)), at: path.slice(0, i) };
				}
				node = pattern.value;
				continue;
			}
		}
		if((node?.flags as Record<string, unknown> | undefined)?.['unknown'] === true) {
			return undefined; // `.unknown(true)`: any further key is accepted here
		}
		const keys = node?.keys as Record<string, Joi.Description> | undefined;
		if(keys === undefined) {
			if(node?.type !== undefined && ScalarSchemaTypes.has(node.type)) {
				return { segment: path[i], available: [], at: path.slice(0, i) };
			}
			return undefined;
		}
		const next = keys[path[i]];
		if(next === undefined) {
			return { segment: path[i], available: Object.keys(keys), at: path.slice(0, i) };
		}
		node = next;
	}
	return undefined;
}

/**
 * The keys a schema {@link Joi.Description|description} offers below `path`, i.e. every option that may be set there.
 * In contrast to the keys of a value, this covers the optional ones that are unset as well.
 */
export function descriptionPathKeys(description: Joi.Description, path: readonly string[]): string[] {
	const node = descendDescriptionPath(description, path);
	if(node === undefined) {
		return [];
	}
	const keys = Object.keys((node.keys ?? {}) as Record<string, Joi.Description>);
	// a `.pattern()` object declares no keys, but a `.valid(...)` key schema restricts them to a known set
	const valids = patternObject(node)?.keyValids?.map(v => String(v)) ?? [];
	return [...keys, ...valids.filter(v => !keys.includes(v))];
}

/**
 * Describes a Joi schema in a human-readable way.
 */
export function describeSchema(schema: Joi.Schema, f: OutputFormatter = formatter): string {
	const description = schema.describe();
	const lines = genericDescription(1, f, f.format('.', { effect: ColorEffect.Foreground, color: Colors.White }), description);
	const indent = ' '.repeat(4);
	return lines.map(line => `${indent.repeat(line.level - 1)}${line.text}`).join('\n');
}

/**
 * Provides a generic description for any Joi schema.
 * You probably want to use {@link describeSchema}.
 */
export function genericDescription(level: number, formatter: OutputFormatter, name: string, desc: Joi.Description | undefined): SchemaLine[] {
	if(!desc) {
		return [];
	}
	const lines = [...headerLine(level, formatter, name, desc.type ?? 'unknown', desc.flags)];
	if('allow' in desc) {
		lines.push({ level: level + 1, text: `Only allows: ${(desc['allow'] as string[]).map(v => "'" + v + "'").join(', ')}` });
	}
	switch(desc.type) {
		case 'object':
			lines.push(...describeObject(level, formatter, desc));
			break;
		case 'alternatives':
			if('matches' in desc) {
				lines.push(
					...(desc['matches'] as { schema: Joi.Description }[])
						.flatMap(({ schema }) => genericDescription(level + 1, formatter, '.', schema))
				);
			}
			break;
		case 'array':
			if('items' in desc) {
				lines.push({ text: 'Valid item types:', level: level });
				lines.push(
					...(desc['items'] as Joi.Description[])
						.flatMap(desc => genericDescription(level + 1, formatter, '.', desc))
				);
			}
			break;
		default:
			/* specific support for others if needed */
			break;
	}
	return lines;
}

function printFlags(flags: object | undefined): string {
	if(!flags || Object.keys(flags).length === 0) {
		return '';
	}
	let flagText = '';
	if('presence' in flags) {
		flagText += String(flags['presence']);
	}
	return flagText.trim().length > 0 ? '[' + flagText + '] ' : '';
}

/**
 * Creates the header line(s) for a schema description.
 */
export function headerLine(level: number, formatter: OutputFormatter, name: string, type: string, flags: object | undefined): SchemaLine[] {
	const fnam = name === '.' ? '' : bold(name, formatter) + ' ';
	const fdesc = flags && 'description' in flags ? italic(flags['description'] as string, formatter) + ' ' : '';
	const text = `- ${fnam}${printFlags(flags)}${fdesc}(${formatter.format(type, { effect: ColorEffect.Foreground, color: Colors.White })})`;
	return [{ level, text }];
}

/**
 * Describes a Joi object schema.
 */
export function describeObject(level: number, formatter: OutputFormatter, desc: Joi.Description): SchemaLine[] {
	let lines: SchemaLine[] = [];

	if(!('keys' in desc)) {
		return lines;
	}
	for(const key in desc.keys) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		const keySchema = desc.keys[key] as Joi.Description;
		lines = lines.concat(genericDescription(level + 1, formatter, key, keySchema));
	}

	return lines;
}
