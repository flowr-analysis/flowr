/**
 * Escapes HTML special characters in a string.
 *
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
