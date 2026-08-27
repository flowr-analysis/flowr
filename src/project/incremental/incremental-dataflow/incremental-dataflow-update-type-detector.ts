import type { NormalizedAst, ParentInformation } from '../../../r-bridge/lang-4.x/ast/model/processing/decorate';
import { RComment } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-comment';
import { Hash53 } from '../../../util/hash';
import { setMinus } from '../../../util/collections/set';
import fs from 'fs';
import type { FlowrAnalyzerContext } from '../../context/flowr-analyzer-context';
import type { RProject } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-project';
import type { RExpressionList } from '../../../r-bridge/lang-4.x/ast/model/nodes/r-expression-list';

export enum IncrementalUpdateType {
	Full         = 'Full',
	AddedAtEnd   = 'AddedAtEnd',
	RemovedAtEnd   = 'RemovedAtEnd',
	NewFileAtEnd = 'NewFileAtEnd',
	RemovedFileAtEnd = 'RemovedFileAtEnd',
	Location     = 'Location',
	Comment      = 'Comment',
	Nothing      = 'Nothing'
}

export interface IncrementalUpdateResult {
	types:     IncrementalUpdateType[];
	filePath?: string;
}

const alwaysIgnoredKeys = new Set(['id', 'parent', 'tsId']);

/**
 *
 */
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

/**
 *
 */
export class IncrementalDataflowUpdateTypeDetector {
	private readonly oldNormalizedAst: NormalizedAst | undefined;
	private readonly oldAst:           RProject<ParentInformation> | undefined;
	private readonly newAst:           RProject<ParentInformation>;
	private readonly ctx:              FlowrAnalyzerContext;

	public constructor(oldAst: NormalizedAst | undefined, newAst: NormalizedAst, ctx: FlowrAnalyzerContext) {
		this.oldNormalizedAst = oldAst;
		this.oldAst = oldAst ? oldAst.ast : undefined;
		this.newAst = newAst.ast;
		this.ctx = ctx;
	}

	determineUpdateTypes(): IncrementalUpdateResult {
		const result: IncrementalUpdateType[] = [];

		if(this.oldNormalizedAst === undefined || this.oldAst === undefined) {
			return { types: [IncrementalUpdateType.Full] };
		}

		const oldAstFiles = this.oldAst.files;
		const newAstFiles = this.newAst.files;

		const oldPaths = new Set(oldAstFiles.map(file => file.filePath));
		const newPaths = new Set(newAstFiles.map(file => file.filePath));
		const added = setMinus(newPaths, oldPaths);
		const removed = setMinus(oldPaths, newPaths);

		if(added.size === 0 && removed.size === 0) {
			const changed = this.changedFiles();
			if(changed === undefined || changed.length > 1) {
				return { types: [IncrementalUpdateType.Full] };
			}
			if(changed.length === 0) {
				return { types: [IncrementalUpdateType.Nothing] };
			}

			const changedIndex = oldAstFiles.findIndex(file => file.filePath === changed[0]);
			if(changedIndex === -1 || newAstFiles[changedIndex]?.filePath !== changed[0]) {
				return { types: [IncrementalUpdateType.Full] };
			}

			const oldAstRoot = oldAstFiles[changedIndex].root;
			const newAstRoot = newAstFiles[changedIndex].root;
			const filePath = newAstFiles[changedIndex].filePath;

			if(this.sameHash(oldAstRoot, newAstRoot)) {
				if(this.commentsChanged(oldAstRoot, newAstRoot)) {
					result.push(IncrementalUpdateType.Comment);
				}
				if(this.locationsChanged(oldAstRoot, newAstRoot)) {
					result.push(IncrementalUpdateType.Location);
				}
				return { types: result.length > 0 ? result : [IncrementalUpdateType.Nothing] };
			}

			if(this.isAddedAtEnd(oldAstRoot, newAstRoot)) {
				return { types: [IncrementalUpdateType.AddedAtEnd], filePath };
			} else if(this.isAddedAtEnd(newAstRoot, oldAstRoot)) {
				return { types: [IncrementalUpdateType.RemovedAtEnd], filePath };
			}
			return { types: [IncrementalUpdateType.Full] };
		} else if(added.size === 1 && removed.size === 0) {
			const addedIndex = newAstFiles.findIndex(file => file.filePath === added.values().next().value);
			if(addedIndex !== (this.newAst.files.length - 1)) {
				return { types: [IncrementalUpdateType.Full] };
			}

			const changed = this.changedFiles();
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
		} else if(removed.size === 1 && added.size === 0){
			const removedIndex = oldAstFiles.findIndex(file => file.filePath === removed.values().next().value);
			if(removedIndex !== (this.oldAst.files.length - 1)) {
				return { types: [IncrementalUpdateType.Full] };
			}

			const changed = this.changedFiles([removedIndex]);
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
		} else {
			return { types: [IncrementalUpdateType.Full] };
		}
	}

	changedFiles(ignoreIndexes: number[] = []): string[] | undefined {
		if(this.oldAst === undefined) {
			return undefined;
		}

		return this.oldAst.files
			.filter((_file, i) => !ignoreIndexes.includes(i))
			.filter(file => {
				if(file.filePath === undefined) {
					return true;
				}
				try {
					return this.ctx.inc.getLastKnownMtime(file.filePath) !== fs.statSync(file.filePath).mtimeMs;
				} catch{
					return true;
				}
			})
			.map(file => file.filePath ?? '');
	}

	isAddedAtEnd(shorter: RExpressionList<ParentInformation>, longer: RExpressionList<ParentInformation>): boolean {
		if(longer.children.length <= shorter.children.length) {
			return false;
		}
		return shorter.children.every((child, i) => this.sameHash(child, longer.children[i]));
	}

	sameHash(old: unknown, new_: unknown, ignoreLocations: boolean = true, ignoreComments: boolean = true){
		// currently used for comparing two asts or nodes. probably very costly
		return hashAst(old, ignoreLocations, ignoreComments) === hashAst(new_, ignoreLocations, ignoreComments);
	}

	commentsChanged(old: unknown, new_: unknown): boolean {
		return hashAst(old, true, false) !== hashAst(new_, true, false);
	}

	locationsChanged(old: unknown, new_: unknown): boolean {
		return hashAst(old, false, true) !== hashAst(new_, false, true);
	}
}