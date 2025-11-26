import { AbstractFlowrAnalyzerContext } from './abstract-flowr-analyzer-context';
import type { FlowrAnalyzerContext } from './flowr-analyzer-context';
import {
	FlowrAnalyzerPackageVersionsPlugin
} from '../plugins/package-version-plugins/flowr-analyzer-package-versions-plugin';

export enum FunctionTypes {
	Function = 'function',
	Symbol = 'symbol',
	S3 = 'S3'
}

export interface FunctionInfo {
	name:          string;
	packageOrigin: string;
	isExported:    boolean;
	isS3Generic:   boolean;
	className?:    string;
	inferredType?: string;
}

export interface ReadOnlyFlowrAnalyzerFunctionsContext {
	readonly name: string;

	getFunctionInfo(name: string, className?: string): FunctionInfo | undefined;
}

export class FlowrAnalyzerFunctionsContext extends AbstractFlowrAnalyzerContext<undefined, void, FlowrAnalyzerPackageVersionsPlugin> implements ReadOnlyFlowrAnalyzerFunctionsContext {
	public readonly name = 'flowr-analyzer-functions-context';

	private functionInfo: Map<string, FunctionInfo> = new Map<string, FunctionInfo>();

	public constructor(ctx: FlowrAnalyzerContext, plugins?: readonly FlowrAnalyzerPackageVersionsPlugin[]) {
		super(ctx, FlowrAnalyzerPackageVersionsPlugin.defaultPlugin(), plugins);
	}

	public addFunctionInfo(functionInfo: FunctionInfo) {
		const fi = this.functionInfo.get(functionInfo.name);
		if(fi) {
			// merge?
		} else {
			this.functionInfo.set(functionInfo.name, functionInfo);
		}
	}

	public getFunctionInfo(name: string, className?: string): FunctionInfo | undefined {
		if(className) {
			return this.functionInfo.get(`${name}.${className}`);
		} else if(name.includes('.')){
			const parts = name.split('.');
			const splitClassName = parts.pop();
			const splitName = parts.join('.');
			if(this.functionInfo.has(splitName)) {
				const value = this.functionInfo.get(splitName);
				return value?.className === splitClassName ? value : undefined;
			}
		}
		return this.functionInfo.get(name);
	}

	public reset(): void {
		this.functionInfo = new Map<string, FunctionInfo>();
	}
}