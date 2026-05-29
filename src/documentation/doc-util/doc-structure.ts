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
 *
 */
export function details(title: string, content: string, { color, open = false, hideIfEmpty = true, prefixInit = '' }: DetailsOptions = {}): string {
	return hideIfEmpty && content.trim().length === 0 ? '' : `
${prefixInit}<details${open ? ' open' : ''}><summary${color ? ' style="color:' + color + '"' : ''}>${title}</summary>

${content}

${prefixInit}</details>
    `;
}

export interface BlockOptions {
	readonly type:    'NOTE' | 'WARNING' | 'TIP' | 'IMPORTANT';
	readonly content: string;
}

/**
 *
 */
export function block({ type, content }: BlockOptions): string {
	return `
> [!${type}]
${prefixLines(content, '> ')}
`;
}



/**
 *
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