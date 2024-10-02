import { prefixLines } from './doc-general';

export interface DetailsOptions {
    readonly color?:       string;
    readonly open?:        boolean;
    readonly hideIfEmpty?: boolean;
    readonly prefixInit?:  string;
}
export function details(title: string, content: string, { color = 'black', open = false, hideIfEmpty = true, prefixInit = '' }: DetailsOptions = {}): string {
	return hideIfEmpty && content.trim().length === 0 ? '' : `
${prefixInit}<details${open ? ' open' : ''}><summary style="color:${color}">${title}</summary>

${content}

</details>
    `;
}

export interface BlockOptions {
    readonly type:    'NOTE' | 'WARNING' | 'INFO' | 'TIP';
    readonly content: string;
}
export function block({ type, content }: BlockOptions): string {
	return `
> [!${type}]
${prefixLines(content, '> ')}
`;
}

