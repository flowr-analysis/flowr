/**
 * The metamorphic mutations of the counterexample suite: {@link MutationProgram} is how a pass sees a program,
 * {@link MutationPasses} are the rewrites, and the observations are what no rewrite may change.
 * @module
 */
export * from './mutation/mutation-program';
export * from './mutation/mutation-passes';
export * from './mutation/mutation-observe';
