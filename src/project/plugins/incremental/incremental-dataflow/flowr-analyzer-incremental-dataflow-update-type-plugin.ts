import { SemVer } from 'semver';
import { FlowrAnalyzerPlugin, PluginType } from '../../flowr-analyzer-plugin';
import type { FlowrAnalyzerContext } from '../../../context/flowr-analyzer-context';
import type { FilePath } from '../../../context/flowr-file';
import type { NormalizedAst, ParentInformation } from '../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { SourceRange } from '../../../../util/range';
import type { RNode } from '../../../../r-bridge/lang-4.x/ast/model/model';
import type { RExpressionList } from '../../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';

/** How the files of an analysis differ from those of the analysis before, see {@link FlowrAnalyzerIncrementalDataflowUpdateTypePlugin}. */
export enum IncrementalUpdateType {
	/** Anything else, the dataflow is analyzed again from scratch. */
	Full             = 'Full',
	/** The single file got statements appended. */
	AddedAtEnd       = 'AddedAtEnd',
	/** The single file lost statements at its end. */
	RemovedAtEnd     = 'RemovedAtEnd',
	/** The single file changed after its first {@link IncrementalUpdateResult#commonPrefix|commonPrefix} statements. */
	ChangedAtEnd     = 'ChangedAtEnd',
	/** A file was added after all the files analyzed before. */
	NewFileAtEnd     = 'NewFileAtEnd',
	/** The last file analyzed before was removed. */
	RemovedFileAtEnd = 'RemovedFileAtEnd',
	/** Only the source locations changed, which nodes created during the analysis copy, so this is analyzed again. */
	Location         = 'Location',
	/** Only comments changed, which the dataflow analysis does not read. */
	Comment          = 'Comment',
	/** Nothing changed. */
	Nothing          = 'Nothing'
}

/**
 * What a {@link FlowrAnalyzerIncrementalDataflowUpdateTypePlugin} classified, plus whether the incremental dataflow
 * analysis actually reused the earlier analysis for it.
 */
export interface IncrementalUpdateResult {
	readonly types:         readonly IncrementalUpdateType[];
	/** The file the change happened in, if it is a single one. */
	readonly filePath?:     FilePath;
	/** For a change within a single file, how many of its top-level statements stayed the same. */
	readonly commonPrefix?: number;
	/** Whether the incremental analysis reused anything for this change. */
	readonly applied?:      boolean;
}

/** A file as an analysis saw it before the dataflow analysis added the files it sourced. */
export interface AnalyzedFile {
	readonly filePath: FilePath | undefined;
	readonly root:     RExpressionList<ParentInformation>;
}

/** What a {@link FlowrAnalyzerIncrementalDataflowUpdateTypePlugin} compares. */
export interface IncrementalDataflowUpdateTypeInformation {
	readonly previous: readonly AnalyzedFile[];
	readonly current:  NormalizedAst;
}

/**
 * Base class for plugins that classify how the files of an analysis changed since the analysis before,
 * producing an {@link IncrementalUpdateResult} the incremental dataflow analysis acts on.
 * At most one may be registered, {@link DefaultFlowrAnalyzerIncrementalDataflowUpdateTypePlugin} runs otherwise.
 */
export abstract class FlowrAnalyzerIncrementalDataflowUpdateTypePlugin extends FlowrAnalyzerPlugin<IncrementalDataflowUpdateTypeInformation, IncrementalUpdateResult> {
	readonly type = PluginType.IncrementalDataflowUpdateType;

	public static override defaultPlugin(): FlowrAnalyzerIncrementalDataflowUpdateTypePlugin {
		return new DefaultFlowrAnalyzerIncrementalDataflowUpdateTypePlugin();
	}
}

/** How two versions of a file differ. */
interface FileDifference {
	/** how many top-level statements are the same, ids included */
	readonly prefix:    number;
	readonly locations: boolean;
	readonly comments:  boolean;
}

/**
 * The default classifier, comparing the ASTs structurally.
 * Node ids take part in the comparison, as the dataflow graph refers to the nodes by them.
 */
export class DefaultFlowrAnalyzerIncrementalDataflowUpdateTypePlugin extends FlowrAnalyzerIncrementalDataflowUpdateTypePlugin {
	public readonly name = 'default-incremental-dataflow-update-type-plugin';
	public readonly description = 'Classifies changes by comparing the top-level statements of the analyzed files.';
	public readonly version = new SemVer('0.2.0');

