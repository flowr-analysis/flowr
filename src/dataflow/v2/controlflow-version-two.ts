import { NodeId } from '../../r-bridge'
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


export function expressionExecution(previousExecutionState: ExecutionTuple, _currentExpression: NodeId, expressionIdentifier: Identifier, environmentUntilNow: REnvironmentInformation, _callStack: NodeId[]){
	//Set the State in which the Expression was found in
	//Expression.entry = previousExecutionState
	//TODO: how to save? efficient way unknown
    
	if(previousExecutionState.executed === ExecutionState.Never){
		//Expression.exit = new ExecutionTuple(previousExecutionState, influencingExpressions)
		return
	}
	const currentExpressionType:undefined | IdentifierDefinition[] = resolveByName(expressionIdentifier, LocalScope, environmentUntilNow)//evaluateExpressionType(currentExpression, environmentUntilNow)

	if(currentExpressionType === undefined){
		//Expression.exit = previousExecutionState
		return
	}

	let amountOfAbortingExpressions = 0
	const listOfAbortingExpressions : NodeId[] = []

  
	for(const identifierDefinition of currentExpressionType){
		//TODO refactor this
		if(identifierDefinition.kind === 'built-in-function' && identifierDefinition.name == 'next'){
			amountOfAbortingExpressions++
			listOfAbortingExpressions.push(identifierDefinition.nodeId)
		} else if(identifierDefinition.kind === 'built-in-function' && identifierDefinition.name == 'break'){
			amountOfAbortingExpressions++
			listOfAbortingExpressions.push(identifierDefinition.nodeId)
		} else if(identifierDefinition.kind === 'built-in-function' && identifierDefinition.name == 'return'){
			amountOfAbortingExpressions++
			listOfAbortingExpressions.push(identifierDefinition.nodeId)
		}
	}

	//if all statements are not aborting it is always executed if not 
	const _afterExpressionExecution = amountOfAbortingExpressions === 0 ? ExecutionState.Always : amountOfAbortingExpressions === currentExpressionType.length ? ExecutionState.Never : ExecutionState.Maybe


	/*
  switch(currentExpressionType){
		case ExpressionType.Literal:
		case ExpressionType.If:
		case ExpressionType.Loop:
		case ExpressionType.Function:
		case ExpressionType.Then:
		case ExpressionType.Else:
			//TODO how to save
			//Expr.exit = (ALWAYS, List(empty))
			break
		case ExpressionType.Break:
		case ExpressionType.Next:
		case ExpressionType.Return:
			//TODO how to save    
			//Expr.exit = (NEVER, List(Expr))
			break
	}
	*/
}

//TODO possibly remove
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


export function onCallStackReduction(_lowerLevel: ExpressionType, _upperLevel: ExpressionType):ExecutionTuple{
   
   
   
   
   
   
   
   
   
   
	return <ExecutionTuple>({ executed: ExecutionState.Always}) //TODO comment out
}

//how to save
//to to find out if we are looking at then or else block in if-then-else