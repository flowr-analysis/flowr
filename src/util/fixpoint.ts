import { Monoid } from './monoid';
import { isNotUndefined } from './assert';
/** the number of a node whose component is complete, see {@link StronglyConnected} */
const Complete = -1;

/** The strongly connected components of a graph whose successors are asked for only once a node is reached (Tarjan's algorithm, iterative). */
export class StronglyConnected<K> {
	private readonly next:       (node: K) => Iterable<K>;
	private readonly onComplete: (members: readonly K[], successorsOf: (member: K) => readonly K[]) => void;
	/** the number each node was entered with, {@link Complete} once its component is */
	private readonly index =      new Map<K, number>();
	/* by the number of a node whose component is not complete yet */
	private readonly low:        number[] = [];
	private readonly successors: (readonly K[] | undefined)[] = [];
	private readonly open:       K[] = [];
	private entered = 0;

	/**
	 * @param next       - the nodes a node leads to, asked for once per node
	 * @param onComplete - called with the members of each component once all components it leads to are complete
	 */
	constructor(next: (node: K) => Iterable<K>, onComplete: (members: readonly K[], successorsOf: (member: K) => readonly K[]) => void) {
		this.next = next;
		this.onComplete = onComplete;
	}

	/** Completes the component of `start` and every component it leads to. */
	public visit(start: K): void {
		if(this.index.has(start)) {
			return;
		}
		const path = [this.enter(start)];
		const positions = [0];
		while(path.length > 0) {
			const top = path.length - 1;
			const at = path[top];
			const successors = this.successors[at] as readonly K[];
			if(positions[top] < successors.length) {
				const next = this.index.get(successors[positions[top]++]);
				if(next === undefined) {
					path.push(this.enter(successors[positions[top] - 1]));
					positions.push(0);
				} else if(next !== Complete && next < this.low[at]) {
					this.low[at] = next;
				}
				continue;
			}
			path.pop();
			positions.pop();
			const low = this.low[at];
			if(path.length > 0 && low < this.low[path[path.length - 1]]) {
				this.low[path[path.length - 1]] = low;
			}
			if(low === at) {
				this.complete(at);
			}
		}
	}

	private enter(node: K): number {
		const at = this.entered++;
		this.index.set(node, at);
		this.low[at] = at;
		this.open.push(node);
		const next = this.next(node);
		this.successors[at] = Array.isArray(next) ? next as readonly K[] : [...next];
		return at;
	}

	private complete(root: number): void {
		let start = this.open.length - 1;
		while(this.index.get(this.open[start]) !== root) {
			start--;
		}
		const members = this.open.splice(start);
		this.onComplete(members, m => this.successors[this.index.get(m) as number] as readonly K[]);
		for(const m of members) {
			const at = this.index.get(m) as number;
			this.successors[at] = undefined;
			this.index.set(m, Complete);
		}
	}
}

/** What each node reaches, joined over everything it leads to: `of(n) = own(n)` joined with `of(s)` for every successor `s`. */
export class ReachSummaries<K, V> {
	private readonly values = new Map<K, V>();
	private readonly components: StronglyConnected<K>;

	/**
	 * @param next   - the nodes a node leads to, asked for once per node
	 * @param own    - what a node contributes itself, asked for once per node after its successors
	 * @param monoid - joins the values, its `concat` may return either of them if it subsumes the other but must not change them
	 */
	constructor(next: (node: K) => Iterable<K>, own: (node: K) => V | undefined, monoid: Monoid<V>) {
		this.components = new StronglyConnected(next, (members, successorsOf) => {
			const value = Monoid.fold(monoid, members.flatMap(m => [own(m), ...successorsOf(m).map(s => this.values.get(s))]).filter(isNotUndefined));
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

/** Solves a {@link DemandProblem} for the nodes asked for, finding the cycles as Tarjan's algorithm does while the values are computed: a node outside any cycle is computed once, the nodes of a cycle are computed round by round, in the order they were reached and each seeing the latest values, until a round changes nothing. */
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
