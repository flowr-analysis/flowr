/**
 * The signature of a helper-object accessor that passes an absent input through:
 * given a defined `In` it returns `Out`, given one that may be `undefined` it returns `Out | undefined`.
 *
 * flowR stores most of its small values as tuples (a source range, an identifier, ...) and reads them through a
 * helper object rather than through methods. Those helpers see `undefined` constantly, as the thing they read
 * off is optional far more often than not, and without this signature every call site has to unwrap first.
 * Typing the accessor this way keeps the common case exactly as precise as before while letting the absent case
 * flow through, so `Identifier.getName(Dataflow.qualify(id, graph))` needs no `?? ''` in between.
 *
 * It is one call signature rather than two overloads on purpose: an overloaded function passed as a callback
 * (`ids.map(Identifier.getName)`) is contextually typed by its last overload, which would infect every such
 * result with `undefined`.
 *
 * Implement it by casting the (undefined-tolerant) function, which costs nothing at runtime:
 * ```ts
 * getName: ((id?: Identifier) => Array.isArray(id) ? id[0] : id) as Accessor<Identifier, string>,
 * ```
 */
export type Accessor<In, Out> = <T extends In | undefined>(this: void, of: T) => IfPresent<T, Out>;

/** `Out` for a `T` that is there, `undefined` for one that is not, and the union for a `T` that may be either. */
export type IfPresent<T, Out> = T extends undefined ? undefined : Out;
