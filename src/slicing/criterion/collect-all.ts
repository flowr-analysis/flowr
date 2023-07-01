/**
 * Sometimes we want to know all possible slicing criteria (obeying some filter).
 * This module provides a function to collect all slicing criteria.
 * @module
 */
import { MergeableRecord } from '../../util/objects'
import { RNodeWithParent } from '../../r-bridge'
import { SlicingCriteria } from './parse'


/**
 * Defines the filter for collecting all possible slicing criteria.
 */
export interface SlicingCriteriaFilter extends MergeableRecord {
  /**
   * Inclusive minimum size of the slicing criteria (number of included slice points).
   * Should be at least `1` to make sense (and of course at most {@link SlicingCriteriaFilter#maximumSize | maximum size}).
   */
  minimumSize: number
  /**
   * Inclusive maximum size of the slicing criteria (number of included slice points).
   * Should be at least `1` to make sense (and of course at least {@link SlicingCriteriaFilter#minimumSize | minimum size}).
   * <p>
   * Be really careful with this one, as the number of possible slicing criteria can grow exponentially with the maximum size.
   */
  maximumSize: number
  /**
   * Predicate that defines if a given node is a valid slice point.
   * While we allow (theoretically) to slice at *every* node with a given {@link SingleSlicingCriterion},
   * conventional slicing criteria are only interested in "variables".
   */
  predicate:   (n: RNodeWithParent) => boolean
}


export function collectAllSlicingCriteria<OtherInfo>(ast: RNodeWithParent<OtherInfo>, filter: SlicingCriteriaFilter): SlicingCriteria[] {

  return []
}
