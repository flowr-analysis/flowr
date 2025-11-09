/**
 * Escapes HTML special characters in a string.
 * @param str - The string to escape
 * @returns The escaped string
 */
export function escapeHTML(str: string | undefined): string | undefined {
	return str?.replace(
		/[&<>"']/g,
		(tag) =>
			({
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#39;',
			}[tag] ?? tag)
	);
}

/**
 * Escapes newline characters in a string (Supports Windows and Unix newlines).
 *
 * @param str - The string to escape
 * @returns The escaped string
 */
export function escapeNewline(str: string): string {
	return str.replace(/([\n\r])/g, (match) => {
		return match == '\n' ? '\\n' : '\\r';
	});
}
