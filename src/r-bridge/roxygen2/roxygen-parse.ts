import type { RoxygenBlock, RoxygenTag } from './roxygen-ast';
import { isKnownRoxygenText , KnownRoxygenTags } from './roxygen-ast';
import type { RNode } from '../lang-4.x/ast/model/model';
import type { AstIdMap, ParentInformation } from '../lang-4.x/ast/model/processing/decorate';
import type { RComment } from '../lang-4.x/ast/model/nodes/r-comment';
import { isRComment } from '../lang-4.x/ast/model/nodes/r-comment';
import { isNotUndefined } from '../../util/assert';
import { splitAtEscapeSensitive } from '../../util/text/args';
import { mergeRanges } from '../../util/range';

function prepareCommentContext(commentText: readonly string[]): string[] {
	const contents = [];
	for(const line of commentText) {
		const trimmed = line.trim();
		if(trimmed.length === 0) {
			continue;
		} else if(!trimmed.startsWith('#')) {
			// we are done with the roxygen comment
			break;
		}
		contents.push((trimmed.startsWith('#\'') ? trimmed.slice(2) : trimmed.slice(1)).trimEnd());
	}
	return contents;
}

/**
 * Parses the roxygen comments attached to a node into a RoxygenBlock AST node.
 * Will return `undefined` if there are no valid roxygen comments attached to the node.
 */
export function parseCommentsOf(node: RNode<ParentInformation>, idMap: AstIdMap): RoxygenBlock | undefined {
	let comments: RComment<ParentInformation>[] | undefined;
	let cur: RNode<ParentInformation> | undefined = node;
	do{
		comments = cur?.info.additionalTokens
			?.filter(isRComment).filter(r => isNotUndefined(r.lexeme)) as RComment<ParentInformation>[] | undefined;
		cur = cur?.info.parent ? idMap.get(cur.info.parent) : undefined;
	} while((comments === undefined || comments.length === 0) && cur !== undefined);
	if(comments === undefined || comments.length === 0) {
		return undefined;
	}
	const commentContent = comments.map(c => c.lexeme);
	return {
		type:        'roxygen-block',
		tags:        parseRoxygenComment(commentContent),
		attachedTo:  cur?.info.id,
		requestNode: node.info.id,
		range:       [
			...mergeRanges(...comments.map(c => c.location)),
			comments.find(c => c.info.file)?.info.file
		]
	};
}


interface RoxygenParseContext {
	lines: string[];
	tags:  RoxygenTag[];
	idx:   number
}

type TagLine = [tag: string, remTagLine?: string];
/**
 * Parses a roxygen comment into a RoxygenBlock AST node.
 * Will return `undefined` if the comment is not a valid roxygen comment.
 * @see {@link parseCommentsOf} - to parse comments attached to a node
 */
export function parseRoxygenComment(commentText: readonly string[]): RoxygenTag[] {
	const contents = prepareCommentContext(commentText);
	const state: RoxygenParseContext = {
		lines: contents,
		tags:  [],
		idx:   0
	};
	val(state, [KnownRoxygenTags.Text]);
	return state.tags;
}

function atEnd(state: RoxygenParseContext): boolean {
	return state.idx >= state.lines.length;
}

function atTag(state: RoxygenParseContext): TagLine | undefined {
	if(atEnd(state)) {
		return undefined;
	}
	const line = state.lines[state.idx].trim();
	if(!line.startsWith('@')) {
		return undefined;
	}
	const firstSpace = line.indexOf(' ');
	return firstSpace === -1 ? [line.slice(1), undefined] : [line.slice(1, firstSpace), line.slice(firstSpace + 1).trim()];
}

function advanceLine(state: RoxygenParseContext): string | undefined {
	return state.lines[state.idx++];
}

function collectUntilNextTag(state: RoxygenParseContext): [got: string[], tag: TagLine | undefined] {
	const collected: string[] = [];
	while(!atEnd(state)) {
		const mayTag = atTag(state);
		if(mayTag) {
			advanceLine(state);
			return [collected, mayTag];
		}
		collected.push(advanceLine(state) as string);
	}
	return [collected, undefined];
}

function addTag(state: RoxygenParseContext, tag: RoxygenTag): void {
	state.tags.push(tag);
}

function val(state: RoxygenParseContext, tagName: TagLine, lineToVal: (lines: readonly string[]) => unknown | undefined = l => l.join('\n').trim()): void {
	const [lines, nextTag] = collectUntilNextTag(state);

	if(tagName[1]) {
		lines.unshift(tagName[1]);
	}
	if(tagName[0] !== KnownRoxygenTags.Text || lines.length > 0) {
		const n = tagName[0];
		if(isKnownRoxygenText(n)) {
			const val: undefined | unknown = lineToVal(lines);
			addTag(state, (val !== undefined ? {
				type:  n,
				value: val
			} : { type: n }) as RoxygenTag);
		} else {
			addTag(state, {
				type:  KnownRoxygenTags.Unknown,
				value: {
					tag:     n,
					content: lines.join(' ')
				}
			});
		}

	}
	parseRoxygenTag(state, nextTag);
}

const spaceVals = (s: RoxygenParseContext, t: TagLine): void => val(s, t, l => splitAtEscapeSensitive(l.join(' ')));
const flagVal =  (s: RoxygenParseContext, t: TagLine): void => val(s, t, () => undefined);

