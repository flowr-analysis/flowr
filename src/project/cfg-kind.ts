/**
 * Denotes the kind of control flow graph (CFG).
 */
export enum CfgKind {
	/**
	 * CFG with dataflow information.
	 */
	WithDataflow,
	/**
	 * CFG without dataflow information.
	 */
	NoDataflow,
	/**
	 * CFG without function definition vertices and without dataflow information.
	 */
	NoFunctionDefs,
	/**
	 * A CFG version that is much quicker and does not apply any simplifications or dataflow information.
	 */
	Quick
}

