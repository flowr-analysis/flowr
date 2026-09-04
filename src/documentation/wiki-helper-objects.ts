import fs from 'fs';
import path from 'path';
import { guard, isNotUndefined } from '../util/assert';
import { section } from './doc-util/doc-structure';
import { Mermaid } from '../util/mermaid/mermaid';
import type { DocMakerArgs } from './wiki-mk/doc-maker';
import { DocMaker } from './wiki-mk/doc-maker';

/** A category of helper objects, the ones whose `@helper` tag names it, that answer questions about the same thing. */
interface HelperCategory {
	readonly id:      string;
	readonly title:   string;
	/**
	 * The path every helper of that family is declared under. The completeness check counts those as covered,
	 * so a new one there needs no tag, and one that belongs nowhere is still caught.
	 */
	readonly alsoIn?: string;
}

/**
 * The categories a helper object may declare with `@helper <category> <what it is>`, by what they are *about*
 * rather than by where the objects happen to live.
 */
const Categories: readonly HelperCategory[] = [
	{ id: 'ast',          title: 'Normalized AST', alsoIn: 'r-bridge/lang-4.x/ast/model' },
	{ id: 'dataflow',     title: 'Dataflow graph' },
	{ id: 'control-flow', title: 'Control flow graph' },
	{ id: 'location',     title: 'Location' },
	{ id: 'values',       title: 'Names and values' },
	{ id: 'api',          title: 'Asking flowR' },
	{ id: 'project',      title: 'Configuration and context' },
	{ id: 'output',       title: 'Output' }
];

/** A helper object as its source declares it: where it is, and what its `@helper` tag says about it. */
interface DeclaredHelper {
	readonly file:      string;
	readonly category?: string;
	readonly summary?:  string;
}

/**
 * Every `export const X = { name: 'X', ... }` under `src/`, which is what makes something a helper object here:
 * the `name` has to repeat the constant's own, which is what separates a helper object from the other things
 * that carry a `name` (a pipeline step names its step, a query registry names the query). With it comes the
 * `@helper <category> <what it is>` tag of the doc comment right above, if there is one.
 * Read from the sources rather than from a list, so the check below cannot go stale.
 */
function declaredHelperObjects(): Map<string, DeclaredHelper> {
	const found = new Map<string, DeclaredHelper>();
	const walk = (dir: string): void => {
		for(const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const at = path.join(dir, entry.name);
			if(entry.isDirectory()) {
				walk(at);
			} else if(entry.name.endsWith('.ts')) {
				const source = fs.readFileSync(at, 'utf-8');
				for(const match of source.matchAll(/^export const (\w+)(?::[^=]+)? = \{\n(?:\t[^\n]*\n){0,12}?\tname:\s*'\1'/gm)) {
					const doc = source.slice(source.lastIndexOf('/**', match.index), match.index);
					const tag = /@helper\s+(\S+)\s+([^\n]*?)\s*(?:\n|\*\/)/.exec(doc.endsWith('*/\n') ? doc : '');
					found.set(match[1], { file: at, category: tag?.[1], summary: tag?.[2] });
				}
			}
		}
	};
	walk(path.join(__dirname, '..'));
	return found;
}

/**
 * https://github.com/flowr-analysis/flowr/wiki/Helper-Objects
 */
export class WikiHelperObjects extends DocMaker<'wiki/Helper Objects.md'> {
	constructor() {
		super('wiki/Helper Objects.md', module.filename, 'helper objects, by what they are about');
	}

	public text({ ctx }: DocMakerArgs): string {
		const declared = declaredHelperObjects();
		const known = new Set(Categories.map(c => c.id));
		const families = Categories.map(c => c.alsoIn).filter(isNotUndefined);
		const untagged = [...declared].filter(([, h]) => h.category === undefined && !families.some(dir => h.file.includes(dir))).map(([n]) => n).sort();
		guard(untagged.length === 0, () => `Helper objects without an \`@helper <category> <what it is>\` tag: ${untagged.join(', ')}. The categories are ${[...known].join(', ')}.`);
		const unknown = [...declared].filter(([, h]) => h.category !== undefined && !known.has(h.category)).map(([n, h]) => `${n} (${h.category})`).sort();
		guard(unknown.length === 0, () => `Helper objects tagged with a category ${module.filename} does not know: ${unknown.join(', ')}.`);
		const empty = Categories.filter(c => c.alsoIn === undefined && ![...declared.values()].some(h => h.category === c.id)).map(c => c.id);
		guard(empty.length === 0, () => `No helper object is tagged with: ${empty.join(', ')}.`);
		const members = (id: string) => [...declared].filter(([, h]) => h.category === id).sort(([a], [b]) => a.localeCompare(b));

		return `
This page lists every important helper object of flowR.

${Categories.map(c => `- [${c.title}](#${Mermaid.escapeId(c.title)})`).join('\n')}
- [Adding a helper object](#${Mermaid.escapeId('Adding a helper object')})

${Categories.map(category => `${section(category.title, 2)}

| helper | what it is |
| :-- | :-- |
${members(category.id).map(([name, h]) => `| ${ctx.link({ name }, undefined, { type: 'variable' })} | ${h.summary} |`).join('\n')}`).join('\n\n')}

${section('Adding a helper object', 2)}

Give the doc comment of the object an \`@helper <category> <what it is>\` tag. The category is one of
${Categories.map(c => `\`${c.id}\``).join(', ')}, and the rest of the line is the short description for the table.
`;
	}
}
