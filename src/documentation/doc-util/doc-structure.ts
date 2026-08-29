import { prefixLines } from './doc-general';
import { joinWithLast } from '../../util/text/strings';
import { Mermaid } from '../../util/mermaid/mermaid';

export interface DetailsOptions {
	readonly color?:       string;
	readonly open?:        boolean;
	readonly hideIfEmpty?: boolean;
	readonly prefixInit?:  string;
}

/**
 * A collapsible `<details>` block, empty content yielding nothing unless `hideIfEmpty` says otherwise.
 * @param title   - the summary line the block is folded into
 * @param content - what the block holds
 * @param options - how to render it, see {@link DetailsOptions}
 */
export function details(title: string, content: string, { color, open = false, hideIfEmpty = true, prefixInit = '' }: DetailsOptions = {}): string {
	return hideIfEmpty && content.trim().length === 0 ? '' : `
${prefixInit}<details${open ? ' open' : ''}><summary${color ? ' style="color:' + color + '"' : ''}>${title}</summary>

${content}

${prefixInit}</details>`;
}

export interface BlockOptions {
	readonly type:    'NOTE' | 'WARNING' | 'TIP' | 'IMPORTANT';
	readonly content: string;
}

/**
 * A callout block of the given type, as GitHub renders them.
 * @param options - the block's type and content
 */
export function block({ type, content }: BlockOptions): string {
	return `
> [!${type}]
${prefixLines(content, '> ')}
`;
}



/**
 * A section heading with an explicit anchor, so a link to it survives the title being reworded.
 * @param title  - the heading's text
 * @param depth  - the heading level, `2` by default
 * @param anchor - the id to link to, derived from the title by default
 */
export function section(title: string, depth: 1 | 2 | 3 | 4 | 5 | 6 = 2, anchor = Mermaid.escapeId(title)): string {
	return `<h${depth} id="${anchor}">${title}</h${depth}>`;
}


function strToLink(str: string): string {
	const match = str.match(/^(.*?)@(.*)$/);
	if(match) {
		const [, name, link] = match;
		return `[${name}](${link})`;
	}
	return `[${str}](#${Mermaid.escapeId(str)})`;
}
/**
 * Supported pattern: `Name@link`
 */
export function collapsibleToc(content: Record<string, Record<string, Record<string, undefined> | undefined> | undefined>): string {
	let output = '';
	for(const [section, subsections] of Object.entries(content)) {
		output += `- ${strToLink(section)}\n`;
		if(subsections) {
			for(const [subsection, items] of Object.entries(subsections)) {
				output += `  - ${strToLink(subsection)}  \n`;
				if(items) {
					output += `    ${joinWithLast(Object.keys(items).map(strToLink))}\n`;
				}
			}
		}
	}
	return output;
}