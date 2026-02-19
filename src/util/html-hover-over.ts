/**
 * Wraps the given text in a span with a tooltip if the tooltip is provided.
 * @param text    - The text to wrap
 * @param tooltip - The tooltip to add
 */
export function textWithTooltip(text: string, tooltip?: string): string {
	return tooltip ? `<span title=${JSON.stringify(tooltip)}>${text}</span>` : text;
}
