import { jsonReplacer } from '../../util/json';
import { builtInEnvJsonReplacer } from '../../dataflow/environments/environment';

/**
 * Produces a code block in markdown format.
 * @example
 * ```typescript
 * codeBlock('ts', 'const x = 42;');
 * // Produces:
 * //
 * // ```ts
 * // const x = 42;
 * // ```
 * ```
 */
export function codeBlock(language: string, code: string): string {
	return `\n\`\`\`${language}\n${code?.trimEnd() ?? ''}\n\`\`\`\n`;
}

/**
 * Produces an inline code span in markdown format.
 * @example
 * ```typescript
 * codeInline('const x = 42;');
 * // Produces: `<code>const x = 42;</code>`
 * ```
 */
export function codeInline(code: string): string {
	return `<code>${code}</code>`;
}

/**
 * Produces a JSON code block in markdown format, with optional length limit.
 * If the pretty-printed JSON exceeds the limit, a message is shown and the JSON is printed compactly; what
 * still exceeds `hardLimit` characters is cut, as a page GitHub cannot render shows nothing at all.
 */
export function jsonWithLimit(object: object, maxLength: number = 5_000, tooLongText: string = '_As the code is pretty long, we inhibit pretty printing and syntax highlighting (JSON, hiding built-in):_', hardLimit = 20_000): string {
	const prettyPrinted = JSON.stringify(object, jsonReplacer, 2);
	if(prettyPrinted.length <= maxLength) {
		return `\n${codeBlock('json', prettyPrinted)}\n`;
	}
	const compact = JSON.stringify(object, (k, v) => {
		if(typeof v === 'object' && v !== null && 'id' in v && (v as { id: number })['id'] === 0 && 'memory' in v && (v as { memory: undefined | null | object })['memory']) {
			return '<BuiltInEnvironment>';
		} else {
			return builtInEnvJsonReplacer(k, v);
		}
	});
	const shown = compact.length > hardLimit ? `${compact.slice(0, hardLimit)}\n... [${compact.length - hardLimit} more characters cut, run the example to see the whole response]` : compact;
	return `
${tooLongText}
${codeBlock('text', shown)}
`;
}

