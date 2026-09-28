import { SemVer } from 'semver';
import { guard } from '../../../../util/assert';
import { FlowrAnalyzerPlugin, PluginType } from '../../flowr-analyzer-plugin';
import type { FlowrAnalyzerContext } from '../../../context/flowr-analyzer-context';
import type { FilePath } from '../../../context/flowr-file';
import type { NormalizedAst, ParentInformation } from '../../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import type { RProject } from '../../../../r-bridge/lang-4.x/ast/model/nodes/r-project';
import type { RExpressionList } from '../../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';
import { setMinus } from '../../../../util/collections/set';
import fs from 'fs';
import { Hash53 } from '../../../../util/hash';
import { RComment } from '../../../../r-bridge/lang-4.x/ast/model/nodes/r-comment';

export enum IncrementalUpdateType {
	Full             = 'Full',
	AddedAtEnd       = 'AddedAtEnd',
	RemovedAtEnd     = 'RemovedAtEnd',
	NewFileAtEnd     = 'NewFileAtEnd',
	RemovedFileAtEnd = 'RemovedFileAtEnd',
	Location         = 'Location',
	Comment          = 'Comment',
	Nothing          = 'Nothing'
}

/**
 * What a {@link FlowrAnalyzerIncrementalDataflowUpdateTypePlugin} classified, plus whether `tryIncrementalUpdate`
 * actually applied a patch for it.
 */
export interface IncrementalUpdateResult {
	types:     IncrementalUpdateType[];
	filePath?: string;
	applied?:  boolean;
}

/**
 * Base class for plugins that classify edits to the code/file(s), producing an
 * {@link IncrementalUpdateResult} the incremental dataflow orchestrator can act on.
 */
export abstract class FlowrAnalyzerIncrementalDataflowUpdateTypePlugin<TInformation = unknown> extends FlowrAnalyzerPlugin<TInformation, IncrementalUpdateResult> {
	readonly type = PluginType.IncrementalDataflowUpdateType;

	public static override defaultPlugin(): FlowrAnalyzerIncrementalDataflowUpdateTypePlugin {
		return new DefaultFlowrAnalyzerIncrementalDataflowUpdateTypePlugin();
	}

	protected abstract simpleGuards(ctx: FlowrAnalyzerContext, information: TInformation): IncrementalUpdateResult | undefined;

	protected abstract getChangedFilePaths(ctx: FlowrAnalyzerContext, information: TInformation): { added: readonly (FilePath | undefined)[], removed: readonly (FilePath | undefined)[] };

	protected abstract classifyUnchangedFileSet(ctx: FlowrAnalyzerContext, information: TInformation): IncrementalUpdateResult;

	protected abstract classifyFileAppended(ctx: FlowrAnalyzerContext, information: TInformation, addedPath: FilePath | undefined): IncrementalUpdateResult;

	protected abstract classifyFileRemoved(ctx: FlowrAnalyzerContext, information: TInformation, removedPath: FilePath | undefined): IncrementalUpdateResult;

	protected abstract changedFiles(ctx: FlowrAnalyzerContext, information: TInformation, ignoreIndexes: number[]): string[] | undefined;

	protected abstract isAddedAtEnd(shorter: unknown, longer: unknown): boolean;

	protected abstract commentsChanged(ctx: FlowrAnalyzerContext, information: TInformation): boolean;

	protected abstract locationsChanged(ctx: FlowrAnalyzerContext, information: TInformation): boolean;

	protected determineUpdateTypes(ctx: FlowrAnalyzerContext, information: TInformation): IncrementalUpdateResult {
		const { added, removed } = this.getChangedFilePaths(ctx, information);
		if(added.length === 0 && removed.length === 0) {
			return this.classifyUnchangedFileSet(ctx, information);
		} else if(added.length === 1 && removed.length === 0) {
			return this.classifyFileAppended(ctx, information, added[0]);
		} else if(removed.length === 1 && added.length === 0) {
			return this.classifyFileRemoved(ctx, information, removed[0]);
		} else {
			return { types: [IncrementalUpdateType.Full] };
		}
	}

	protected process(ctx: FlowrAnalyzerContext, information: TInformation): IncrementalUpdateResult {
		return this.simpleGuards(ctx, information) ?? this.determineUpdateTypes(ctx, information);
	}
}

/** What {@link DefaultFlowrAnalyzerIncrementalDataflowUpdateTypePlugin} requires as input. */
export interface IncrementalDataflowUpdateTypeInformation {
	readonly oldNormalizedAst: NormalizedAst | undefined;
	readonly newNormalizedAst: NormalizedAst;
}

/**
 * The default incremental dataflow update-type classifier, working purely on the persisted and the new AST.
 */
