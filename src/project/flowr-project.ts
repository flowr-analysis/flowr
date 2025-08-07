import type { FlowrAnalyzer } from './flowr-analyzer';
import type { FlowrAnalyzerBuilder } from './flowr-analyzer-builder';
import type { FlowrAnalyzerPlugin } from './plugins/flowr-analyzer-plugin';
import type { PathLike } from 'fs';
import path from 'path';
import type { Package } from './plugins/package-version-plugins/package';
import { FlowrAnalyzerDescriptionFilePlugin } from './plugins/file-plugins/flowr-analyzer-description-file-plugin';
import {
	FlowrAnalyzerPackageVersionsDescriptionFilePlugin
} from './plugins/package-version-plugins/flowr-analyzer-package-versions-description-file-plugin';
import type { FlowrConfigOptions } from '../config';

export interface FlowrProject {
	analyzer:    FlowrAnalyzer;
	builder:     FlowrAnalyzerBuilder;
	plugins:     FlowrAnalyzerPlugin[];
	libraries:   Package[];
	projectRoot: PathLike;
}

export async function getDummyFlowrProject(){
	const exampleFlowrProject : FlowrProject = {
		analyzer:    {} as FlowrAnalyzer,
		builder:     {} as   FlowrAnalyzerBuilder,
		plugins:     [],
		projectRoot: path.resolve('test/testfiles/project/'),
		libraries:   []
	};

	const descriptionFilePlugin = new FlowrAnalyzerDescriptionFilePlugin();
	descriptionFilePlugin.addFiles(path.resolve('test/testfiles/project/DESCRIPTION'));

	const flowrAnalyzerPackageVersionsDescriptionFilePlugin = new FlowrAnalyzerPackageVersionsDescriptionFilePlugin();
	flowrAnalyzerPackageVersionsDescriptionFilePlugin.dependencies = [descriptionFilePlugin];

	await flowrAnalyzerPackageVersionsDescriptionFilePlugin
		.processor({} as FlowrAnalyzer, {} as FlowrConfigOptions);

	exampleFlowrProject.libraries = flowrAnalyzerPackageVersionsDescriptionFilePlugin.packages;

	return exampleFlowrProject;
}