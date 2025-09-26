import { FlowrAnalyzerPlugin, PluginType } from '../flowr-analyzer-plugin';
import type { RParseRequest } from '../../../r-bridge/retriever';
import type { RProjectAnalysisRequest } from '../../context/flowr-analyzer-files-context';
import { SemVer } from 'semver';
import type { FlowrFile } from '../../context/flowr-file';
import { FlowrTextFile } from '../../context/flowr-file';
import { getAllFilesSync } from '../../../util/files';

export abstract class FlowrAnalyzerProjectDiscoveryPlugin extends FlowrAnalyzerPlugin<RProjectAnalysisRequest, (RParseRequest | FlowrFile<string>)[]> {
	public readonly type = PluginType.ProjectDiscovery;

	public static override defaultPlugin(): FlowrAnalyzerProjectDiscoveryPlugin {
		return new DefaultFlowrAnalyzerProjectDiscoveryPlugin();
	}
}

class DefaultFlowrAnalyzerProjectDiscoveryPlugin extends FlowrAnalyzerProjectDiscoveryPlugin {
	public readonly name = 'default-project-discovery-plugin';
	public readonly description = 'This is the default project discovery plugin that does nothing.';
	public readonly version = new SemVer('0.0.0');

	public process(_context: unknown, args: RProjectAnalysisRequest): (RParseRequest | FlowrFile<string>)[] {
		const requests: (RParseRequest | FlowrFile<string>)[] = [];
		/* the dummy approach of collecting all files, group R and Rmd files, and be done with it */
		for(const file of getAllFilesSync(args.content)) {
			if(file.endsWith('.R') || file.endsWith('.r') || file.endsWith('.Rmd') || file.endsWith('.rmd')) {
				requests.push({ content: file, request: 'file' });
			} else {
				requests.push(new FlowrTextFile(file));
			}
		}
		return requests;
	}
}