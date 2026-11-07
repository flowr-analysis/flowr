import { ArgProp, type ArgProps, type FnSig } from '../built-in-props';

/** The kinds of arguments that are always evaluated, as most definitions state them. */
export const Forced = {
	Value:    ArgProp.Forced | ArgProp.Value,
	Resource: ArgProp.Forced | ArgProp.Resource,
	Flag:     ArgProp.Forced | ArgProp.Flag,
	Handle:   ArgProp.Forced | ArgProp.Handle
} as const;

/**
 * A signature from the formals in the order R declares them, e.g. `sig({ x: Forced.Value, '...': Forced.Value })`.
 * Objects keep the insertion order of non-numeric keys, which every R formal name is, and cannot repeat a formal.
 */
export function sig(formals: Readonly<Record<string, ArgProps>>): FnSig {
	return Object.entries(formals);
}

/* the signatures several built-in definitions share */
export const SigAtomicBinOp: FnSig = sig({ e1: Forced.Value | ArgProp.Atomic, e2: Forced.Value | ArgProp.Atomic });
export const SigAtomicX: FnSig     = sig({ x: Forced.Value | ArgProp.Atomic });
export const SigXY: FnSig    = sig({ x: Forced.Value, y: Forced.Value });
export const SigX: FnSig     = sig({ x: Forced.Value });
/* `f(x, ...)`, the shape of most of R's summarizing and coercing functions */
export const SigXDots: FnSig = sig({ x: Forced.Value, '...': Forced.Value });
/* `verb(.data, ...)`, the shape of the tidyverse verbs: the data first, the columns after */
export const SigDataDots: FnSig = sig({ '.data': ArgProp.Value, '...': ArgProp.Value });
export const SigShape: FnSig  = sig({ x: ArgProp.Forced | ArgProp.Shape });
export const SigXTable: FnSig = sig({ x: Forced.Value, table: Forced.Value });
export const SigDots: FnSig  = sig({ '...': Forced.Value });
export const SigUnique: FnSig = sig({ x: Forced.Value, incomparables: Forced.Value, '...': Forced.Value });
/* the arguments name what they become, like the columns of `data.frame(a, b)` */
export const SigDotsDeparsed: FnSig = sig({ '...': Forced.Value | ArgProp.Deparsed });
