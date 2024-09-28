export function codeBlock(language: string, code: string): string {
	return `\`\`\`${language}\n${code}\n\`\`\``;
}
