import { ArrayQueue } from './collections/queue';

/**
 * The strongly connected components of a graph whose successors are asked for only once a node is reached (Tarjan's
 * algorithm, iterative). Each component is completed once everything it leads to is, so callees come before callers.
 * Completed nodes are remembered, so later visits from other starts share the work.
 */
export class StronglyConnected<K> {
	private readonly next:       (node: K) => Iterable<K>;
	private readonly onComplete: (members: readonly K[], successorsOf: (member: K) => readonly K[]) => void;
	private readonly index =      new Map<K, number>();
	private readonly low =        new Map<K, number>();
	private readonly successors = new Map<K, readonly K[]>();
	private readonly open:       K[] = [];
	private readonly done =       new Set<K>();
	private entered = 0;

	/**
	 * @param next       - the nodes a node leads to, asked for once per node
	 * @param onComplete - called with the members of each component once all components it leads to are complete
	 */
	constructor(next: (node: K) => Iterable<K>, onComplete: (members: readonly K[], successorsOf: (member: K) => readonly K[]) => void) {
		this.next = next;
		this.onComplete = onComplete;
	}

	public isComplete(node: K): boolean {
		return this.done.has(node);
	}

	/** Completes the component of `start` and every component it leads to. */
	public visit(start: K): void {
		if(this.done.has(start)) {
			return;
		}
		const path = [start];
		const positions = [0];
		this.enter(start);
		while(path.length > 0) {
			const top = path.length - 1;
			const node = path[top];
			const successors = this.successors.get(node) as readonly K[];
			if(positions[top] < successors.length) {
				const next = successors[positions[top]++];
				if(this.done.has(next)) {
					continue;
				}
				const at = this.index.get(next);
				if(at === undefined) {
					this.enter(next);
					path.push(next);
					positions.push(0);
				} else if(at < (this.low.get(node) as number)) {
					this.low.set(node, at);
				}
				continue;
			}
			path.pop();
			positions.pop();
			const low = this.low.get(node) as number;
			if(path.length > 0) {
				const parent = path[path.length - 1];
				if(low < (this.low.get(parent) as number)) {
					this.low.set(parent, low);
				}
			}
			if(low === this.index.get(node)) {
				this.complete(node);
			}
		}
	}

	private enter(node: K): void {
		this.index.set(node, this.entered);
		this.low.set(node, this.entered++);
		this.open.push(node);
		this.successors.set(node, [...this.next(node)]);
	}

	private complete(root: K): void {
		const members = this.open.splice(this.open.lastIndexOf(root));
		this.onComplete(members, m => this.successors.get(m) as readonly K[]);
		for(const m of members) {
			this.done.add(m);
			this.index.delete(m);
			this.low.delete(m);
			this.successors.delete(m);
		}
	}
}

/**
 * What each node reaches, joined over everything it leads to: `of(n) = own(n)` joined with `of(s)` for every successor `s`.
 * As the join is the only thing applied, all members of a cycle hold the same value, which is computed once.
 */
export class ReachSummaries<K, V> {
	private readonly values = new Map<K, V>();
	private readonly components: StronglyConnected<K>;

	/**
	 * @param next  - the nodes a node leads to, asked for once per node
	 * @param own   - what a node contributes itself, asked for once per node after its successors
	 * @param empty - the value of a node that neither has nor reaches anything
	 * @param join  - joins two values, may return either of them if it subsumes the other but must not change them
	 */
	constructor(next: (node: K) => Iterable<K>, own: (node: K) => V | undefined, empty: V, join: (a: V, b: V) => V) {
		this.components = new StronglyConnected(next, (members, successorsOf) => {
			let value = empty;
			for(const m of members) {
				const mine = own(m);
				if(mine !== undefined) {
					value = join(value, mine);
				}
				for(const s of successorsOf(m)) {
					const reached = this.values.get(s);
					if(reached !== undefined) {
						value = join(value, reached);
					}
				}
			}
			for(const m of members) {
				this.values.set(m, value);
			}
		});
	}

