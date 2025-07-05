import { prefixLines } from './doc-general';
import { escapeId } from '../../util/mermaid/mermaid';

export interface DetailsOptions {
    readonly color?:       string;
    readonly open?:        boolean;
    readonly hideIfEmpty?: boolean;
    readonly prefixInit?:  string;
}
export function details(title: string, content: string, { color, open = false, hideIfEmpty = true, prefixInit = '' }: DetailsOptions = {}): string {
	return hideIfEmpty && content.trim().length === 0 ? '' : `
${prefixInit}<details${open ? ' open' : ''}><summary style="${color ? 'color:' + color : ''}">${title}</summary>

${content}

</details>
    `;
}

export interface BlockOptions {
    readonly type:    'NOTE' | 'WARNING' | 'TIP' | 'IMPORTANT';
    readonly content: string;
}
export function block({ type, content }: BlockOptions): string {
	return `
> [!${type}]
${prefixLines(content, '> ')}
`;
}


export function section(title: string, depth: 1 | 2 | 3 | 4 | 5 | 6 = 2, anchor = escapeId(title)): string {
	return `<h${depth} id="${anchor}">${title}</h${depth}>`;
}