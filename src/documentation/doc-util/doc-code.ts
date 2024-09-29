export function codeBlock(language: string, code: string | undefined): string {
	return `\n\`\`\`${language}\n${code?.trim() ?? ''}\n\`\`\`\n`;
}
