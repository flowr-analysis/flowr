import type { Package } from './package';
import { FlowrAnalyzerPlugin } from '../flowr-analyzer-plugin';

export abstract class FlowrAnalyzerPackageVersionsPlugin extends FlowrAnalyzerPlugin {
	readonly type = 'package-versions';
	public packages: Package[] = [];
}