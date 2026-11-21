/** Wraps the given text in a span with a tooltip if the tooltip is provided. */
export function textWithTooltip(text: string, tooltip?: string): string {
	return tooltip ? `<span title=${JSON.stringify(tooltip)}>${text}</span>` : text;
}
