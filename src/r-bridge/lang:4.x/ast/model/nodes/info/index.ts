/**
 * Other nodes are not part of the normal ast but shipped with the source information.
 * This way, elements which are uninteresting to us (like braces and parentheses) can be ignored safely for most operations,
 * but are still available and linked to the corresponding element.
 * <p>
 * In the future, they could be still integrated into the main ast.
 * @module
 */


import { RDelimiter } from './RDelimiter'

export * from './RDelimiter'

export type OtherInfoNode = RDelimiter
