export function codeBlock(language: string, code: string | undefined): string {
	return `\`\`\`${language}\n${code?.trim() ?? ''}\n\`\`\``;
}