export class DefaultFlowrAnalyzerIncrementalDataflowUpdateTypePlugin extends FlowrAnalyzerIncrementalDataflowUpdateTypePlugin<IncrementalDataflowUpdateTypeInformation> {
	public readonly name = 'default-incremental-dataflow-update-type-plugin';
	public readonly description = 'Classifies AST changes by diffing file lists and hashing ASTs/file mtimes.';
	public readonly version = new SemVer('0.1.0');

	protected simpleGuards(ctx: FlowrAnalyzerContext, { oldNormalizedAst }: IncrementalDataflowUpdateTypeInformation): IncrementalUpdateResult | undefined {
		return oldNormalizedAst === undefined ? { types: [IncrementalUpdateType.Full] } : undefined;
	}

	private unwrapInformation(information: IncrementalDataflowUpdateTypeInformation): { oldAst: RProject<ParentInformation>, newAst: RProject<ParentInformation> } {
		guard(information.oldNormalizedAst !== undefined, 'simpleGuards should have ruled out an undefined oldNormalizedAst');
		return { oldAst: information.oldNormalizedAst.ast, newAst: information.newNormalizedAst.ast };
	}

	protected getChangedFilePaths(ctx: FlowrAnalyzerContext, information: IncrementalDataflowUpdateTypeInformation): { added: readonly (FilePath | undefined)[], removed: readonly (FilePath | undefined)[] } {
		const { oldAst, newAst } = this.unwrapInformation(information);
		const oldPaths = new Set(oldAst.files.map(file => file.filePath));
		const newPaths = new Set(newAst.files.map(file => file.filePath));
		return { added: [...setMinus(newPaths, oldPaths)], removed: [...setMinus(oldPaths, newPaths)] };
	}

	protected changedFiles(ctx: FlowrAnalyzerContext, information: IncrementalDataflowUpdateTypeInformation, ignoreIndexes: number[] = []): string[] | undefined {
		const { oldAst } = this.unwrapInformation(information);
		return oldAst.files
			.filter((file, i) => {
				if(ignoreIndexes.includes(i)) {
					return false;
				}
				if(file.filePath === undefined) {
					return true;
				}
				try {
					return ctx.inc.getLastKnownMtime(file.filePath) !== fs.statSync(file.filePath).mtimeMs;
				} catch{
					return true;
				}
			})
			.map(file => file.filePath ?? '');
	}

	/** Finds the single file whose content differs (if exactly one does), and its old/new root nodes. */
	private findSingleChangedFileRoots(ctx: FlowrAnalyzerContext, information: IncrementalDataflowUpdateTypeInformation): { oldRoot: RExpressionList<ParentInformation>, newRoot: RExpressionList<ParentInformation>, filePath: string | undefined } | undefined {
		const { oldAst, newAst } = this.unwrapInformation(information);
		const changed = this.changedFiles(ctx, information, []);
		if(changed === undefined || changed.length !== 1) {
			return undefined;
		}
		const oldAstFiles = oldAst.files;
		const newAstFiles = newAst.files;
		const changedIndex = oldAstFiles.findIndex(file => file.filePath === changed[0]);
		if(changedIndex === -1 || newAstFiles[changedIndex]?.filePath !== changed[0]) {
			return undefined;
		}
		return { oldRoot: oldAstFiles[changedIndex].root, newRoot: newAstFiles[changedIndex].root, filePath: newAstFiles[changedIndex].filePath };
	}

	protected classifyUnchangedFileSet(ctx: FlowrAnalyzerContext, information: IncrementalDataflowUpdateTypeInformation): IncrementalUpdateResult {
		const changed = this.changedFiles(ctx, information, []);
		if(changed === undefined || changed.length > 1) {
			return { types: [IncrementalUpdateType.Full] };
		}
		if(changed.length === 0) {
			return { types: [IncrementalUpdateType.Nothing] };
		}

		const roots = this.findSingleChangedFileRoots(ctx, information);
		if(roots === undefined) {
			return { types: [IncrementalUpdateType.Full] };
		}
		const { oldRoot, newRoot, filePath } = roots;

		if(this.sameHash(oldRoot, newRoot)) {
			const result: IncrementalUpdateType[] = [];
			if(this.commentsChanged(ctx, information)) {
				result.push(IncrementalUpdateType.Comment);
			}
			if(this.locationsChanged(ctx, information)) {
				result.push(IncrementalUpdateType.Location);
			}
			return { types: result.length > 0 ? result : [IncrementalUpdateType.Nothing] };
		}

		if(this.isAddedAtEnd(oldRoot, newRoot)) {
			return { types: [IncrementalUpdateType.AddedAtEnd], filePath };
		} else if(this.isAddedAtEnd(newRoot, oldRoot)) {
			return { types: [IncrementalUpdateType.RemovedAtEnd], filePath };
		}
		return { types: [IncrementalUpdateType.Full] };
	}

