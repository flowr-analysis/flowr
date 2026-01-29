import type Joi from 'joi';
import { type OutputFormatter , italic , formatter ,  bold, ColorEffect, Colors } from './text/ansi';

interface SchemaLine {
	level: number;
	text:  string;
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
