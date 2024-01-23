import { NodeId, NormalizedAst, RNodeWithParent, RType, RoleInParent } from '../../r-bridge'
import { guard } from '../../util/assert'
import { Identifier, IdentifierDefinition, REnvironmentInformation, resolveByName } from '../common/environments'
import { LocalScope } from '../common/environments/scopes'



/*
##Assumptions: 
##  -every Expression has .entry State which holds the entry State(executet always | maybe | never) of that expression(what we want)
##  -every Expression has .exit State that holds the State the expression will be left important for the next expression
##  -the return Expression can be tracked to something in the CallStack
##  -the Callstack looks like this for "if": ##also missing else blocks are substituted (e.g else {})
##   ->if
##     ->then
##       ->...
##     ->else
##       ->...
##called on Encountering an expression in the fold (going down the callstack)
expressionExecution(ExecState, #The Execution State: ALWAYS, MAYBE, NEVER
                    Env #Holds all Environments
                    Expr, #The Expression to evaluate
                    CallStack, #List
                    InflExpr, #List of Influencing Expressions)
  #save if the Expression will be reached and how it is innfluenced
  Expr.entry = (ExecState, InflExpr)
  
  #If Statement cannot be entred it is also impossible to
  if(ExecState == NEVER)
    Expr.exit = (ExecState, InflExpr)
    return
  
  #calculate R ExpressionType with checking against the Environment if said environment can be overriden
  expR = getExprType(Expr, Env)
  
  #Set the Standard
  switch(expR)
    Rliteral: Rif: Rloop: Rfunction: Rthen: Relse: 
      Expr.exit = (ALWAYS, List(empty))
    Rbreak: Rnext: Rreturn:
      #Following Expressions are not executed
      Expr.exit = (NEVER, List(Expr))

##Is Called when the Callstack is reduced
## e.g.1: ->if #nextLevel
##          ->else #lowerLevel
## e.g.2: ->foo #nextLevel
##          ->for #lowerLevel
expressionUpwardsCallStack(lowerLevel, nextLevel)#returns the exit executionStaet for the next expression to walk down to
  switch(lowerLevel)
    #for those instances it is enough to look at the entry and exitpoint
    Rliteral: Rif: Rreturn: Rbreak: Rnext:
      return unionEntryExit(nextLevel.entry, lowerLevel.exit) # unionEntry ExitExplained further down
    Rthen:
      return nextLevel.entry
    Relse: 
      #Get the information necessary for decision
      (thenBlockExec, thenBlockInflList) = nextLevel.then.exit
      (elseBlockExec, elseBlockInflList) = lowerLevel.exit
      
      #Variable for the exit State
      exitState = NULL

      #Both always active then continue always
      if(thenBlockExec == ALWAYS and elseBlockExec = ALWAYS)
        exitState = (ALWAYS, List(empty))
      
      #One of the blocks is maybe active
      if(thenBlockExecuted or elseBlockExecuted == MAYBE)
         exitState (MAYBE, Union(thenBlockinfList, elseBlockinfList) )
      
      #Both not executed till the end
      if(thenBlockExec == NEVER and elseBlockExec = NEVER)
        exitState =  (NEVER, Union(thenBlockInflList, elseBlockInflList))

      #Depending if the implicit Returns are in exitState they need to be removed from exitState.inflList
      #Not done here just a question for implimentation
      return unionEntryExit(nextLevel.entry, exitState)
    Rloop:
      #either always executed or only with next or break stopped then the execution is just like the entry
      #because no additional entrys are given 
      if(lowerLevel.exit.execState == ALWAYS or removeNextAndBreak(lowerLevel.exit.inflList) == List(empty))
        return nextLevel.Entry
      
      #if one of the possiblities to stop execution is a next or a break then the execution does MAYBE continue
      if(lowerLevel.exit.exitState == NEVER and amountNextOrBreak(lowerLevel.exit.inflList) > 0)
        return unionEntryAndExit(nextLevel.entry, (MAYBE, removeNextAndBreak(lowerLevel.exit.inflList)) 
      
      return unionEntryAndExit( nextLevel.entry, (lowerLevel.exit.execState,  removeNextAndBreak(lowerLevel.exit.inflList)) )
    Rfunction:
      #a function is the top level and is not skipped by either break, next or return
      return nextLevel.entry

#unions the entry execution State with the List of possible Escapes that happened
unionEntryExit( (entryExecState, entryList), (exitExecState, exitList) )
  #easy if both are always executed
  if( exitExecState == ALWAYS and exitExecState == ALWAYS)
    return (ALWAYS, List(empty))

  #if exitState in NEVER overall exit state is NEVER
  #not sure if List should be unioned or only the exitState should be used
  if(exitExecState == NEVER)
    return ( NEVER, exitList)
  
  #union if one is MAYBE
  if(entryExecState or exitExecState == MAYBE)
    return ( MAYBE, unionList(entryList,exitList) )

 */