	protected classifyFileAppended(ctx: FlowrAnalyzerContext, information: IncrementalDataflowUpdateTypeInformation, addedPath: FilePath | undefined): IncrementalUpdateResult {
		const { oldAst, newAst } = this.unwrapInformation(information);
		const oldAstFiles = oldAst.files;
		const newAstFiles = newAst.files;
		const addedIndex = newAstFiles.findIndex(file => file.filePath === addedPath);
		if(addedIndex !== (newAst.files.length - 1)) {
			return { types: [IncrementalUpdateType.Full] };
		}

		const changed = this.changedFiles(ctx, information, []);
		if(changed === undefined || changed.length > 1) {
			return { types: [IncrementalUpdateType.Full] };
		}
		if(changed.length === 1) {
			const oldIdx = oldAstFiles.findIndex(file => file.filePath === changed[0]);
			const newIdx = newAstFiles.findIndex(file => file.filePath === changed[0]);
			if(oldIdx === -1 || newIdx === -1 || !this.isAddedAtEnd(oldAstFiles[oldIdx].root, newAstFiles[newIdx].root)) {
				return { types: [IncrementalUpdateType.Full] };
			}
		}
		return { types: [IncrementalUpdateType.NewFileAtEnd], filePath: newAstFiles[addedIndex].filePath };
	}

	protected classifyFileRemoved(ctx: FlowrAnalyzerContext, information: IncrementalDataflowUpdateTypeInformation, removedPath: FilePath | undefined): IncrementalUpdateResult {
		const { oldAst, newAst } = this.unwrapInformation(information);
		const oldAstFiles = oldAst.files;
		const newAstFiles = newAst.files;
		const removedIndex = oldAstFiles.findIndex(file => file.filePath === removedPath);
		if(removedIndex !== (oldAst.files.length - 1)) {
			return { types: [IncrementalUpdateType.Full] };
		}

		const changed = this.changedFiles(ctx, information, [removedIndex]);
		if(changed === undefined || changed.length > 1) {
			return { types: [IncrementalUpdateType.Full] };
		}
		if(changed.length === 1) {
			const oldIdx = oldAstFiles.findIndex(file => file.filePath === changed[0]);
			const newIdx = newAstFiles.findIndex(file => file.filePath === changed[0]);
			if(oldIdx === -1 || newIdx === -1 || !this.isAddedAtEnd(newAstFiles[newIdx].root, oldAstFiles[oldIdx].root)) {
				return { types: [IncrementalUpdateType.Full] };
			}
		}
		return { types: [IncrementalUpdateType.RemovedFileAtEnd], filePath: oldAstFiles[removedIndex].filePath };
	}

	protected isAddedAtEnd(shorterUnknown: unknown, longerUnknown: unknown): boolean {
		const shorter = shorterUnknown as RExpressionList<ParentInformation>;
		const longer = longerUnknown as RExpressionList<ParentInformation>;
		if(longer.children.length <= shorter.children.length) {
			return false;
		}
		return shorter.children.every((child, i) => this.sameHash(child, longer.children[i]));
	}

	/** Whether two AST (sub)trees are structurally identical, optionally ignoring source locations/comments. */
	protected sameHash(old: unknown, new_: unknown, ignoreLocations: boolean = true, ignoreComments: boolean = true): boolean {
		// currently used for comparing two asts or nodes. probably very costly
		return hashAst(old, ignoreLocations, ignoreComments) === hashAst(new_, ignoreLocations, ignoreComments);
	}

	protected commentsChanged(ctx: FlowrAnalyzerContext, information: IncrementalDataflowUpdateTypeInformation): boolean {
		const roots = this.findSingleChangedFileRoots(ctx, information);
		return roots !== undefined && hashAst(roots.oldRoot, true, false) !== hashAst(roots.newRoot, true, false);
	}

	protected locationsChanged(ctx: FlowrAnalyzerContext, information: IncrementalDataflowUpdateTypeInformation): boolean {
		const roots = this.findSingleChangedFileRoots(ctx, information);
		return roots !== undefined && hashAst(roots.oldRoot, false, true) !== hashAst(roots.newRoot, false, true);
	}
}

const alwaysIgnoredKeys = new Set(['id', 'parent', 'tsId']);

/** Hashes a given ast. Very costly at the moment. */
export function hashAst(ast: unknown, filterLocation = false, filterComments = false): string {
	return new Hash53().update(JSON.stringify(ast, (key: string, value: unknown) => {
		if(alwaysIgnoredKeys.has(key) || (filterLocation && (key === 'location' || key === 'fullRange'))) {
			return undefined;
		}
		if((key === 'lexeme' || key === 'fullLexeme') && typeof value === 'string') {
			return value.replace(/\s+/g, ' ').trim();
		}
		if(filterComments && Array.isArray(value)) {
			return (value as unknown[]).filter(entry => !RComment.is(entry));
		}
		return value;
	})).digest();
}