	protected process(_ctx: FlowrAnalyzerContext, { previous, current }: IncrementalDataflowUpdateTypeInformation): IncrementalUpdateResult {
		const files = current.ast.files;
		const shared = Math.min(previous.length, files.length);
		for(let i = 0; i < shared; i++) {
			if(previous[i].filePath !== files[i].filePath) {
				return { types: [IncrementalUpdateType.Full] };
			}
		}
		const differences = Array.from({ length: shared }, (_, i) => compareFiles(previous[i].root, files[i].root));
		const unchanged = differences.every((d, i) => d.prefix === previous[i].root.children.length && d.prefix === files[i].root.children.length);
		const moved = differences.every((d, i) => d.locations || d.prefix === previous[i].root.children.length) && differences.some(d => d.locations);
		if(files.length === previous.length + 1 && unchanged) {
			return { types: [IncrementalUpdateType.NewFileAtEnd], filePath: files[files.length - 1].filePath };
		} else if(files.length + 1 === previous.length && unchanged) {
			return { types: [IncrementalUpdateType.RemovedFileAtEnd], filePath: previous[previous.length - 1].filePath };
		} else if(files.length !== previous.length) {
			return { types: [IncrementalUpdateType.Full] };
		}
		if(moved) {
			return { types: [IncrementalUpdateType.Location] };
		} else if(unchanged) {
			return { types: [differences.some(d => d.comments) ? IncrementalUpdateType.Comment : IncrementalUpdateType.Nothing] };
		}
		if(files.length !== 1) {
			return { types: [IncrementalUpdateType.Full] };
		}
		const [{ prefix }] = differences;
		const before = previous[0].root.children.length;
		const after = files[0].root.children.length;
		const type = prefix === before ? IncrementalUpdateType.AddedAtEnd : prefix === after ? IncrementalUpdateType.RemovedAtEnd : IncrementalUpdateType.ChangedAtEnd;
		return { types: [type], filePath: files[0].filePath, commonPrefix: prefix };
	}
}

/** Keys that hold no information of their own: the parent follows from the structure, and tree-sitter ids are per parse. */
const IgnoredKeys = new Set(['parent', 'tsId']);
const LocationKeys = new Set(['location', 'fullRange']);
const CommentKeys = new Set(['adToks']);

function compareFiles(before: RExpressionList<ParentInformation>, after: RExpressionList<ParentInformation>): FileDifference {
	const shared = Math.min(before.children.length, after.children.length);
	let prefix = 0;
	let comments = !sameNode(before.info.adToks, after.info.adToks, NoKey);
	/* a statement is the same if it is, besides its comments, as the dataflow graph keeps the locations of what it creates */
	for(; prefix < shared; prefix++) {
		const [a, b] = [before.children[prefix], after.children[prefix]];
		if(sameText(a, b)) {
			comments ||= !sameNode(a.info.adToks, b.info.adToks, NoKey);
		} else if(sameNode(a, b, key => CommentKeys.has(key))) {
			comments = true;
		} else {
			break;
		}
	}
	const complete = prefix === before.children.length && prefix === after.children.length;
	const locations = !complete && before.children.length === after.children.length
		&& before.children.every((c, i) => sameNode(c, after.children[i], key => LocationKeys.has(key) || CommentKeys.has(key)));
	return { prefix, locations, comments: complete && comments };
}

const NoKey = () => false;

/** Whether the two statements have the same id, range, and text, which, as the ids count the nodes before, makes them the same statement. */
function sameText(a: RNode<ParentInformation>, b: RNode<ParentInformation>): boolean {
	const [ra, rb] = [SourceRange.fromNode(a), SourceRange.fromNode(b)];
	return a.info.id === b.info.id && a.info.fullLexeme !== undefined && a.info.fullLexeme === b.info.fullLexeme
		&& ra !== undefined && rb !== undefined && ra.every((v, i) => v === rb[i]);
}

/**
 * Whether the two (sub)trees are the same, besides what `skip` names.
 * Lexemes are compared as they are, as a change of the whitespace within them moves the locations of what follows.
 */
function sameNode(a: unknown, b: unknown, skip: (key: string) => boolean): boolean {
	if(a === b) {
		return true;
	} else if(typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
		return false;
	} else if(Array.isArray(a)) {
		return Array.isArray(b) && a.length === b.length && a.every((v, i) => sameNode(v, b[i], skip));
	}
	const keysA = Object.keys(a).filter(k => !IgnoredKeys.has(k) && !skip(k) && (a as Record<string, unknown>)[k] !== undefined);
	const keysB = Object.keys(b).filter(k => !IgnoredKeys.has(k) && !skip(k) && (b as Record<string, unknown>)[k] !== undefined);
	return keysA.length === keysB.length && keysA.every(k => sameNode((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], skip));
}
