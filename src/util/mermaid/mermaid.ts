import { toBase64 } from '../text/url-encoding';


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
	 * Reserved mermaid flowchart keywords that break parsing when used as a bare node id token.
	 */
	reservedIds: new Set([
		'graph', 'flowchart', 'subgraph', 'end', 'style', 'default', 'linkStyle',
		'interpolate', 'classDef', 'class', 'href', 'click', 'call', 'direction'
	]),
	/**
	 * Escapes a string or number to be used as a mermaid node id.
	 */
	escapeId(this: void, text: string | number): string {
		text = String(text).replace(/[^a-zA-Z0-9:\-./]/g, '_');
		/* a dash before a dash or a dot reads as the start of a link, e.g. the id of `$<-.grouped_df` would cut the line in two */
		text = text.replace(/-(?=[-.])/g, '_');
		return text.replace(/(^|[:\-./])([a-zA-Z0-9_]+)/g, (_m, sep: string, tok: string) => sep + (Mermaid.reservedIds.has(tok) ? tok + '_' : tok));
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
		/* `btoa` rather than a `Buffer`, so the pages flowR ships can build this url as well */
		return `https://mermaid.live/${edit ? 'edit' : 'view'}#base64:${toBase64(new TextEncoder().encode(JSON.stringify(obj)))}`;
	}
} as const;