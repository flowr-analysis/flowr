import { FlowrAnalyzerPlugin, PluginType } from '../flowr-analyzer-plugin';
import type { RParseRequest } from '../../../r-bridge/retriever';
import type { RProjectAnalysisRequest } from '../../context/flowr-analyzer-files-context';

// TODO: also identify descipriotn files etc and project type!
export abstract class FlowrAnalyzerProjectDiscoveryPlugin extends FlowrAnalyzerPlugin<RProjectAnalysisRequest, RParseRequest[]> {
	public readonly type = PluginType.ProjectDiscovery;
}