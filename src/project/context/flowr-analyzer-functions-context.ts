import { AbstractFlowrAnalyzerContext } from './abstract-flowr-analyzer-context';
import type { FlowrAnalyzerContext } from './flowr-analyzer-context';
import {
	FlowrAnalyzerPackageVersionsPlugin
} from '../plugins/package-version-plugins/flowr-analyzer-package-versions-plugin';
import {
	namespaceFileLog
} from '../plugins/package-version-plugins/flowr-analyzer-package-versions-namespace-file-plugin';

export enum FunctionTypes {
	Function = 'function',
	ExportTypes = 'exportTypes',
	S3 = 'S3'
}

export interface FunctionInfo {
	name:            string;
	packageOrigin:   string;
	isExported:      boolean;
	isS3Generic:     boolean;
	s3TypeDispatch?: string;
	inferredType?:   string;
}

/**
 * This is a read-only interface to the {@link FlowrAnalyzerFunctionsContext}.
 * It prevents you from modifying the functions, but allows you to inspect them (which is probably what you want when using the {@link FlowrAnalyzer}).
 * If you are a {@link FlowrAnalyzerPackageVersionsPlugin} and want to modify the functions, you can use the {@link FlowrAnalyzerFunctionsContext} directly.
 */
export interface ReadOnlyFlowrAnalyzerFunctionsContext {
	readonly name: string;

	/**
	 * Get the function information for the given function name and optional class name.
	 * @param name - The name of the function to get information for.
	 * @param className - The optional class name (e.g., for S3 generics).
	 */
	getFunctionInfo(name: string, className?: string): FunctionInfo | FunctionInfo[] | undefined;
}

/**
 * This context is responsible for managing the functions identified in the project, including their origins, types, and other metadata.
 * It works in conjunction with {@link FlowrAnalyzerPackageVersionsPlugin}s to gather and maintain this information.
 *
 * If you are interested in inspecting these functions, refer to {@link ReadOnlyFlowrAnalyzerFunctionsContext}.
 */
export class FlowrAnalyzerFunctionsContext extends AbstractFlowrAnalyzerContext<undefined, void, FlowrAnalyzerPackageVersionsPlugin> implements ReadOnlyFlowrAnalyzerFunctionsContext {
	public readonly name = 'flowr-analyzer-functions-context';

	private functionInfo: Map<string, FunctionInfo[]> = new Map<string, FunctionInfo[]>();

	public constructor(ctx: FlowrAnalyzerContext, plugins?: readonly FlowrAnalyzerPackageVersionsPlugin[]) {
		super(ctx, FlowrAnalyzerPackageVersionsPlugin.defaultPlugin(), plugins);
	}

	public addFunctionInfo(info: FunctionInfo): void {
		const list = this.functionInfo.get(info.name);

		if(!list) {
			this.functionInfo.set(info.name, [info]);
			return;
		}

		const other = list.find(e =>
			e.name === info.name &&
			e.packageOrigin === info.packageOrigin &&
			e.s3TypeDispatch === info.s3TypeDispatch
		);

		if(other) {
			namespaceFileLog.warn('Namespace information is being merged!');
			this.mergeFunctionInfo(other, info);
		} else {
			list.push(info);
		}
	}

	private mergeFunctionInfo(functionInfo: FunctionInfo, other: FunctionInfo): void {
		if(functionInfo.name !== other.name || functionInfo.packageOrigin !== other.packageOrigin) {
			throw new Error(`Cannot merge FunctionInfo for ${functionInfo.name} and ${other.name}`);
		}

		if(functionInfo.s3TypeDispatch !== other.s3TypeDispatch) {
			throw new Error(`Cannot merge FunctionInfo with different S3 dispatch for ${functionInfo.name}`);
		}

		if(!functionInfo.inferredType && other.inferredType) {
			functionInfo.inferredType = other.inferredType;
		}

		functionInfo.isExported ||= other.isExported;
		functionInfo.isS3Generic ||= other.isS3Generic;
	}

	public getFunctionInfo(pkg: string, name: string, s3TypeDispatch?: string): FunctionInfo | FunctionInfo[] | undefined {
		if(s3TypeDispatch) {
			return this.functionInfo.get(`${name}`)?.find(e => e.packageOrigin === pkg && e.s3TypeDispatch === s3TypeDispatch);
		} else if(name.includes('.')){
			const parts = name.split('.');
			s3TypeDispatch = parts.pop();
			const splitName = parts.join('.');
			if(this.functionInfo.has(splitName)) {
				return this.functionInfo.get(splitName)?.find(e => e.packageOrigin === pkg && e.s3TypeDispatch === s3TypeDispatch);
			}
		}
		return this.functionInfo.get(name)?.filter(e => e.packageOrigin === pkg);
	}

	public reset(): void {
		this.functionInfo = new Map<string, FunctionInfo[]>();
	}
}