export enum ExecutionState{
	Always,
	Maybe,
	Never
}

interface AlwaysExecutionTuple {
	readonly executed: ExecutionState.Always
}

interface MaybeExecutionTuple {
	readonly executed:               ExecutionState.Maybe
	readonly influencingExpressions: readonly NodeId[]
}

interface NeverExecutionTuple{
	readonly executed:               ExecutionState.Never
	readonly influencingExpressions: readonly NodeId[]
}

export type ExecutionTuple = AlwaysExecutionTuple | MaybeExecutionTuple | NeverExecutionTuple

interface CfgInfo {
	entry?: ExecutionTuple,
	exit?:  ExecutionTuple 
}


export function expressionExecution(previousExecutionState: ExecutionTuple, 
																																				currentExpression: NodeId, ast: NormalizedAst, 
																																				expressionIdentifier: Identifier, environmentUntilNow: REnvironmentInformation){
	//Set the State in which the Expression was found in
	const expressionNode: RNodeWithParent<CfgInfo>| undefined = ast.idMap.get(currentExpression)
  
	guard(expressionNode !== undefined, 'Node not found in ast')
  
	expressionNode.info.entry = previousExecutionState
	  
	if(previousExecutionState.executed === ExecutionState.Never){
		expressionNode.info.exit = {executed: ExecutionState.Never, influencingExpressions: [currentExpression]} satisfies ExecutionTuple
		return
	}

	const currentExpressionTypeList:undefined | IdentifierDefinition[] = resolveByName(expressionIdentifier, LocalScope, environmentUntilNow)//evaluateExpressionType(currentExpression, environmentUntilNow)

	if(currentExpressionTypeList === undefined){
		expressionNode.info.exit = previousExecutionState
		return
	}

	let amountOfAbortingExpressions = 0
	const listOfAbortingExpressions : NodeId[] = []

	for(const identifierDefinition of currentExpressionTypeList){
		if(identifierDefinition.kind === 'built-in-function' && identifierDefinition.name == 'next'){
			amountOfAbortingExpressions++
			listOfAbortingExpressions.push(identifierDefinition.nodeId)
		} else if(identifierDefinition.kind === 'built-in-function' && identifierDefinition.name === 'break'){
			amountOfAbortingExpressions++
			listOfAbortingExpressions.push(identifierDefinition.nodeId)
		} else if(identifierDefinition.kind === 'built-in-function' && identifierDefinition.name === 'return'){
			amountOfAbortingExpressions++
			listOfAbortingExpressions.push(identifierDefinition.nodeId)
		}
	}

	//if all expressions are aborting it is never exited if some are it is maybe exited and if no are aborting it is always executed
	const afterExpressionExecution = amountOfAbortingExpressions === 0 ? ExecutionState.Always : amountOfAbortingExpressions === currentExpressionTypeList.length ? ExecutionState.Never : ExecutionState.Maybe

	expressionNode.info.exit= {executed: afterExpressionExecution, influencingExpressions: listOfAbortingExpressions}
}

//TODO possibly remove
/*
enum ExpressionType{
	Literal,
	If,
	Loop,
	Function,
	Then,
	Else,
	Return,
	Break,
	Next
}
*/

