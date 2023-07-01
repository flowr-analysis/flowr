/**
 * Sometimes we want to know all possible slicing criteria (obeying some filter).
 * This module provides a function to collect all slicing criteria.
 * @module
 */
import { MergeableRecord } from '../../util/objects'
import { RNodeWithParent, visit } from '../../r-bridge'
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


function collectAllPotentialIdsForSlicing<OtherInfo>(ast: RNodeWithParent<OtherInfo>, predicate: (n: RNodeWithParent) => boolean): RNodeWithParent<OtherInfo>[] {
  const potentialSlicingNodes: RNodeWithParent<OtherInfo>[] = []
  visit(ast, n => {
    if (predicate(n)) {
      potentialSlicingNodes.push(n)
    }
    return false
  })
  return potentialSlicingNodes
}

/**
 * Will create all possible slicing criteria for the given ast, based on the {@link SlicingCriteriaFilter}.
 * The slicing criteria will be *ordered* (i.e., it will not return `[1:2,3:4]` and `[3:4,1:2]` if `maximumSize` \> 1).
 */
export function collectAllSlicingCriteria<OtherInfo>(ast: RNodeWithParent<OtherInfo>, filter: SlicingCriteriaFilter): SlicingCriteria[] {
  const potentialSlicingNodes = collectAllPotentialIdsForSlicing(ast, filter.predicate)

  return []
}
