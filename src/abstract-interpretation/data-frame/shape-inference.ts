import type { NodeId } from '../../r-bridge/lang-4.x/ast/model/processing/node-id';
import type { AbsintAnalysis, DomainSemantics } from '../absint-inference';
import { DataFrameDomain } from './dataframe-domain';
import { DataFrameShapeSemantics } from './dataframe-semantics';
import type { ConstraintType, DataFrameOperationArgs, DataFrameOperationName, DataFrameOperationOptions } from './semantics';

interface Operation<Name extends DataFrameOperationName> {
	/** The type of the abstract data frame operation (see {@link DataFrameOperationName}) */
	operation: Name;
	/** The ID of the data frame operand of the operation (may be `undefined`) */
	operand:   NodeId | undefined;
	/** The optional constraint type to overwrite the default type of the operation (see {@link ConstraintType}) */
	type?:     ConstraintType;
	/** The optional additional options for the abstract operation (see {@link DataFrameOperationOptions}) */
	options?:  DataFrameOperationOptions<Name>;
}

/**
 * An abstract data frame operation.
 */
export type DataFrameOperation<OperationName extends DataFrameOperationName = DataFrameOperationName> = {
	[Name in OperationName]: Operation<Name> & DataFrameOperationArgs<Name>;
}[OperationName];

/**
 * An abstract data frame operation without additional options.
 */
export type DataFrameOperationType<OperationName extends DataFrameOperationName = DataFrameOperationName> = {
	[Name in OperationName]: Omit<Operation<Name>, 'type' | 'options'> & DataFrameOperationArgs<Name>;
}[OperationName];

/**
 * A possible `undefined` array of abstract data frame operations (see {@link DataFrameOperation}).
 */
export type DataFrameOperations<OperationName extends DataFrameOperationName = DataFrameOperationName> = DataFrameOperation<OperationName>[] | undefined;

/**
 * The abstract domains inferred by the data frame shape analysis (see {@link DataFrameShapeAnalysis}).
 */
export type DataFrameShapeDomains = {
	/** The inferred shape of data frames */
	readonly dataFrame: DataFrameDomain;
};

/**
 * The options of the data frame shape analysis (see {@link DataFrameShapeAnalysis}).
 */
export interface DataFrameShapeAnalysisOptions {
	/** Whether the abstract data frame operations the expressions are mapped to should be stored (defaults to `true`) */
	readonly trackOperations?: boolean;
	/** The maximum number of column names to track in the data frame domain (defaults to the maximum of the domain) */
	readonly maxColNames?:     number;
}

/**
 * The abstract interpretation analysis to infer the shape of data frames,
 * i.e. their column names, number of columns, and number of rows (see {@link DataFrameDomain}).
 */
export class DataFrameShapeAnalysis implements AbsintAnalysis<DataFrameShapeDomains> {
	public readonly domains: DataFrameShapeDomains;

	/** The abstract semantics of the analysis, which also provide the abstract data frame operations the expressions are mapped to */
	public readonly semantics: DomainSemantics<DataFrameShapeDomains> & { readonly dataFrame: DataFrameShapeSemantics };

	/**
	 * Creates the data frame shape analysis.
	 * @param options - The options of the analysis, i.e. whether the mapped abstract operations should be stored and the maximum number of tracked column names
	 */
	constructor({ trackOperations, maxColNames }: DataFrameShapeAnalysisOptions = {}) {
		this.domains = { dataFrame: DataFrameDomain.top(maxColNames) };
		this.semantics = { dataFrame: new DataFrameShapeSemantics({ trackOperations }) };
	}
}