export function onCallStackReduction(lowerLevel: NodeId, upperLevel: NodeId, ast: NormalizedAst):ExecutionTuple{
/*
  expressionUpwardsCallStack(lowerLevel, nextLevel)#returns the exit executionStaet for the next expression to walk down to
  switch(lowerLevel)
    #for those instances it is enough to look at the entry and exitpoint
    Rliteral: Rif: Rreturn: Rbreak: Rnext:
      return unionEntryExit(nextLevel.entry, lowerLevel.exit) # unionEntry ExitExplained further down
    Rthen:
      return nextLevel.entry
    Relse:
      #Get the information necessary for decision
      (thenBlockExec, thenBlockInflList) = nextLevel.then.exit
      (elseBlockExec, elseBlockInflList) = lowerLevel.exit
      
      #Variable for the exit State
      exitState = NULL

      #Both always active then continue always
      if(thenBlockExec == ALWAYS and elseBlockExec = ALWAYS)
        exitState = (ALWAYS, List(empty))
      
      #One of the blocks is maybe active
      if(thenBlockExecuted or elseBlockExecuted == MAYBE)
         exitState (MAYBE, Union(thenBlockinfList, elseBlockinfList) )
      
      #Both not executed till the end
      if(thenBlockExec == NEVER and elseBlockExec = NEVER)
        exitState =  (NEVER, Union(thenBlockInflList, elseBlockInflList))

      #Depending if the implicit Returns are in exitState they need to be removed from exitState.inflList
      #Not done here just a question for implimentation
      return unionEntryExit(nextLevel.entry, exitState)
    Rloop:
      #either always executed or only with next or break stopped then the execution is just like the entry
      #because no additional entrys are given 
      if(lowerLevel.exit.execState == ALWAYS or removeNextAndBreak(lowerLevel.exit.inflList) == List(empty))
        return nextLevel.Entry
      
      #if one of the possiblities to stop execution is a next or a break then the execution does MAYBE continue
      if(lowerLevel.exit.exitState == NEVER and amountNextOrBreak(lowerLevel.exit.inflList) > 0)
        return unionEntryAndExit(nextLevel.entry, (MAYBE, removeNextAndBreak(lowerLevel.exit.inflList)) 
      
      return unionEntryAndExit( nextLevel.entry, (lowerLevel.exit.execState,  removeNextAndBreak(lowerLevel.exit.inflList)) )
    Rfunction:
      #a function is the top level and is not skipped by either break, next or return
      return nextLevel.entry
*/
	const lowerLevelNode: RNodeWithParent<CfgInfo> | undefined  = ast.idMap.get(lowerLevel)
	guard(lowerLevelNode !== undefined, 'Node not found in ast')
	const upperLevelNode: RNodeWithParent<CfgInfo> | undefined = ast.idMap.get(upperLevel)
	guard(upperLevelNode !== undefined, 'Node not found in ast')


	let toReturn: ExecutionTuple = {executed: ExecutionState.Always} //TODO Remove 

   
	const role = lowerLevelNode.info.role
	switch(role){
		case RoleInParent.IfThen:
			const ifThenParent = upperLevelNode
			guard(ifThenParent.type === RType.IfThenElse, 'Parent of IfThen was not IfThenElse')
			guard(lowerLevelNode.info.exit !== undefined, 'Exit not defined at point it should be')
			guard(upperLevelNode.info.entry !== undefined, 'Entry should be set at this point')


			const ifThenCondition = ifThenParent.condition
			guard(ifThenCondition.info.exit !== undefined, 'Exit not defined where it should be')
      
      
			if(ifThenParent.otherwise !== undefined){
				let exitAfterConditionAndThen : ExecutionTuple
				if(ifThenCondition.info.exit.executed == ExecutionState.Always && lowerLevelNode.info.exit.executed === ExecutionState.Always){
					exitAfterConditionAndThen = {executed: ExecutionState.Always}
				} else if(ifThenCondition.info.exit.executed == ExecutionState.Never && lowerLevelNode.info.exit.executed === ExecutionState.Never) {
					exitAfterConditionAndThen = ifThenCondition.info.exit
				} else {
					const ifConditionInfluencingList = ifThenCondition.info.exit.executed === ExecutionState.Always ? [] : ifThenCondition.info.exit.influencingExpressions
					const ifThenInfluencingList = lowerLevelNode.info.exit.executed === ExecutionState.Always ? [] : lowerLevelNode.info.exit.influencingExpressions
          
					//remove doubles in List
					const exitList = unionLists(ifConditionInfluencingList, ifThenInfluencingList)
					exitAfterConditionAndThen = {executed: ExecutionState.Maybe, influencingExpressions: exitList}
				}
        
				toReturn = unionEntryAndExit(upperLevelNode.info.entry, exitAfterConditionAndThen)
			} else {
				//return exit to set entry of otherwise correctly
				toReturn = unionEntryAndExit(upperLevelNode.info.entry, ifThenCondition.info.exit)
			}
			break
		case RoleInParent.IfOtherwise:      
			const ifThenElseParent = upperLevelNode
			guard(ifThenElseParent.type === RType.IfThenElse, 'Parent of IfOtherwise was not IfThenElse')
      
			guard(lowerLevelNode.info.exit !== undefined, 'Exit not defined at point it should be')
			guard(upperLevelNode.info.entry !== undefined, 'Entry should be set at this point')

			const ifThenElseCondition = ifThenElseParent.condition
			guard(ifThenElseCondition.info.exit !== undefined, 'Exit not defined where it should be')

			const ifThenExit = ifThenElseParent.then.info.exit
			guard(ifThenExit !== undefined, 'Exit not defined at point it should be')
			const ifElseExit = lowerLevelNode.info.exit
      
			let thenElseExit : ExecutionTuple
			if(ifThenExit.executed === ExecutionState.Always && ifElseExit.executed === ExecutionState.Always){
				thenElseExit = {executed: ExecutionState.Always}
			} else if( ifThenExit.executed === ExecutionState.Never && ifElseExit.executed === ExecutionState.Never){
				const neverExecutedInfluencingList = unionLists(ifThenExit.influencingExpressions, ifElseExit.influencingExpressions)
				thenElseExit = {executed: ExecutionState.Never, influencingExpressions: neverExecutedInfluencingList}
			} else {
				const thenExitInfluencingList = ifThenExit.executed === ExecutionState.Always ? [] : ifThenExit.influencingExpressions
				const elseExitInfluencingList = ifElseExit.executed === ExecutionState.Always ? [] : ifElseExit.influencingExpressions
				const maybeExecutedInfluencingList = unionLists(thenExitInfluencingList, elseExitInfluencingList)
				thenElseExit = {executed: ExecutionState.Maybe, influencingExpressions: maybeExecutedInfluencingList}
			}
			toReturn = unionEntryAndExit(upperLevelNode.info.entry, thenElseExit)
		  break
		case RoleInParent.Root:
		case RoleInParent.IfCondition:
		case RoleInParent.WhileCondition:
		case RoleInParent.WhileBody:
		case RoleInParent.RepeatBody:
		case RoleInParent.ForVariable:
		case RoleInParent.ForVector:
		case RoleInParent.ForBody:
		case RoleInParent.FunctionCallName:
		case RoleInParent.FunctionCallArgument:
		case RoleInParent.FunctionDefinitionBody:
		case RoleInParent.FunctionDefinitionParameter:
		case RoleInParent.ExpressionListChild:
		case RoleInParent.BinaryOperationLhs:
		case RoleInParent.BinaryOperationRhs:
		case RoleInParent.PipeLhs:
		case RoleInParent.PipeRhs:
		case RoleInParent.UnaryOperand:
		case RoleInParent.ParameterName:
		case RoleInParent.ParameterDefaultValue:
		case RoleInParent.ArgumentName:
		case RoleInParent.ArgumentValue:
		case RoleInParent.Accessed:
		case RoleInParent.IndexAccess:
		default:
      //TODO find out why this doesnt work 
      //assertUnreachable(role)
	}
   
   
	upperLevelNode.info.exit = toReturn
	lowerLevelNode.info.exit = toReturn
	return toReturn
}




