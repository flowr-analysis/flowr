import { sig, Forced } from './signatures';
import { fn, pkg, Primitive, readsFile, writesFile } from './define';
import { PkgName } from '../identifier';
import { BuiltInProcName } from '../built-in-proc-name';
import { ArgProp, CallProp, SemanticCallTag } from '../built-in-props';
import { LinkToLastPlot, OpenDevice } from './shared';
import type { AnyBuiltInDefinition } from '../built-in-config';

/** The built-in definitions of images, audio, and video. */
export const MediaDefinitions = [
	fn(pkg(PkgName.Magick, 'image_graph', 'image_draw'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Configures, ambient: OpenDevice, tags: [SemanticCallTag.Graphics] }, Primitive
	),
	fn(pkg(PkgName.Magick, 'image_read', 'image_read_svg', 'image_read_pdf', 'image_read_video'), BuiltInProcName.DefaultReadAllArgs,
		readsFile('path')
	),
	fn(pkg(PkgName.Jpeg, 'readJPEG'), BuiltInProcName.DefaultReadAllArgs, readsFile('source')),
	fn(pkg(PkgName.Png, 'readPNG'), BuiltInProcName.DefaultReadAllArgs, readsFile('source')),
	fn(pkg(PkgName.Tiff, 'readTIFF'), BuiltInProcName.DefaultReadAllArgs, readsFile('source')),
	fn(pkg(PkgName.Imager, 'load.image', 'load.video'), BuiltInProcName.DefaultReadAllArgs, readsFile('file')),
	fn(pkg(PkgName.Imager, 'load.dir'), BuiltInProcName.DefaultReadAllArgs, readsFile('path')),
	fn(pkg(PkgName.OpenImageR, 'readImage'), BuiltInProcName.DefaultReadAllArgs, readsFile('path')),
	fn(pkg(PkgName.EbImage, 'readImage'), BuiltInProcName.DefaultReadAllArgs, readsFile('files')),
	fn(pkg(PkgName.Av, 'av_video_images'), BuiltInProcName.DefaultReadAllArgs, readsFile('video')),
	fn(pkg(PkgName.Av, 'read_audio_bin', 'read_audio_fft'), BuiltInProcName.DefaultReadAllArgs, readsFile('audio')),
	fn(pkg(PkgName.TuneR, 'readWave'), BuiltInProcName.DefaultReadAllArgs, readsFile('filename')),
	fn(pkg(PkgName.TuneR, 'readMP3', 'readMidi'), BuiltInProcName.DefaultReadAllArgs, readsFile('file')),
	fn(pkg(PkgName.Seewave, 'read.audacity'), BuiltInProcName.DefaultReadAllArgs, readsFile('file')),
	fn(pkg(PkgName.Audio, 'load.wave'), BuiltInProcName.DefaultReadAllArgs,
		{
			props: CallProp.Invisible,
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Reads],
			sig:   sig({ where: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Tiff, 'writeTIFF'), BuiltInProcName.DefaultReadAllArgs,
		{
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ what: Forced.Value, where: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Imager, 'make.video'), BuiltInProcName.DefaultReadAllArgs,
		{
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ dname: Forced.Value, file: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.OpenImageR, 'writeImage'), BuiltInProcName.DefaultReadAllArgs,
		{
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ data: Forced.Value, file_name: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.EbImage, 'writeImage'), BuiltInProcName.DefaultReadAllArgs,
		{
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ x: Forced.Value, files: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Gifski, 'gifski'), BuiltInProcName.DefaultReadAllArgs,
		{
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ png_files: Forced.Value, gif_file: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Gifski, 'save_gif'), BuiltInProcName.DefaultReadAllArgs,
		{
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ expr: Forced.Value, gif_file: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Av, 'av_encode_video'), BuiltInProcName.DefaultReadAllArgs,
		{
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ input: Forced.Value, output: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Av, 'av_audio_convert'), BuiltInProcName.DefaultReadAllArgs,
		{
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ audio: Forced.Value, output: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Av, 'av_capture_graphics'), BuiltInProcName.DefaultReadAllArgs,
		{
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ expr: Forced.Value, output: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.TuneR, 'writeWave'), BuiltInProcName.DefaultReadAllArgs, writesFile('filename', 'object')),
	fn(pkg(PkgName.Audio, 'save.wave'), BuiltInProcName.DefaultReadAllArgs, writesFile('where', 'what')),
	fn([...pkg(PkgName.Magick, 'image_capture'), ...pkg(PkgName.GrDevices, 'dev.capture')], BuiltInProcName.Default,
		{ libFn: true, hasUnknownSideEffects: LinkToLastPlot, tags: [SemanticCallTag.Graphics], sig: sig({ '...': ArgProp.Forced }) }, Primitive
	),
	/* they put what the device holds on disk */
	fn(pkg(PkgName.Magick, 'image_write'), BuiltInProcName.Default,
		{
			libFn:                 true,
			props:                 CallProp.Invisible,
			hasUnknownSideEffects: LinkToLastPlot,
			tags:                  [SemanticCallTag.Graphics, SemanticCallTag.File, SemanticCallTag.Writes],
			sig:                   sig({ image: Forced.Value, path: Forced.Resource | ArgProp.Optional })
		},
		Primitive
	),
] as const satisfies AnyBuiltInDefinition[];
