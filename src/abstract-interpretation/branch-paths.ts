import type { AbsintVisitorConfiguration } from './absint-inference';
import { guard } from '../util/assert';
import { Top } from './domains/lattice';
import { BoundedSetDomain, type BoundedSetLift } from './domains/bounded-set-domain';
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

/** the sorted steps of each path seen lately: the same paths flow through the whole interpretation, so they are split once */
const parsedPaths = new Map<string, readonly string[]>();
/** bounds what {@link parsedPaths} keeps, so a large package does not hold every path it ever saw */
const MaxParsedPaths = 100_000;

/** The steps of the path, sorted as {@link encodePath} sorts them. */
function sortedSteps(path: string): readonly string[] {
	let steps = parsedPaths.get(path);
	if(steps === undefined) {
		if(parsedPaths.size >= MaxParsedPaths) {
			parsedPaths.clear();
		}
		steps = path === '' ? [] : path.split(StepSeparator);
		parsedPaths.set(path, steps);
	}
	return steps;
}

function stepsOf(path: string): Set<string> {
	return new Set(sortedSteps(path));
}

/** per path and step, the path taking it: a loop is interpreted until nothing changes, so the same continuations come up again */
const continued = new Map<string, Map<string, string>>();

/** The path with `step` taken as well, the same string as `encodePath(stepsOf(path).add(step))` without splitting and sorting again. */
function withStep(path: string, step: string): string {
	let byStep = continued.get(path);
	if(byStep === undefined) {
		if(continued.size >= MaxParsedPaths) {
			continued.clear();
		}
		byStep = new Map();
		continued.set(path, byStep);
	}
	let next = byStep.get(step);
	if(next === undefined) {
		next = insertStep(path, step);
		byStep.set(step, next);
	}
	return next;
}

function insertStep(path: string, step: string): string {
	const steps = sortedSteps(path);
	let low = 0;
	let high = steps.length;
	while(low < high) {
		const mid = (low + high) >>> 1;
		if(steps[mid] < step) {
			low = mid + 1;
		} else {
			high = mid;
		}
	}
	return steps[low] === step ? path : [...steps.slice(0, low), step, ...steps.slice(low)].join(StepSeparator);
}

/** The steps all of the paths take, encoded as a path. */
function commonPath(paths: readonly string[]): string {
	let common = new Set(sortedSteps(paths[0]));
	for(const path of paths.slice(1)) {
		common = common.intersection(new Set(sortedSteps(path)));
	}
	return encodePath(common);
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
			return new BranchPathDomain([commonPath(paths)], this.limit) as this;
		}
		return new BranchPathDomain(value, this.limit) as this;
	}

	/** the steps all paths take, worked out once per value, as each join past the limit needs it of both sides */
	private common: ReadonlySet<string> | undefined;

	private commonSteps(this: this & BranchPathDomain): ReadonlySet<string> {
		if(this.common === undefined) {
			let common: ReadonlySet<string> | undefined;
			for(const path of this.value as ReadonlySet<string>) {
				common = common === undefined ? new Set(sortedSteps(path)) : common.intersection(new Set(sortedSteps(path)));
			}
			this.common = common ?? new Set();
		}
		return this.common;
	}

	/** Past the limit, the joined paths are the one path of the steps both sides' paths all take, so only those are intersected. */
	protected override joinValue(this: this & BranchPathDomain, other: BoundedSetDomain<string>): this {
		if(!other.isValue() || !(other instanceof BranchPathDomain)) {
			return super.joinValue(other as never);
		}
		const union = (this.value as ReadonlySet<string>).union(other.value);
		if(union.size <= this.limit) {
			return this.create(union);
		}
		return new BranchPathDomain([encodePath(this.commonSteps().intersection((other as BranchPathDomain & this).commonSteps()))], this.limit) as this;
	}

	/** Reached without any branch, as the start of a function body is. */
	public static start(): BranchPathDomain {
		return new BranchPathDomain(['']);
	}

	protected override meetValue(this: this & BranchPathDomain, other: BoundedSetDomain<string>): this {
		if(!other.isValue()) {
			return this.create(other.value);
		}
		const theirs = [...other.value].map(stepsOf);
		const mine = [...this.value as ReadonlySet<string>].map(stepsOf);
		/*
		 * past the limit, `create` keeps only the steps every pair takes, which are the steps all of mine take together with the steps
		 * all of theirs take, as `(a1 | b1) & (a1 | b2) & ... = (a1 & a2 ...) | (b1 & b2 ...)`; so the pairs are not built at all
		 */
		if(mine.length * theirs.length > this.limit) {
			const common = mine.reduce((a, b) => a.intersection(b)).union(theirs.reduce((a, b) => a.intersection(b)));
			return new BranchPathDomain([encodePath(common)], this.limit) as this;
		}
		return this.create(mine.flatMap(a => theirs.map(b => encodePath(a.union(b)))));
	}

	/** Every path continued by taking the branch. */
	public taking(step: BranchStep): this {
		if(!this.isValue()) {
			return this;
		}
		const taken = encodeStep(step);
		return this.create([...this.value].map(path => withStep(path, taken)));
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
