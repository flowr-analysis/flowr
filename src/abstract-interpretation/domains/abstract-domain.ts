import type { Bottom, Lattice, Top } from './lattice';

export const DEFAULT_INFERENCE_LIMIT = 50;

export interface AbstractDomain<Concrete, Abstract, Top = typeof Top, Bot = typeof Bottom, Lift extends Abstract | Top | Bot = Abstract | Top | Bot>
extends Lattice<Abstract, Top, Bot, Lift> {
	widen(other: AbstractDomain<Concrete, Abstract, Top, Bot>): AbstractDomain<Concrete, Abstract, Top, Bot>;

	narrow(other: AbstractDomain<Concrete, Abstract, Top, Bot>): AbstractDomain<Concrete, Abstract, Top, Bot>;

	concretize(limit?: number): ReadonlySet<Concrete> | typeof Top;

	abstract(concrete: ReadonlySet<Concrete> | typeof Top): AbstractDomain<Concrete, Abstract, Top, Bot>;
}
