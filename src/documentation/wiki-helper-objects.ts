import fs from 'fs';
import path from 'path';
import { guard, isNotUndefined } from '../util/assert';
import { section } from './doc-util/doc-structure';
import { codeBlock } from './doc-util/doc-code';
import type { DocMakerArgs } from './wiki-mk/doc-maker';
import { DocMaker } from './wiki-mk/doc-maker';

/** A group of helper objects that answer questions about the same thing. */
interface HelperGroup {
	readonly title:   string;
	readonly about:   string;
	readonly objects: readonly string[];
	/** what the group holds beyond the objects it lists, for a family too large to spell out */
	readonly also?:   string;
	/**
	 * The path every helper of that family is declared under. The completeness check counts those as listed,
	 * so a new one is covered by {@link HelperGroup.also} the moment it appears, and one that belongs nowhere
	 * is still caught.
	 */
	readonly alsoIn?: string;
}

/**
 * Every helper object flowR has, grouped by what it is *about* rather than by where it happens to live.
 * The check below makes sure this stays the whole list.
 */
const Groups: readonly HelperGroup[] = [
	{
		title:   'Where something is',
		about:   'A place in the analyzed source, and the ways to name one.',
		objects: [
			'SourceRange',
			'SourceLocation',
			'NodeId',
			'SlicingCriterion',
			'Playground'
		]
	},
	{
		title:   'The normalized AST',
		about:   'What the R code is, once flowR has read it.',
		objects: ['RNode', 'RProject'],
		alsoIn:  'r-bridge/lang-4.x/ast/model',
		also:    'Beside these sits one helper per kind of node, each named after what it matches, so a `for` '
			+ 'loop is `RForLoop` and a call is `RFunctionCall`. Every one answers `is`, plus whatever that '
			+ 'kind allows on top; `RNode` is where to start when the kind is not known yet.'
	},
	{
		title:   'Names and values',
		about:   'What a name is, and what a value flowR worked out may be.',
		objects: [
			'Identifier',
			'RValue',
			'RStringValue',
			'RNumberValue',
			'TernaryLogic',
			'RVersion',
			'RRange'
		]
	},
	{
		title:   'Environments and resolution',
		about:   'From a name to what it may refer to, and from a node to what it may hold.',
		objects: [
			'REnvironment',
			'Resolve',
			'NodeValue',
			'ClosureRefs'
		]
	},
	{
		title:   'The dataflow graph',
		about:   'What depends on what. `Dataflow` is the way in; the rest are the pieces it hands back.',
		objects: [
			'Dataflow',
			'DfgVertex',
			'DfEdge',
			'FunctionArgument',
			'UnknownSideEffect',
			'ControlDependency',
			'DataflowInformation',
			'CallGraph',
			'GraphHelper'
		]
	},
	{
		title:   'Control flow',
		about:   'What may run after what.',
		objects: [
			'CfgVertex',
			'CfgEdge',
			'ControlFlow'
		]
	},
	{
		title:   'What a function and its calls mean',
		about:   'What an analysis works out about a definition, and what one call of it amounts to.',
		objects: ['FunctionSemantics'],
		also:    'One entry point covers both halves: `FunctionSemantics.props`, `FunctionSemantics.exceptions`, `FunctionSemantics.strictness` and their kin '
			+ 'answer about a definition, while `FunctionSemantics.call` holds what flowR states about a call (`props`, '
			+ '`signature`, `argument`), how R binds its arguments (`match`), and which of them it does not '
			+ 'simply evaluate (`nse`, `quoted`, `deferred`).'
	},
	{
		title:   'Asking flowR something',
		about:   'The APIs an analysis is written against.',
		objects: [
			'Query',
			'FlowrSearchGenerator',
			'QueryFunctionFilter',
			'HappensBeforeKey',
			'LintingResults',
			'LintQuickFix'
		]
	},
	{
		title:   'The project and its configuration',
		about:   'What is being analyzed, and under which settings.',
		objects: [
			'FlowrConfig',
			'DescriptionFile'
		]
	},
	{
		title:   'Output',
		about:   'Turning any of the above into something to look at.',
		objects: [
			'Mermaid',
			'DataflowMermaid',
			'Record',
			'ReplClipboard'
		]
	}
];

