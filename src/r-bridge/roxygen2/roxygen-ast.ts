import type { SourceLocation } from '../../util/range';
import type { NodeId } from '../lang-4.x/ast/model/processing/node-id';

/**
 * Known Roxygen tags as per {@link https://roxygen2.r-lib.org/reference/index.html}
 */
export enum KnownRoxygenTags {
	/* ---- Tags Index Crossref ---- */
	Aliases = 'aliases',
	Backref = 'backref',
	Concept = 'concept',
	Family = 'family',
	Keywords = 'keywords',
	References = 'references',
	SeeAlso = 'seealso',
	/* ---- Tags Namespace ---- */
	EvalNamespace = 'evalNamespace',
	Export = 'export',
	ExportClass = 'exportClass',
	ExportMethod = 'exportMethod',
	ExportPattern = 'exportPattern',
	ExportS3Method = 'exportS3Method',
	Import = 'import',
	ImportClassesFrom = 'importClassesFrom',
	ImportMethodsFrom = 'importMethodsFrom',
	ImportFrom = 'importFrom',
	RawNamespace = 'rawNamespace',
	UseDynLib = 'useDynLib',
	/* ---- Tags related to Markdown formatting ---- */
	Md = 'md',
	NoMd = 'noMd',
	Section = 'section',
	/* ---- Documenting Datasets and Classes ---- */
	Field = 'field',
	Format = 'format',
	Method = 'method',
	Slot = 'slot',
	Source = 'source',
	/* ---- Documenting Functions ---- */
	Description = 'description',
	Details = 'details',
	Example = 'example',
	Examples = 'examples',
	ExamplesIf = 'examplesIf',
	NoRd = 'noRd',
	Param = 'param',
	RawRd = 'rawRd',
	Return = 'return',
	Returns = 'returns',
	Title = 'title',
	Usage = 'usage',
	/* ---- Reusing Documentation ---- */
	DescribeIn = 'describeIn',
	Eval = 'eval',
	EvalRd = 'evalRd',
	IncludeRmd = 'includeRmd',
	Inherit = 'inherit',
	InheritDotParams = 'inheritDotParams',
	InheritParams = 'inheritParams',
	InheritSection = 'inheritSection',
	Order = 'order',
	RdName = 'rdname',
	Template = 'template',
	TemplateVar = 'templateVar',
	/* ---- Other, not part of the references above ---- */
	/** Just plain old text */
	Text = 'text',
	Name = 'name',
	DocType = 'docType',
	Author = 'author',
	Unknown = 'unknown'
}

/**
 * Base interface for all roxygen tags.
 */
export interface RoxygenTagBase<Type extends KnownRoxygenTags> {
	/** The type of the roxygen tag. */
	type: Type;
}

interface RoxygenTagWithValue<Type extends KnownRoxygenTags, Value> extends RoxygenTagBase<Type> {
	/** The value of the roxygen tag. */
	value: Value;
}

type RoxygenTagFlag<Type extends KnownRoxygenTags> = RoxygenTagBase<Type>

