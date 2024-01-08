import { Expression } from 'xpath-ts2'
import { Environment } from '../v1'

export enum ExecutionState{
	Always,
	Maybe,
	Never
}


export interface IExecutionTuple {
	readonly executed:               ExecutionState,
	readonly influencingExpressions: Expression[] //TODO: correct?
}

export class ExecutionTuple implements IExecutionTuple{
	readonly executed:               ExecutionState
	readonly influencingExpressions: Expression[]
	constructor(executed:ExecutionState, influencingExpressions: Expression[]){
		this.executed = executed
		this.influencingExpressions = influencingExpressions
	}
}

export function expressionExecution(previousExecutionState: ExecutionState, environmentUntilNow: Environment, currentExpression: Expression, _callStack: Expression[], _influencingExpressions: Expression[]){
	//Set the State in which the Expression was found in
	//Expression.entry = previousExecutionState
	//TODO: how to save? efficient way unknown
    
	if(previousExecutionState == ExecutionState.Never){
		//Expression.exit = new ExecutionTuple(previousExecutionState, influencingExpressions);
		return
	}

	const currentExpressionType = evaluateExpressionType(currentExpression, environmentUntilNow)

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
}

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


function evaluateExpressionType(_toEvaluateExpression: Expression, _currentEnvironment: Environment):ExpressionType {
	//TODO: actually implement that 
	return ExpressionType.Function //TODO: comment out
}

export function onCallStackReduction(_lowerLevel: ExpressionType, _upperLevel: ExpressionType):ExecutionTuple{
   
   
   
   
   
   
   
   
   
   
	return new ExecutionTuple(ExecutionState.Never, []) //TODO comment out
}