	public of(node: K): V {
		this.components.visit(node);
		return this.values.get(node) as V;
	}
}

/** The union of both sets, one of them if it holds the other, so summaries share their sets wherever they can. */
export function unionOfSets<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): ReadonlySet<T> {
	if(a === b || b.size === 0 || (b.size <= a.size && b.isSubsetOf(a))) {
		return a;
	} else if(a.size === 0 || (a.size <= b.size && a.isSubsetOf(b))) {
		return b;
	}
	return a.union(b);
}

/** A monotone equation system over the nodes of a graph, each node's value depending on those of its successors. */
export interface FixpointProblem<K, V> {
	/** the nodes whose values the value of a node depends on, asked for once per node */
	readonly next:        (node: K) => Iterable<K>
	/** the value of a node given the current values of its successors (and only of those, or of itself) */
	readonly transfer:    (node: K, valueOf: (successor: K) => V) => V
	readonly equals:      (a: V, b: V) => boolean
	/** what a node of a cycle is assumed to hold before its first round */
	readonly initial:     (node: K) => V
	/** applied to the old and new value of a node once it has been computed `widenAfter` times within its cycle */
	readonly widen?:      (previous: V, next: V) => V
	readonly widenAfter?: number
	/** how many times the nodes of one cycle may be computed in total before all of them answer `exhausted` */
	readonly budget?:     number
	readonly exhausted?:  (node: K) => V
}

/**
 * Solves a {@link FixpointProblem} for the nodes asked for and what they depend on, component by component in the order
 * of {@link StronglyConnected}: a node outside any cycle is computed once, the nodes of a cycle are computed until no
 * value changes, in a fixed order, recomputing a node only if one of its successors changed.
 */
export class FixpointSolver<K, V> {
	private readonly values = new Map<K, V>();
	private readonly components: StronglyConnected<K>;
	private readonly problem:    FixpointProblem<K, V>;

	constructor(problem: FixpointProblem<K, V>) {
		this.problem = problem;
		this.components = new StronglyConnected(problem.next, (members, successorsOf) => this.settle(members, successorsOf));
	}

	public of(node: K): V {
		this.components.visit(node);
		return this.values.get(node) as V;
	}

	private settle(members: readonly K[], successorsOf: (member: K) => readonly K[]): void {
		const { transfer, equals, initial, widen, widenAfter = Infinity, budget = Infinity, exhausted } = this.problem;
		const valueOf = (node: K) => this.values.get(node) as V;
		const only = members[0];
		if(members.length === 1 && !successorsOf(only).includes(only)) {
			this.values.set(only, transfer(only, valueOf));
			return;
		}
		const dependents = new Map<K, K[]>(members.map(m => [m, []]));
		for(const m of members) {
			this.values.set(m, initial(m));
			for(const s of successorsOf(m)) {
				dependents.get(s)?.push(m);
			}
		}
		const visits = new Map<K, number>();
		const pending = new ArrayQueue(members);
		const queued = new Set(members);
		for(let spent = 0; !pending.isEmpty(); spent++) {
			if(spent >= budget) {
				for(const m of members) {
					this.values.set(m, exhausted ? exhausted(m) : initial(m));
				}
				return;
			}
			const node = pending.dequeue() as K;
			queued.delete(node);
			const count = (visits.get(node) ?? 0) + 1;
			visits.set(node, count);
			const previous = valueOf(node);
			let value = transfer(node, valueOf);
			if(widen !== undefined && count > widenAfter) {
				value = widen(previous, value);
			}
			if(equals(previous, value)) {
				continue;
			}
			this.values.set(node, value);
			for(const d of dependents.get(node) as K[]) {
				if(!queued.has(d)) {
					queued.add(d);
					pending.enqueue(d);
				}
			}
		}
	}
}