/*

#unions the entry execution State with the List of possible Escapes that happened
unionEntryExit( (entryExecState, entryList), (exitExecState, exitList) )
  #easy if both are always executed
  if( exitExecState == ALWAYS and exitExecState == ALWAYS)
    return (ALWAYS, List(empty))

  #if exitState in NEVER overall exit state is NEVER
  #not sure if List should be unioned or only the exitState should be used
  if(exitExecState == NEVER)
    return ( NEVER, exitList)
  
  #union if one is MAYBE
  if(entryExecState or exitExecState == MAYBE)
    return ( MAYBE, unionList(entryList,exitList) )

 */
function unionEntryAndExit(entry: ExecutionTuple, exit: ExecutionTuple):ExecutionTuple{
	if(entry.executed === ExecutionState.Always && exit.executed === ExecutionState.Always){
		return entry
	}

	if(entry.executed === ExecutionState.Always && (exit.executed === ExecutionState.Never || exit.executed === ExecutionState.Maybe)){
		return exit
	}

	if((entry.executed === ExecutionState.Never || entry.executed == ExecutionState.Maybe) && exit.executed === ExecutionState.Always){
		return entry
	}

	if((entry.executed === ExecutionState.Never || entry.executed == ExecutionState.Maybe) && (exit.executed === ExecutionState.Never || exit.executed === ExecutionState.Maybe)){
		const newExecuted = entry.executed === ExecutionState.Never && exit.executed === ExecutionState.Never ? ExecutionState.Never : ExecutionState.Maybe

		//union lists (removing duplicates)
		const newInfluencingExpressionList = unionLists(entry.influencingExpressions, exit.influencingExpressions)
		//entry.influencingExpressions.concat(exit.influencingExpressions.filter(nodeId => !entry.influencingExpressions.includes(nodeId)))
		return {executed: newExecuted, influencingExpressions: newInfluencingExpressionList }
	}

	guard(true, 'Unreachable case in control flow analysis')
	return {executed: ExecutionState.Always}
}



function unionLists<T>(firstList:readonly T[],secondList:readonly T[]):T[]{
	return firstList.concat(secondList.filter(elem => !firstList.includes(elem)))
}
//TODO how to know if if-then-else has no else block