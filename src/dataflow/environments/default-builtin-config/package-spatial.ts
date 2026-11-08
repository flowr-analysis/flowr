import { sig, Forced } from './signatures';
import { fn, pkg, readsFile, writesFile } from './define';
import { PkgName } from '../identifier';
import { BuiltInProcName } from '../built-in-proc-name';
import { ArgProp, CallProp, SemanticCallTag } from '../built-in-props';
import { AmbientStateAccessType } from '../../internal/process/functions/call/built-in/built-in-ambient-state';
import type { AnyBuiltInDefinition } from '../built-in-config';

/** The built-in definitions of spatial, geographic, and phylogenetic data. */
export const SpatialDefinitions = [
	fn(pkg(PkgName.Sf, 'read_sf', 'st_read'), BuiltInProcName.DefaultReadAllArgs, readsFile('dsn')),
	fn(pkg(PkgName.Rgdal, 'readOGR', 'ogrInfo', 'ogrFIDs', 'OGRSpatialRef', 'ogrListLayers'), BuiltInProcName.DefaultReadAllArgs, readsFile('dsn')),
	fn(pkg(PkgName.Rgdal, 'readGDAL'), BuiltInProcName.DefaultReadAllArgs, readsFile('fname')),
	fn(pkg(PkgName.Maptools, 'readShapePoly'), BuiltInProcName.DefaultReadAllArgs, readsFile('fn')),
	fn(pkg(PkgName.Terra, 'rast', 'vect'), BuiltInProcName.DefaultReadAllArgs, readsFile('x')),
	fn(pkg(PkgName.Raster, 'raster', 'brick', 'shapefile'), BuiltInProcName.DefaultReadAllArgs, readsFile('x')),
	fn(pkg(PkgName.Stars, 'read_stars', 'read_ncdf'), BuiltInProcName.DefaultReadAllArgs,
		{ libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Reads], sig: sig({ '.x': Forced.Resource, '...': Forced.Value }) }
	),
	fn(pkg(PkgName.Maptools, 'readShapeLines', 'readShapePoints', 'readShapeSpatial'), BuiltInProcName.DefaultReadAllArgs, readsFile('fn')),
	fn(pkg(PkgName.Ape, 'read.nexus', 'read.nexus.data', 'read.dna', 'read.FASTA'), BuiltInProcName.DefaultReadAllArgs, readsFile('file')),
	fn(pkg(PkgName.Ape, 'write.tree'), BuiltInProcName.DefaultReadAllArgs,
		{
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ phy: Forced.Value, file: Forced.Resource | ArgProp.Optional, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Ape, 'write.nexus'), BuiltInProcName.DefaultReadAllArgs,
		{
			props: CallProp.Invisible,
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ phy: Forced.Value, file: Forced.Resource | ArgProp.Optional, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Ape, 'write.phyloXML'), BuiltInProcName.DefaultReadAllArgs, writesFile('file', 'phy')),
	fn(pkg(PkgName.Rgdal, 'writeOGR'), BuiltInProcName.DefaultReadAllArgs,
		{
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ obj: Forced.Value, dsn: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Rgdal, 'writeGDAL'), BuiltInProcName.DefaultReadAllArgs, writesFile('fname', 'dataset')),
	fn(pkg(PkgName.Sf, 'st_write'), BuiltInProcName.DefaultReadAllArgs,
		{
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ obj: Forced.Value, dsn: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Maptools, 'writePolyShape'), BuiltInProcName.DefaultReadAllArgs,
		{ libFn: true, tags: [SemanticCallTag.File, SemanticCallTag.Writes], sig: sig({ x: Forced.Value, fn: Forced.Resource, '...': Forced.Value }) }
	),
	fn(pkg(PkgName.Terra, 'writeRaster'), BuiltInProcName.DefaultReadAllArgs,
		{
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ x: Forced.Value, filename: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Terra, 'writeVector'), BuiltInProcName.DefaultReadAllArgs, writesFile('filename')),
	fn(pkg(PkgName.Terra, 'writeCDF'), BuiltInProcName.DefaultReadAllArgs,
		{
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ x: Forced.Value, filename: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Raster, 'writeRaster'), BuiltInProcName.DefaultReadAllArgs,
		{
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ x: Forced.Value, filename: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Stars, 'write_stars'), BuiltInProcName.DefaultReadAllArgs,
		{
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ obj: Forced.Value, dsn: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Ape, 'write.dna', 'write.nexus.data'), BuiltInProcName.DefaultReadAllArgs,
		{
			libFn: true,
			tags:  [SemanticCallTag.File, SemanticCallTag.Writes],
			sig:   sig({ x: Forced.Value, file: Forced.Resource, '...': Forced.Value })
		}
	),
	fn(pkg(PkgName.Maptools, 'pointLabel'), BuiltInProcName.DefaultReadAllArgs,
		{ props: CallProp.Invisible, ambient: { type: AmbientStateAccessType.DrawRng }, tags: [SemanticCallTag.Random] }
	),
] as const satisfies AnyBuiltInDefinition[];
