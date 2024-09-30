import {prefixLines} from "./doc-general";

export interface DetailsOptions {
    readonly color?: string;
    readonly open?: boolean;
    readonly hideIfEmpty?: boolean;
}
export function details(title: string, content: string, { color = 'black', open = false, hideIfEmpty = true }: DetailsOptions = {}): string {
    return hideIfEmpty && content.trim().length === 0 ? '' : `
<details${open ? ' open' : ''}><summary style="color:${color}">${title}</summary>

${content}

</details>
    `
}

export interface BlockOptions {
    readonly type: 'NOTE' | 'WARNING' | 'INFO' | 'TIP';
    readonly content: string;
    readonly title?: string;
}
export function block({ type, content, title = ''}: BlockOptions): string {
    return `
> [!${type}] ${title}
${prefixLines(content, '> ')}
`
}

