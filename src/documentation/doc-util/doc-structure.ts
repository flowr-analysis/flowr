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

/**
 * A callout block of the given type, as GitHub renders them.
 */
export function block(type: 'NOTE' | 'WARNING' | 'TIP' | 'IMPORTANT', content: string): string {
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
/** a level of a {@link collapsibleToc}, a list of names standing for names without children */
type TocLevel<Children> = readonly string[] | Readonly<Record<string, Children | undefined>>;

function tocEntries<Children>(level: TocLevel<Children>): [string, Children | undefined][] {
	return Array.isArray(level) ? level.map(name => [name, undefined]) : Object.entries(level as Readonly<Record<string, Children | undefined>>);
}

/**
 * Supported pattern: `Name@link`
 */
export function collapsibleToc(content: TocLevel<TocLevel<TocLevel<never>>>): string {
	let output = '';
	for(const [section, subsections] of tocEntries(content)) {
		output += `- ${strToLink(section)}\n`;
		for(const [subsection, items] of subsections ? tocEntries(subsections) : []) {
			output += `  - ${strToLink(subsection)}  \n`;
			if(items) {
				output += `    ${joinWithLast(tocEntries(items).map(([name]) => strToLink(name)))}\n`;
			}
		}
	}
	return output;
}