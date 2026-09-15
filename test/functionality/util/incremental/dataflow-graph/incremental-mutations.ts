import seedrandom from 'seedrandom';
import { IncrementalUpdateType } from '../../../../../src/project/incremental/incremental-dataflow/incremental-dataflow-update-type-detector';
import { SeededRandom } from '../../project/plugin/random-r-code-generator';

/** Types of incremental mutations that we test for */
export enum IncrementalMutationType {
	AddLastLine         = 'add-last-line',
	DeleteLastLine      = 'delete-last-line',
	DeleteRandomLine    = 'delete-random-line',
	DuplicateRandomLine = 'duplicate-random-line',
	AddComment          = 'add-comment',
	AddWhitespace       = 'add-whitespace',
	NoOp                = 'no-op',
	AddSourcedFile      = 'add-sourced-file',
	RemoveSourcedFile   = 'remove-sourced-file',
}

export interface MutationResult {
	readonly oldFiles: Record<string, string[]>;
	readonly newFiles: Record<string, string[]>;
}

export interface Mutation {
	readonly expectedType: IncrementalUpdateType;
	apply(files: Record<string, string[]>): MutationResult | undefined;
}

const random = new SeededRandom(seedrandom('incremental-mutations'));

function rootFileMutation(
	transform: (lines: string[]) => { oldLines: string[], newLines: string[] } | undefined
): Mutation['apply'] {
	return files => {
		const [root, ...rest] = Object.keys(files);
		const t = transform(files[root]);
		if(t === undefined) {
			return undefined;
		}
		const passthrough = Object.fromEntries(rest.map(name => [name, files[name]]));
		return {
			oldFiles: { [root]: t.oldLines, ...passthrough },
			newFiles: { [root]: t.newLines, ...passthrough }
		};
	};
}

function sourcedFileMutation(direction: 'add' | 'remove'): Mutation['apply'] {
	// we for now assume that the root file has the source call as the last possible line
	return files => {
		const names = Object.keys(files);
		if(names.length < 2) {
			return undefined;
		}
		const [root, sourced] = names;
		const withSource: Record<string, string[]> = { [root]: files[root], [sourced]: files[sourced] };
		const withoutSource: Record<string, string[]> = { [root]: files[root].slice(0, -1) };
		return direction === 'add'
			? { oldFiles: withoutSource, newFiles: withSource }
			: { oldFiles: withSource, newFiles: withoutSource };
	};
}

/**
 * Mutation objects with their respective mutations that are applied per {@link IncrementalMutationType}.
 */
export const Mutations: Partial<Record<IncrementalMutationType, Mutation>> = {
	[IncrementalMutationType.AddLastLine]: {
		expectedType: IncrementalUpdateType.AddedAtEnd,
		apply:        rootFileMutation(lines => lines.length < 1 ? undefined : { oldLines: lines.slice(0, -1), newLines: lines })
	},
	[IncrementalMutationType.DeleteLastLine]: {
		expectedType: IncrementalUpdateType.RemovedAtEnd,
		apply:        rootFileMutation(lines => lines.length < 1 ? undefined : { oldLines: lines, newLines: lines.slice(0, -1) })
	},
	[IncrementalMutationType.DeleteRandomLine]: {
		expectedType: IncrementalUpdateType.Full,
		apply:        rootFileMutation(lines => {
			if(lines.length < 2) {
				return undefined;
			}
			const idx = random.int(lines.length - 1);
			return { oldLines: lines, newLines: [...lines.slice(0, idx), ...lines.slice(idx + 1)] };
		})
	},
	[IncrementalMutationType.DuplicateRandomLine]: {
		expectedType: IncrementalUpdateType.Full,
		apply:        rootFileMutation(lines => {
			if(lines.length < 2) {
				return undefined;
			}
			const idx = random.int(lines.length - 1);
			return { oldLines: lines, newLines: [...lines.slice(0, idx + 1), lines[idx], ...lines.slice(idx + 1)] };
		})
	},
	[IncrementalMutationType.NoOp]: {
		expectedType: IncrementalUpdateType.Nothing,
		apply:        files => ({ oldFiles: files, newFiles: files })
	},
	[IncrementalMutationType.AddComment]: {
		expectedType: IncrementalUpdateType.Comment,
		apply:        rootFileMutation(lines => ({ oldLines: lines, newLines: [...lines, '\n# this is a test comment'] }))
	},
	[IncrementalMutationType.AddWhitespace]: {
		expectedType: IncrementalUpdateType.Location,
		apply:        rootFileMutation(lines => ({ oldLines: lines, newLines: ['\n', ...lines, '    ', '\n'] }))
	},
	[IncrementalMutationType.AddSourcedFile]: {
		expectedType: IncrementalUpdateType.NewFileAtEnd,
		apply:        sourcedFileMutation('add')
	},
	[IncrementalMutationType.RemoveSourcedFile]: {
		expectedType: IncrementalUpdateType.RemovedFileAtEnd,
		apply:        sourcedFileMutation('remove')
	}
};

/**
 * Looks up mutation based on {@link IncrementalMutationType}.
 */
export function resolveMutation(type: IncrementalMutationType): Mutation {
	const mutation = Mutations[type];
	if(mutation === undefined) {
		throw new Error(`No Mutation implementation registered yet for IncrementalMutationType.${type}`);
	}
	return mutation;
}