/**
 * Every `export const X = { name: 'X', ... }` under `src/`, which is what makes something a helper object here:
 * the `name` has to repeat the constant's own, which is what separates a helper object from the other things
 * that carry a `name` (a pipeline step names its step, a query registry names the query).
 * Read from the sources rather than from a list, so the check below cannot go stale.
 */
function declaredHelperObjects(): Map<string, string> {
	const found = new Map<string, string>();
	const walk = (dir: string): void => {
		for(const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const at = path.join(dir, entry.name);
			if(entry.isDirectory()) {
				walk(at);
			} else if(entry.name.endsWith('.ts')) {
				const source = fs.readFileSync(at, 'utf-8');
				for(const [, name] of source.matchAll(/^export const (\w+)(?::[^=]+)? = \{\n(?:\t[^\n]*\n){0,12}?\tname:\s*'\1'/gm)) {
					found.set(name, at);
				}
			}
		}
	};
	walk(path.join(__dirname, '..'));
	return found;
}

/**
 * The first sentence of a helper object's own documentation, which is what the table shows: the page states
 * where a helper belongs, the helper states what it is, and neither repeats the other.
 */
function summarize(doc: string): string {
	const text = doc.replace(/\s+/g, ' ').trim();
	const stop = /(?<!e\.g|i\.e|etc|vs)\.\s/.exec(text);
	return (stop ? text.slice(0, stop.index + 1) : text).trim();
}

/**
 * https://github.com/flowr-analysis/flowr/wiki/Helper-Objects
 */
export class WikiHelperObjects extends DocMaker<'wiki/Helper Objects.md'> {
	constructor() {
		super('wiki/Helper Objects.md', module.filename, 'every helper object flowR has, by what it is about');
	}

	public text({ ctx }: DocMakerArgs): string {
		const listed = new Set(Groups.flatMap(g => g.objects));
		const families = Groups.map(g => g.alsoIn).filter(isNotUndefined);
		const declared = declaredHelperObjects();
		const missing = [...declared]
			.filter(([n, file]) => !listed.has(n) && !families.some(dir => file.includes(dir)))
			.map(([n]) => n).sort();
		const stale = [...listed].filter(n => !declared.has(n)).sort();
		guard(missing.length === 0, () => `Helper objects missing from the wiki page: ${missing.join(', ')}. Add them to a group in ${module.filename}.`);
		guard(stale.length === 0, () => `The wiki page lists helper objects that no longer exist: ${stale.join(', ')}.`);
		/* the table is the helper's own documentation, so an undocumented one would render an empty cell */
		const undocumented = [...listed].filter(name => summarize(ctx.doc({ name }, { type: 'variable' })) === '').sort();
		guard(undocumented.length === 0, () => `These helper objects carry no documentation, so the wiki page has nothing to say about them: ${undocumented.join(', ')}.`);

		return `
A *helper object* is a \`const\` named after a type, holding the operations on values of it. flowR has
${declared.size} of them, and this page groups them by what they are about.

${codeBlock('ts', `SourceLocation.at(node)?.startLine
DfgVertex.isFunctionCall(vertex)
DfEdge.includesType(edge, EdgeType.Reads)`)}

They share one shape, which is also how this page finds them:

${codeBlock('ts', `export const Thing = {
    name: 'Thing',
    doSomething(this: void, thing: Thing): Answer {
        /* ... */
    }
} as const;`)}



${Groups.map(group => `${section(group.title, 2)}

${group.about}

| helper | what it is |
| :-- | :-- |
${group.objects.map(name => `| ${ctx.link({ name }, undefined, { type: 'variable' })} | ${summarize(ctx.doc({ name }, { type: 'variable' }))} |`).join('\n')}
${group.also ? `\n${group.also}\n` : ''}`).join('\n\n')}
`;
	}
}
