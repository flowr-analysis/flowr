import { jsonReplacer } from '../../util/json';
import { builtInEnvJsonReplacer } from '../../dataflow/environments/environment';

/**
 *
 */
export function codeBlock(language: string, code: string): string {
	return `\n\`\`\`${language}\n${code?.trim() ?? ''}\n\`\`\`\n`;
}

/**
 *
 */
export function codeInline(code: string): string {
	return `<code>${code}</code>`;
}

/**
 *
 */
export function jsonWithLimit(object: object, maxLength: number = 5_000, tooLongText: string = '_As the code is pretty long, we inhibit pretty printing and syntax highlighting (JSON, hiding built-in):_'): string {
	const prettyPrinted = JSON.stringify(object, jsonReplacer, 2);
	return `
${prettyPrinted.length > maxLength ? tooLongText : ''}
${codeBlock(prettyPrinted.length > maxLength ? 'text' : 'json', prettyPrinted.length > 5_000 ? JSON.stringify(object,
	(k, v) => {
		if(typeof v === 'object' && v !== null && 'id' in v && (v as {id: number})['id'] === 0 && 'memory' in v && (v as {memory: undefined | null | object})['memory']) {
			return '<BuiltInEnvironment>';
		} else {
			return builtInEnvJsonReplacer(k, v);
		}
	}
) : prettyPrinted)}
`;
}
