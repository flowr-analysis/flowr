
/**
 * Global mermaid helper object with useful functions.
 */
export const Mermaid = {
	name:         'Mermaid',
	/**
	 * Replacements applied by escape functions!
	 */
	replacements: {
		// keep newlines
		'\\n': '\n',
		'`':   '#96;',
		'[':   '#91;',
		']':   '#93;',
		'<':   '#60;',
		'>':   '#62;',
		'*':   '#42;',
		'+':   '#43;',
		'-':   '#45;',
		'"':   '#34;',
		'\\':  '#92;',
		'_':   '#95;',
		'{':   '#123;',
		'}':   '#125;',
		'&':   '#38;',
		'\'':  '#39;',
		':':   '#58;',
		'∨':   '#8744;',
		'∧':   '#8743;',
		'¬':   '#172;',
		'→':   '#8594;',
		'↔':   '#8596;',
		'⇒':   '#8658;',
		'⇔':   '#8660;',
		'∀':   '#8704;',
		'∃':   '#8707;',
		'∈':   '#8712;',
		'∉':   '#8713;',
		'∋':   '#8715;',
		'∌':   '#8716;',
		'∩':   '#8745;',
		'∪':   '#8746;',
		'∫':   '#8747;',
		'⊕':   '#8853;',
	},
	/**
	 * Escapes markdown special characters in a string.
	 */
	escape(this: void, text: string): string {
		for(const [key, value] of Object.entries(Mermaid.replacements)) {
			text = text.replaceAll(key, value);
		}
		return text;
	},
	/**
	 * Escapes a string or number to be used as a mermaid node id.
	 */
	escapeId(this: void, text: string | number): string {
		text = String(text).replace(/[^a-zA-Z0-9:-]/g, '_');
		return text;
	},
	/**
	 * Converts mermaid code (potentially produced by {@link DataflowMermaid.convert}) to an url that presents the graph in the mermaid editor.
	 * @param code - code to convert
	 * @param edit - if true, the url will point to the editor, otherwise it will point to the viewer
	 */
	codeToUrl(this: void, code: string, edit = false): string {
		const obj = {
			code,
			mermaid: {
				autoSync: true
			}
		};
		return `https://mermaid.live/${edit ? 'edit' : 'view'}#base64:${Buffer.from(JSON.stringify(obj)).toString('base64')}`;
	}
} as const;