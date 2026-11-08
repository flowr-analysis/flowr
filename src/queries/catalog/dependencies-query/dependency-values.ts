/** The value could not be resolved, e.g. a path assembled at runtime. Such a dependency may be missing or fetchable. */
export const Unknown = 'unknown';
/** The value resolved, but to data given inline rather than to a path (`matrix(0, 2, 2)`, `data.frame(a = 1)`). */
export const Constant = 'constant';
/** What goes to the console rather than to a file: the standard output, and the standard error stream. */
export const StdOut = 'stdout';
export const StdErr = 'stderr';
/** The values naming a console stream rather than a file, see {@link StdOut} and {@link StdErr}. */
export const ConsoleStreams: ReadonlySet<string> = new Set([StdOut, StdErr]);
