/**
 * The packages shipped with R itself (priority `base`) together with the `recommended` packages.
 * These are always available without being installed from CRAN, so they are not expected to be
 * present in an external package database. Check membership directly with `.has(name)`.
 */
export const RBaseAndRecommendedPackages: ReadonlySet<string> = new Set([
	'base', 'compiler', 'datasets', 'graphics', 'grDevices', 'grid', 'methods',
	'parallel', 'splines', 'stats', 'stats4', 'tcltk', 'tools', 'translations', 'utils',
	'boot', 'class', 'cluster', 'codetools', 'foreign', 'KernSmooth', 'lattice', 'MASS',
	'Matrix', 'mgcv', 'nlme', 'nnet', 'rpart', 'spatial', 'survival'
]);
