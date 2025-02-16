import { jsonReplacer } from '../../util/json';

export function codeBlock(language: string, code: string | undefined): string {
	return `\n\`\`\`${language}\n${code?.trim() ?? ''}\n\`\`\`\n`;
}

export function codeInline(code: string): string {
	return `<code>${code}</code>`;
}

export function jsonWithLimit(object: object, maxLength: number = 5_000, tooLongText: string = '_As the code is pretty long, we inhibit pretty printing and syntax highlighting (JSON):_'): string {
	const prettyPrinted = JSON.stringify(object, jsonReplacer, 2);
	return `
${prettyPrinted.length > maxLength ? tooLongText : ''}
${codeBlock(prettyPrinted.length > maxLength ? 'text' : 'json', prettyPrinted.length > 5_000 ? JSON.stringify(object, jsonReplacer) : prettyPrinted)}
`;
}