export type RoxygenTagAlias = RoxygenTagWithValue<KnownRoxygenTags.Aliases, string[]>;
export type RoxygenTagBackref = RoxygenTagWithValue<KnownRoxygenTags.Backref, string>;
export type RoxygenTagConcept = RoxygenTagWithValue<KnownRoxygenTags.Concept, string>;
export type RoxygenTagFamily = RoxygenTagWithValue<KnownRoxygenTags.Family, string>;
/** Internal is special in that it causes the topic to be removed from the index */
export type RoxygenTagKeywords = RoxygenTagWithValue<KnownRoxygenTags.Keywords, (string | 'internal')[]>;
export type RoxygenTagReferences = RoxygenTagWithValue<KnownRoxygenTags.References, string>;
export type RoxygenTagSeeAlso = RoxygenTagWithValue<KnownRoxygenTags.SeeAlso, string[]>;
/** https://roxygen2.r-lib.org/reference/tags-index-crossref.html */
export type RoxygenCrossrefTag = RoxygenTagAlias | RoxygenTagBackref | RoxygenTagConcept | RoxygenTagFamily | RoxygenTagKeywords | RoxygenTagReferences | RoxygenTagSeeAlso;
/** Evaluate arbitrary code in the package namespace and insert the results into the NAMESPACE */
export type RoxygenTagEvalNamespace = RoxygenTagWithValue<KnownRoxygenTags.EvalNamespace, string>;
export type RoxygenTagExport = RoxygenTagFlag<KnownRoxygenTags.Export>;
export type RoxygenTagExportClass = RoxygenTagWithValue<KnownRoxygenTags.ExportClass, string>;
export type RoxygenTagExportMethod = RoxygenTagWithValue<KnownRoxygenTags.ExportMethod, string>;
export type RoxygenTagExportPattern = RoxygenTagWithValue<KnownRoxygenTags.ExportPattern, string>;
export type RoxygenTagExportS3Method = RoxygenTagWithValue<KnownRoxygenTags.ExportS3Method, string>;
export type RoxygenTagImport = RoxygenTagWithValue<KnownRoxygenTags.Import, string>;
export type RoxygenTagImportClassesFrom = RoxygenTagWithValue<KnownRoxygenTags.ImportClassesFrom, { package: string; classes: string[] }>;
export type RoxygenTagImportMethodsFrom = RoxygenTagWithValue<KnownRoxygenTags.ImportMethodsFrom, { package: string; methods: string[] }>;
export type RoxygenTagImportFrom = RoxygenTagWithValue<KnownRoxygenTags.ImportFrom, { package: string; symbols: string[] }>;
/** Insert literal text directly into the NAMESPACE */
export type RoxygenTagRawNamespace = RoxygenTagWithValue<KnownRoxygenTags.RawNamespace, string>;
export type RoxygenTagUseDynLib = RoxygenTagWithValue<KnownRoxygenTags.UseDynLib, string>;
/** https://roxygen2.r-lib.org/reference/tags-namespace.html */
export type RoxygenNamespaceTag = RoxygenTagEvalNamespace | RoxygenTagExport | RoxygenTagExportClass | RoxygenTagExportMethod | RoxygenTagExportPattern | RoxygenTagExportS3Method | RoxygenTagImport | RoxygenTagImportClassesFrom | RoxygenTagImportMethodsFrom | RoxygenTagImportFrom | RoxygenTagRawNamespace | RoxygenTagUseDynLib;
export type RoxygenTagMarkdown = RoxygenTagFlag<KnownRoxygenTags.Md>;
export type RoxygenTagNoMarkdown = RoxygenTagFlag<KnownRoxygenTags.NoMd>;
export type RoxygenTagSection = RoxygenTagWithValue<KnownRoxygenTags.Section, { title: string; content: string }>;
/** https://roxygen2.r-lib.org/reference/tags-rd-formatting.html */
export type RoxygenFormattingTag = RoxygenTagMarkdown | RoxygenTagNoMarkdown | RoxygenTagSection;
export type RoxygenTagField = RoxygenTagWithValue<KnownRoxygenTags.Field, { name: string; description: string }>;
export type RoxygenTagFormat = RoxygenTagWithValue<KnownRoxygenTags.Format, string>;
export type RoxygenTagMethod = RoxygenTagWithValue<KnownRoxygenTags.Method, { generic: string, class: string }>;
export type RoxygenTagSlot = RoxygenTagWithValue<KnownRoxygenTags.Slot, { name: string; description: string }>;
export type RoxygenTagSource = RoxygenTagWithValue<KnownRoxygenTags.Source, string>;
/** https://roxygen2.r-lib.org/reference/tags-rd-other.html */
export type RoxygenDatasetDocumentationTag = RoxygenTagField | RoxygenTagFormat | RoxygenTagMethod | RoxygenTagSlot | RoxygenTagSource;
export type RoxygenTagDescription = RoxygenTagWithValue<KnownRoxygenTags.Description, string>;
export type RoxygenTagDetails = RoxygenTagWithValue<KnownRoxygenTags.Details, string>;
/** Embed example from file */
export type RoxygenTagExample = RoxygenTagWithValue<KnownRoxygenTags.Example, string>;
export type RoxygenTagExamples = RoxygenTagWithValue<KnownRoxygenTags.Examples, string>;
export type RoxygenTagExamplesIf = RoxygenTagWithValue<KnownRoxygenTags.ExamplesIf, { condition: string; content: string }>;
export type RoxygenTagNoRd = RoxygenTagFlag<KnownRoxygenTags.NoRd>;
export type RoxygenTagParam = RoxygenTagWithValue<KnownRoxygenTags.Param, { name: string; description: string }>;
/** Insert literal Rd code */
export type RoxygenTagRawRd = RoxygenTagWithValue<KnownRoxygenTags.RawRd, string>;
export type RoxygenTagReturn = RoxygenTagWithValue<KnownRoxygenTags.Return | KnownRoxygenTags.Returns, string>;
export type RoxygenTagTitle = RoxygenTagWithValue<KnownRoxygenTags.Title, string>;
export type RoxygenTagUsage = RoxygenTagWithValue<KnownRoxygenTags.Usage, string>;
/** https://roxygen2.r-lib.org/reference/tags-rd.html */
export type RoxygenFunctionDocumentationTag = RoxygenTagDescription | RoxygenTagDetails | RoxygenTagExample | RoxygenTagExamples | RoxygenTagExamplesIf | RoxygenTagNoRd | RoxygenTagParam | RoxygenTagRawRd | RoxygenTagReturn | RoxygenTagTitle | RoxygenTagUsage;
export type RoxygenTagDescribeIn = RoxygenTagWithValue<KnownRoxygenTags.DescribeIn, { dest: string, description: string }>;
/** Evaluate R code and insert the results into the Rd file */
export type RoxygenTagEval = RoxygenTagWithValue<KnownRoxygenTags.Eval, string>;
export type RoxygenTagEvalRd = RoxygenTagWithValue<KnownRoxygenTags.EvalRd, string>;
export type RoxygenTagIncludeRmd = RoxygenTagWithValue<KnownRoxygenTags.IncludeRmd, string>;
// export const RoxygenTagInheritComponents = ['params', 'return', 'title', 'description', 'details', 'seealso', 'sections', 'references', 'examples', 'author', 'source', 'note', 'format'] as const;
export type RoxygenTagInherit = RoxygenTagWithValue<KnownRoxygenTags.Inherit, { source: string, components: string[] }>;
export type RoxygenTagInheritDotParams = RoxygenTagWithValue<KnownRoxygenTags.InheritDotParams, { source: string, args: string[] }>;
export type RoxygenTagInheritParams = RoxygenTagWithValue<KnownRoxygenTags.InheritParams, string>;
export type RoxygenTagInheritSection = RoxygenTagWithValue<KnownRoxygenTags.InheritSection, { source: string; section: string }>;
export type RoxygenTagOrder = RoxygenTagWithValue<KnownRoxygenTags.Order, number | undefined>;
export type RoxygenTagRdName = RoxygenTagWithValue<KnownRoxygenTags.RdName, string>;
export type RoxygenTagTemplate = RoxygenTagWithValue<KnownRoxygenTags.Template, string>;
export type RoxygenTagTemplateVar = RoxygenTagWithValue<KnownRoxygenTags.TemplateVar, { name: string; value: string }>;
/** https://roxygen2.r-lib.org/reference/tags-reuse.html */
export type RoxygenReusingDocumentationTag = RoxygenTagDescribeIn | RoxygenTagEval | RoxygenTagEvalRd | RoxygenTagIncludeRmd | RoxygenTagInherit | RoxygenTagInheritDotParams | RoxygenTagInheritParams | RoxygenTagInheritSection | RoxygenTagOrder | RoxygenTagRdName | RoxygenTagTemplate | RoxygenTagTemplateVar;
export type RoxygenUnknownTag = RoxygenTagWithValue<KnownRoxygenTags.Unknown, { tag: string, content: string }>;
export type RoxygenTagAuthor = RoxygenTagWithValue<KnownRoxygenTags.Author, string>;
export type RoxygenDocType = RoxygenTagWithValue<KnownRoxygenTags.DocType, string>;
export type RoxygenTagName = RoxygenTagWithValue<KnownRoxygenTags.Name, string>;
export type RoxygenTagText = RoxygenTagWithValue<KnownRoxygenTags.Text, string>;
export type RoxygenOtherTag = RoxygenTagAuthor | RoxygenUnknownTag | RoxygenDocType | RoxygenTagName | RoxygenTagText;

/**
 * All known Roxygen tag types.
 */
export type RoxygenTag = RoxygenCrossrefTag
	| RoxygenNamespaceTag
	| RoxygenFormattingTag
	| RoxygenDatasetDocumentationTag
	| RoxygenFunctionDocumentationTag
	| RoxygenReusingDocumentationTag
    | RoxygenOtherTag;

/**
 * A roxygen comment block, consisting of multiple {@link RoxygenTag|roxygen tags}.
 */
export interface RoxygenBlock {
	readonly type:        'roxygen-block';
	/** The ast node to which we assign the comment */
	readonly requestNode: NodeId;
	/** The AST node ID of the R node this roxygen block is attached to, if any (this comment may be a parent of the requested) */
	readonly attachedTo?: NodeId;
	/** The source location of the entire roxygen block, if available. */
	readonly range?:      SourceLocation;
	/** The roxygen tags contained in this block. */
	readonly tags:        readonly RoxygenTag[];
}

const ValidRoxygenTagsSet: Set<string> = new Set(Object.values(KnownRoxygenTags));
/**
 * Checks whether the given text is a known roxygen tag.
 */
export function isKnownRoxygenText(text: string): text is KnownRoxygenTags {
	return ValidRoxygenTagsSet.has(text);
}
