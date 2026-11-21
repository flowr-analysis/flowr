/**
 * Turns on node's on-disk compile cache, so a run reuses the code cache of the one before it rather than
 * recompiling every module. Imported for its side effect, and first, as it only helps what loads after it.
 * @module
 */
import module from 'module';

try {
	/* added in node 22.8; an older runtime, or a cache directory it cannot write, simply does without */
	module.enableCompileCache?.();
} catch{
	/* the cache is an optimization, never a requirement */
}
