import type { AbsintVisitorConfiguration } from './absint-inference';
import { guard } from '../util/assert';
import { Top } from './domains/lattice';
import { BoundedSetDomain } from './domains/bounded-set-domain';
import type { BoundedSetLift } from './domains/bounded-set-domain';
import { NodeId } from '../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { ControlFlowInformation } from '../control-flow/control-flow-graph';

/**
 * One branch taken on the way to a node: the construct deciding it (`if`, `while`, `&&`, `||`, `switch`, ...), which
 * way it went, and, for a `switch`, the arm it entered.
 */
export interface BranchStep {
	readonly cause:   NodeId
	readonly when:    boolean
	readonly target?: NodeId
}

/** How many paths are told apart before nothing is known about how a node is reached. */
const MaxPaths = 64;

const StepSeparator = '\u0002';
const PartSeparator = '\u0001';

function encodeStep({ cause, when, target }: BranchStep): string {
	return `${String(cause)}${PartSeparator}${when ? 1 : 0}${PartSeparator}${target === undefined ? '' : String(target)}`;
}

function decodeStep(step: string): BranchStep {
	const [cause, when, target] = step.split(PartSeparator);
	return { cause: NodeId.normalize(cause), when: when === '1', ...(target === '' ? {} : { target: NodeId.normalize(target) }) };
}

/** A path as the set of its steps, kept sorted so that the same steps are the same path. */
function encodePath(steps: ReadonlySet<string>): string {
	return [...steps].sort().join(StepSeparator);
}

function stepsOf(path: string): Set<string> {
	return new Set(path === '' ? [] : path.split(StepSeparator));
}

/** The other way the step goes, the same branch taken the other way. */
function flipped(step: string): string {
	const [cause, when, target] = step.split(PartSeparator);
	return [cause, when === '1' ? '0' : '1', target].join(PartSeparator);
}

/** The paths with every two that differ in one branch only merged into one without it, until no more do. */
function resolved(paths: Set<string>[], mergeable: (step: string) => boolean): Set<string>[] {
	const unique = new Map(paths.map(p => [encodePath(p), p]));
	for(let merged = true; merged;) {
		merged = false;
		const all = [...unique.values()];
		search: for(const a of all) {
			for(const step of a) {
				const twin = new Set(a);
				twin.delete(step);
				const other = encodePath(twin.add(flipped(step)));
				if(unique.has(other) && flipped(step) !== step && mergeable(step)) {
					twin.delete(flipped(step));
					unique.delete(encodePath(a));
					unique.delete(other);
					unique.set(encodePath(twin), twin);
					merged = true;
					break search;
				}
			}
		}
	}
	return [...unique.values()];
}

/**
 * The ways a node is reached, each as the set of branches taken on the way, which is a disjunction of conjunctions:
 * a join keeps the paths of either side, a meet takes the branches of both. Past {@link MaxPaths} paths it keeps only the
 * branches all of them take.
 */
export class BranchPathDomain extends BoundedSetDomain<string> {
	constructor(value: BoundedSetLift<string> | string[], limit = MaxPaths) {
		super(value, limit);
	}

	/** Past the limit, the paths are the one path of the steps all of them take, which still holds whichever way the node was reached. */
	public override create(value: BoundedSetLift<string> | string[]): this {
		const paths = value === Top ? undefined : [...value as Iterable<string>];
		if(paths !== undefined && paths.length > this.limit) {
			const common = paths.map(stepsOf).reduce((a, b) => a.intersection(b));
			return new BranchPathDomain([encodePath(common)], this.limit) as this;
		}
		return new BranchPathDomain(value, this.limit) as this;
	}

	/** Reached without any branch, as the start of a function body is. */
	public static start(): BranchPathDomain {
		return new BranchPathDomain(['']);
	}

	protected override meetValue(this: this & BranchPathDomain, other: BoundedSetDomain<string>): this {
		if(!other.isValue()) {
			return this.create(other.value);
		}
		const theirs: readonly string[] = [...other.value];
		const mine: readonly string[] = [...this.value as ReadonlySet<string>];
		const both = mine.flatMap(a => theirs.map(b => encodePath(stepsOf(a).union(stepsOf(b)))));
		return this.create(both);
	}

	/** Every path continued by taking the branch. */
	public taking(step: BranchStep): this {
		if(!this.isValue()) {
			return this;
		}
		const taken = encodeStep(step);
		return this.create([...this.value].map(path => encodePath(stepsOf(path).add(taken))));
	}

	/**
	 * The paths, each a list of the branches it takes, `undefined` for Top. Two paths that only differ in which way one branch
	 * went are one path without that branch, as the node is reached either way (`if(c) a else b; d` reaches `d` whatever `c` is),
	 * unless `mergeable` says something hangs on the branch it went.
	 */
	public paths(mergeable: (cause: NodeId) => boolean = () => true): readonly (readonly BranchStep[])[] | undefined {
		return this.isValue() ? resolved([...this.value].map(stepsOf), step => mergeable(decodeStep(step).cause)).map(steps => [...steps].map(decodeStep)) : undefined;
	}
}

export type Paths = { readonly paths: BranchPathDomain };

/**
 * Works out, for every node of every function body, the branches taken on the way there from the start of the body,
 * see {@link BranchPathDomain}. Each body is interpreted on its own, whether or not anything calls it, without stepping
 * into what it calls, and the state is kept per function definition (the key is its id).
 */
export interface BranchPaths {
	/** the control flow the paths are taken in */
	readonly controlFlow: ControlFlowInformation
	/** Interprets every function body. */
	start(): void
	/** The paths to the node within the body of the definition, `undefined` if they are not known; only branches `mergeable` says nothing hangs on are merged away, see {@link BranchPathDomain#paths}. */
	pathsTo(definition: NodeId, node: NodeId, mergeable?: (cause: NodeId) => boolean): readonly (readonly BranchStep[])[] | undefined
}

/** Made by the interpreter once it is loaded, see `branch-paths-interpreter.ts`, which the {@link FlowrAnalyzer} loads. */
let Interpreter: ((config: AbsintVisitorConfiguration) => BranchPaths) | undefined;

export const BranchPaths = {
	/**
	 * Interprets with the {@link AbstractInterpreter}, which is loaded apart from these paths: it builds on the dataflow
	 * semantics, which in turn read the guards of functions that use the paths.
	 */
	create(this: void, config: AbsintVisitorConfiguration): BranchPaths {
		guard(Interpreter !== undefined, 'load abstract-interpretation/branch-paths-interpreter first, as the FlowrAnalyzer does');
		return Interpreter(config);
	},
	/** Hands over how to make the interpreter, see {@link BranchPaths.create}. */
	register(this: void, make: (config: AbsintVisitorConfiguration) => BranchPaths): void {
		Interpreter = make;
	}
} as const;