const section = (s: RoxygenParseContext, t: TagLine): void => val(s, t, l => {
	return { title: l[0].trim(), content: l.slice(1).join('\n').trim() };
});

export const firstAndRest = (firstName: string, secondName: string) => (s: RoxygenParseContext, t: TagLine): void => val(s, t, l => {
	const vals = splitAtEscapeSensitive(l.join('\n'));
	return { [firstName]: vals[0], [secondName]: vals.slice(1).join(' ').trim() };
});
const firstAndArrayRest = (firstName: string, secondName: string) => (s: RoxygenParseContext, t: TagLine): void => val(s, t, l => {
	const vals = splitAtEscapeSensitive(l.join('\n'));
	return { [firstName]: vals[0], [secondName]: vals.slice(1) };
});

const asNumber = (s: RoxygenParseContext, t: TagLine): void => val(s, t, l => {
	const num = Number(l.join(' ').trim());
	return Number.isNaN(num) ? undefined : num;
});

const TagMap = {
	[KnownRoxygenTags.Aliases]:           spaceVals,
	[KnownRoxygenTags.Backref]:           val,
	[KnownRoxygenTags.Concept]:           val,
	[KnownRoxygenTags.Family]:            val,
	[KnownRoxygenTags.Keywords]:          spaceVals,
	[KnownRoxygenTags.References]:        val,
	[KnownRoxygenTags.SeeAlso]:           spaceVals,
	[KnownRoxygenTags.EvalNamespace]:     val,
	[KnownRoxygenTags.Export]:            flagVal,
	[KnownRoxygenTags.ExportClass]:       val,
	[KnownRoxygenTags.ExportMethod]:      val,
	[KnownRoxygenTags.ExportPattern]:     val,
	[KnownRoxygenTags.ExportS3Method]:    val,
	[KnownRoxygenTags.Import]:            val,
	[KnownRoxygenTags.ImportClassesFrom]: firstAndArrayRest('package', 'classes'),
	[KnownRoxygenTags.ImportMethodsFrom]: firstAndArrayRest('package', 'methods'),
	[KnownRoxygenTags.ImportFrom]:        firstAndArrayRest('package', 'symbols'),
	[KnownRoxygenTags.RawNamespace]:      val,
	[KnownRoxygenTags.UseDynLib]:         val,
	[KnownRoxygenTags.Md]:                flagVal,
	[KnownRoxygenTags.NoMd]:              flagVal,
	[KnownRoxygenTags.Section]:           section,
	[KnownRoxygenTags.Field]:             firstAndRest('name', 'description'),
	[KnownRoxygenTags.Format]:            val,
	[KnownRoxygenTags.Method]:            firstAndRest('generic', 'class'),
	[KnownRoxygenTags.Slot]:              firstAndRest('name', 'description'),
	[KnownRoxygenTags.Source]:            val,
	[KnownRoxygenTags.Description]:       val,
	[KnownRoxygenTags.Details]:           val,
	[KnownRoxygenTags.Example]:           val,
	[KnownRoxygenTags.Examples]:          val,
	[KnownRoxygenTags.ExamplesIf]:        firstAndRest('condition', 'content'),
	[KnownRoxygenTags.NoRd]:              flagVal,
	[KnownRoxygenTags.Param]:             firstAndRest('name', 'description'),
	[KnownRoxygenTags.RawRd]:             val,
	[KnownRoxygenTags.Return]:            val,
	[KnownRoxygenTags.Returns]:           val,
	[KnownRoxygenTags.Title]:             val,
	[KnownRoxygenTags.Usage]:             val,
	[KnownRoxygenTags.DescribeIn]:        firstAndRest('dest', 'description'),
	[KnownRoxygenTags.Eval]:              val,
	[KnownRoxygenTags.EvalRd]:            val,
	[KnownRoxygenTags.IncludeRmd]:        val,
	[KnownRoxygenTags.Inherit]:           firstAndArrayRest('source', 'components'),
	[KnownRoxygenTags.InheritDotParams]:  firstAndArrayRest('source', 'args'),
	[KnownRoxygenTags.InheritParams]:     val,
	[KnownRoxygenTags.InheritSection]:    firstAndRest('source', 'section'),
	[KnownRoxygenTags.Order]:             asNumber,
	[KnownRoxygenTags.RdName]:            val,
	[KnownRoxygenTags.Template]:          val,
	[KnownRoxygenTags.TemplateVar]:       firstAndRest('name', 'value'),
	[KnownRoxygenTags.Text]:              val,
	[KnownRoxygenTags.Name]:              val,
	[KnownRoxygenTags.DocType]:           val,
	[KnownRoxygenTags.Author]:            val,
	[KnownRoxygenTags.Unknown]:           (s, t) => val(s, t, l => ({
		tag:     t[0],
		content: l.join(' ')
	}))
} as const satisfies Record<KnownRoxygenTags, (state: RoxygenParseContext, tagName: TagLine) => void>;

function parseRoxygenTag(state: RoxygenParseContext, tagName: TagLine | undefined): void {
	if(tagName === undefined) {
		return;
	}
	const parser = TagMap[tagName[0] as KnownRoxygenTags] ?? val;
	parser(state, tagName);
}
