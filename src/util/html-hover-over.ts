export function textWithTooltip(text: string, tooltip?: string): string {
	return tooltip ? `<span title=${JSON.stringify(tooltip)}>${text}</span>` : text;
}
