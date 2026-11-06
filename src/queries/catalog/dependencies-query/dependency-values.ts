/** The value could not be resolved, e.g. a path assembled at runtime. Such a dependency may be missing or fetchable. */
export const Unknown = 'unknown';
/** The value resolved, but to data given inline rather than to a path (`matrix(0, 2, 2)`, `data.frame(a = 1)`). */
export const Constant = 'constant';
