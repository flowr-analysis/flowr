import type { Leaf, Location, NoInfo } from '../model';
import type { RType } from '../type';

/**
 * Special comment to signal line mappings (e.g., in generated code) to the interpreter.
 */
export interface RLineDirective<Info = NoInfo> extends Location, Leaf<Info> {
	readonly type: RType.LineDirective;
	line:          number;
	file:          string;
}
