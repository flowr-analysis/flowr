/**
 * Provides utility types and functions to provide difference information if two structures
 * are not equal. Maybe. Sometime, in the far future this will be as capable as the waldo package :dream:
 *
 * @module
 */

import { setMinus } from './set';
import type { MergeableRecord } from './objects';

/**
 * Unifies the shape of all difference reports.
 * They should have an array of comments on the potential differences/equality of
 * the structures and a function to check if they are really equal.
 */
export interface DifferenceReport {
	/**
     * A human-readable description of differences during the comparison
     * In combination with {@link isEqual} this can be used to provide detailed
     * explanation on equal structures as well (e.g., if structures _could_ be equal).
     */
	comments(): readonly string[] | undefined
	/**
     * @returns true iff the compared structures are equal (i.e., the diff is empty)
     */
	isEqual(): boolean
}

export interface WriteableDifferenceReport extends DifferenceReport {
	addComment(comment: string): void
}

/**
 * Identifies the information required by the core difference functions.
 * The `leftname` and `rightname` fields are only used to provide more useful
 * information in the difference report.
 */
export interface GenericDifferenceInformation<Report extends WriteableDifferenceReport> extends MergeableRecord {
	/** A human-readable name for the left structure in `left == right`. */
	readonly leftname:  string
	/** A human-readable name for the right structure in `left == right`. */
	readonly rightname: string
	/** The report on the difference of the two structures. */
	readonly report:    Report
	/** A human-readable indication of where we are (the prefix of the information if the structures differ) */
	readonly position:  string
	readonly config:    GenericDiffConfiguration
}


export interface GenericDiffConfiguration {
	/**
	 * The left graph may contain more vertices and or edges than the right graph.
	 * However, those which are the same (based on their ids) have to be equal
	 */
	readonly rightIsSubgraph?: boolean
	/**
	 * Similar to {@link rightIsSubgraph}, but for the left graph.
	 */
	readonly leftIsSubgraph?:  boolean
}


export function setDifference<T, Report extends WriteableDifferenceReport = WriteableDifferenceReport>(left: ReadonlySet<T>, right: ReadonlySet<T>, info: GenericDifferenceInformation<Report>): void {
	const lWithoutR = setMinus(left, right);
	const rWithoutL = setMinus(right, left);
	if(lWithoutR.size === 0 && rWithoutL.size === 0) {
		return;
	}
	let message: string = info.position;
	if(lWithoutR.size > 0 && !info.config.rightIsSubgraph) {
		message += ` More elements in ${info.leftname}: ${JSON.stringify([...lWithoutR])}`;
	}
	if(rWithoutL.size > 0 && !info.config.leftIsSubgraph) {
		message += lWithoutR.size > 0 ? ' and m' : 'M';
		message += `ore in ${info.rightname}: ${JSON.stringify([...rWithoutL])}`;
	}
	if(
		(rWithoutL.size > 0 && !info.config.leftIsSubgraph)
		|| (lWithoutR.size > 0 && !info.config.rightIsSubgraph)
	) {
		info.report.addComment(message);
	}
}