/** An equation system whose dependencies show only as a node's value is computed, see {@link DemandSolver}. */
export interface DemandProblem<K, V> {
	/** the value of a node, asking `valueOf` for whatever other values it needs */
	readonly transfer:  (node: K, valueOf: (other: K) => V) => V
	readonly equals:    (a: V, b: V) => boolean
	/** what a node asked for while it is being computed is assumed to hold before its cycle has been iterated */
	readonly initial:   (node: K) => V
	/** how many rounds a cycle gets to settle before all of its nodes answer `exhausted` */
	readonly rounds:    number
	readonly exhausted: (node: K) => V
}

/**
 * Solves a {@link DemandProblem} for the nodes asked for, finding the cycles as Tarjan's algorithm does while the values
 * are computed: a node outside any cycle is computed once, the nodes of a cycle are computed round by round, in the
 * order they were reached and each seeing the latest values, until a round changes nothing. A node that joins a
 * cycle during the rounds is iterated with it.
 */
export class DemandSolver<K, V> {
	private readonly problem: DemandProblem<K, V>;
	private readonly values = new Map<K, V>();
	/* the nodes whose cycle is not settled yet, with their current values */
	private readonly index =   new Map<K, number>();
	private readonly low =     new Map<K, number>();
	private readonly current = new Map<K, V>();
	private readonly open:    K[] = [];
	private readonly asking:  K[] = [];
	/** the open nodes asked for while they were open, a cycle of one if no other node is open above them */
	private readonly cyclic =  new Set<K>();
	private entered = 0;
	private readonly valueOf = (node: K): V => this.of(node);

	constructor(problem: DemandProblem<K, V>) {
		this.problem = problem;
	}

	public of(node: K): V {
		const done = this.values.get(node);
		if(done !== undefined || this.values.has(node)) {
			return done as V;
		}
		const at = this.index.get(node);
		if(at !== undefined) {
			this.cyclic.add(node);
			this.lower(at);
			return this.current.has(node) ? this.current.get(node) as V : this.problem.initial(node);
		}
		const own = this.entered++;
		this.index.set(node, own);
		this.low.set(node, own);
		this.open.push(node);
		this.asking.push(node);
		const value = this.problem.transfer(node, this.valueOf);
		this.asking.pop();
		this.current.set(node, value);
		const low = this.low.get(node) as number;
		this.lower(low);
		if(low === own) {
			this.settle(node, own);
		}
		return this.current.get(node) ?? this.values.get(node) as V;
	}

	/** Tells the node being computed that it rests on a node entered at `at`. */
	private lower(at: number): void {
		const caller = this.asking[this.asking.length - 1];
		if(caller !== undefined && at < (this.low.get(caller) as number)) {
			this.low.set(caller, at);
		}
	}

	private settle(root: K, own: number): void {
		const start = this.open.lastIndexOf(root);
		/* a node that asked for no open node was computed once and for all */
		if(this.open.length - start > 1 || this.cyclic.has(root)) {
			for(let round = 0; ; round++) {
				if(round >= this.problem.rounds) {
					for(const m of this.open.slice(start)) {
						this.current.set(m, this.problem.exhausted(m));
					}
					break;
				}
				let changed = false;
				/* the members of the cycle, which grows if a round reaches a node that leads back into it */
				for(let i = start; i < this.open.length; i++) {
					const m = this.open[i];
					this.asking.push(m);
					const value = this.problem.transfer(m, this.valueOf);
					this.asking.pop();
					if(!this.problem.equals(this.current.get(m) as V, value)) {
						this.current.set(m, value);
						changed = true;
					}
				}
				let low = own;
				for(let i = start; i < this.open.length; i++) {
					low = Math.min(low, this.low.get(this.open[i]) as number);
				}
				if(low < own) {
					/* a round found the cycle to rest on an open node below it, whose cycle settles it */
					this.low.set(root, low);
					this.lower(low);
					return;
				}
				if(!changed) {
					break;
				}
			}
		}
		for(const m of this.open.splice(start)) {
			this.values.set(m, this.current.get(m) as V);
			this.current.delete(m);
			this.index.delete(m);
			this.low.delete(m);
			this.cyclic.delete(m);
		}
	}
}
