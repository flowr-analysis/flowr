/**
 * The decoration module is tasked with taking an R-ast given by a {@link RNode} and
 *
 * 1. assigning a unique id to each node (see {@link RNodeWithId})
 * 2. transforming the AST into a doubly linked tree using the ids (so it stays serializable)
 *
 * @module
 */

import { RNode } from '../r-bridge'

/** The type of the id assigned to each node */
export type IdType = string;

/**
 * Uniquely identified AST-Nodes
 * @param OtherInfo - 
 */
export type RNodeWithId<OtherInfo> = RNode<OtherInfo & { id: IdType }>

/**
 * A function that given an RNode returns a (guaranteed) unique id for it
 * @param data - the node to generate an id for
 *
 * @returns a unique id for the given node
 */
export type IdGenerator<OtherInfo> = (data: RNode<OtherInfo>) => IdType
