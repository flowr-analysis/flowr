import type { RoxygenBlock, RoxygenTag } from './roxygen-ast';
import { isKnownRoxygenText , KnownRoxygenTags } from './roxygen-ast';
import type { RNode } from '../lang-4.x/ast/model/model';
import type { ParentInformation } from '../lang-4.x/ast/model/processing/decorate';
import { isRComment } from '../lang-4.x/ast/model/nodes/r-comment';
import { isNotUndefined } from '../../util/assert';

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
		contents.push((trimmed.startsWith('#\'') ? trimmed.slice(2) : trimmed.slice(1)).trim());
	}
	return contents;
}

/**
 * Parses the roxygen comments attached to a node into a RoxygenBlock AST node.
 * Will return `undefined` if there are no valid roxygen comments attached to the node.
 */
export function parseCommentsOf(node: RNode<ParentInformation>): RoxygenBlock | undefined {
	const comments = node.info.additionalTokens
		?.filter(isRComment).map(r => r.lexeme).filter(isNotUndefined);
	console.log(comments);
	return undefined;
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
	parseRoxygenBase(state);
	return state.tags;
}

function atEnd(state: RoxygenParseContext): boolean {
	return state.idx >= state.lines.length;
}

function atTag(state: RoxygenParseContext): TagLine | undefined {
	if(atEnd(state)) {
		return undefined;
	}
	const line = state.lines[state.idx];
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

function stringVal(state: RoxygenParseContext, tagName: TagLine): void {
	const [lines, nextTag] = collectUntilNextTag(state);
	if(tagName[1]) {
		lines.unshift(tagName[1]);
	}
	if(lines.length > 0) {
		const n = tagName[0];
		addTag(state, (isKnownRoxygenText(n) ? {
			type:  n,
			value: lines.join('\n').trim(),
		} : {
			type:  KnownRoxygenTags.Unknown,
			value: {
				tag:     n,
				content: lines.join(' ')
			}
		}) as RoxygenTag);
	}
	parseRoxygenTag(state, nextTag);
}

const TagMap = {
	[KnownRoxygenTags.Aliases]:           stringVal,
	[KnownRoxygenTags.Backref]:           stringVal,
	[KnownRoxygenTags.Concept]:           stringVal,
	[KnownRoxygenTags.Family]:            stringVal,
	[KnownRoxygenTags.Keywords]:          stringVal,
	[KnownRoxygenTags.References]:        stringVal,
	[KnownRoxygenTags.SeeAlso]:           stringVal,
	[KnownRoxygenTags.EvalNamespace]:     stringVal,
	[KnownRoxygenTags.Export]:            stringVal,
	[KnownRoxygenTags.ExportClass]:       stringVal,
	[KnownRoxygenTags.ExportMethod]:      stringVal,
	[KnownRoxygenTags.ExportPattern]:     stringVal,
	[KnownRoxygenTags.ExportS3Method]:    stringVal,
	[KnownRoxygenTags.Import]:            stringVal,
	[KnownRoxygenTags.ImportClassesFrom]: stringVal,
	[KnownRoxygenTags.ImportMethodsFrom]: stringVal,
	[KnownRoxygenTags.ImportFrom]:        stringVal,
	[KnownRoxygenTags.RawNamespace]:      stringVal,
	[KnownRoxygenTags.UseDynLib]:         stringVal,
	[KnownRoxygenTags.Md]:                stringVal,
	[KnownRoxygenTags.NoMd]:              stringVal,
	[KnownRoxygenTags.Section]:           stringVal,
	[KnownRoxygenTags.Field]:             stringVal,
	[KnownRoxygenTags.Format]:            stringVal,
	[KnownRoxygenTags.Method]:            stringVal,
	[KnownRoxygenTags.Slot]:              stringVal,
	[KnownRoxygenTags.Source]:            stringVal,
	[KnownRoxygenTags.Description]:       stringVal,
	[KnownRoxygenTags.Details]:           stringVal,
	[KnownRoxygenTags.Example]:           stringVal,
	[KnownRoxygenTags.Examples]:          stringVal,
	[KnownRoxygenTags.ExamplesIf]:        stringVal,
	[KnownRoxygenTags.NoRd]:              stringVal,
	[KnownRoxygenTags.Param]:             stringVal,
	[KnownRoxygenTags.RawRd]:             stringVal,
	[KnownRoxygenTags.Return]:            stringVal,
	[KnownRoxygenTags.Returns]:           stringVal,
	[KnownRoxygenTags.Title]:             stringVal,
	[KnownRoxygenTags.Usage]:             stringVal,
	[KnownRoxygenTags.DescribeIn]:        stringVal,
	[KnownRoxygenTags.Eval]:              stringVal,
	[KnownRoxygenTags.EvalRd]:            stringVal,
	[KnownRoxygenTags.IncludeRmd]:        stringVal,
	[KnownRoxygenTags.Inherit]:           stringVal,
	[KnownRoxygenTags.InheritDotParams]:  stringVal,
	[KnownRoxygenTags.InheritParams]:     stringVal,
	[KnownRoxygenTags.InheritSection]:    stringVal,
	[KnownRoxygenTags.Order]:             stringVal,
	[KnownRoxygenTags.RdName]:            stringVal,
	[KnownRoxygenTags.Template]:          stringVal,
	[KnownRoxygenTags.TemplateVar]:       stringVal,
	[KnownRoxygenTags.Text]:              stringVal,
	[KnownRoxygenTags.Name]:              stringVal,
	[KnownRoxygenTags.DocType]:           stringVal,
	[KnownRoxygenTags.Author]:            stringVal,
	[KnownRoxygenTags.Unknown]:           stringVal
} as const satisfies Record<KnownRoxygenTags, (state: RoxygenParseContext, tagName: TagLine) => void>;

function parseRoxygenTag(state: RoxygenParseContext, tagName: TagLine | undefined): void {
	if(tagName === undefined) {
		return;
	}
	const parser = TagMap[tagName[0] as KnownRoxygenTags] ?? stringVal;
	parser(state, tagName);
}

function parseRoxygenBase(state: RoxygenParseContext): void {
	stringVal(state, [KnownRoxygenTags.Text]);
}