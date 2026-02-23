import { z } from 'zod'

// File entry returned by listing
export const FileEntrySchema = z.object({
	name: z.string(),
	path: z.string(),
	isDirectory: z.boolean(),
	size: z.number(),
	modifiedAt: z.string(),
	mimeType: z.string().nullable(),
	hasThumbnail: z.boolean().optional(),
})

export type FileEntry = z.infer<typeof FileEntrySchema>

// Volume info
export const VolumeInfoSchema = z.object({
	id: z.string(),
	label: z.string(),
	totalBytes: z.number(),
	freeBytes: z.number(),
	usedBytes: z.number(),
})

export type VolumeInfo = z.infer<typeof VolumeInfoSchema>

// Rename/move request
export const MoveRequestSchema = z.object({
	destination: z.string().min(1),
})

// Mkdir request
export const MkdirRequestSchema = z.object({
	name: z.string().min(1).max(255),
})

// Search query
export const SearchQuerySchema = z.object({
	q: z.string().min(1),
	volume: z.string().optional(),
})

// Share link creation
export const CreateShareSchema = z.object({
	volume: z.string(),
	path: z.string(),
	password: z.string().optional(),
	maxDownloads: z.number().int().positive().optional(),
	expiresIn: z.number().int().positive().optional(), // hours
	isPublic: z.boolean().optional(),
})

// Zip download request
export const ZipDownloadSchema = z.object({
	volume: z.string(),
	paths: z.array(z.string()).min(1),
})
