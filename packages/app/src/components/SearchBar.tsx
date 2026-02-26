import { Search, X } from 'lucide-react-native'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSearch } from '@/hooks/useSearch'
import { getFileIcon } from '@/lib/fileIcons'
import { Colors, Outlines, Typography } from '@/theme'

interface SearchBarProps {
	volume: string
	onNavigate: (path: string) => void
}

export default function SearchBar({ volume, onNavigate }: SearchBarProps) {
	const [query, setQuery] = useState('')
	const [debouncedQuery, setDebouncedQuery] = useState('')
	const [isOpen, setIsOpen] = useState(false)

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedQuery(query), 300)
		return () => clearTimeout(timer)
	}, [query])

	const { data, isLoading } = useSearch(debouncedQuery, volume)

	return (
		<View style={styles.container}>
			<View style={styles.inputRow}>
				<Search size={16} color={Colors.TextColor.tertiary} />
				<TextInput
					value={query}
					onChangeText={(text) => {
						setQuery(text)
						setIsOpen(true)
					}}
					onFocus={() => query && setIsOpen(true)}
					placeholder="Search files..."
					placeholderTextColor={Colors.TextColor.tertiary}
					style={styles.input}
				/>
				{query.length > 0 && (
					<Pressable
						onPress={() => {
							setQuery('')
							setIsOpen(false)
						}}
						hitSlop={8}
					>
						<X size={14} color={Colors.TextColor.tertiary} />
					</Pressable>
				)}
			</View>

			{isOpen && debouncedQuery.length > 0 && (
				<View style={styles.dropdown}>
					{isLoading ? (
						<Text style={styles.dropdownMsg}>Searching...</Text>
					) : !data?.results.length ? (
						<Text style={styles.dropdownMsg}>No results</Text>
					) : (
						data.results.map((result) => {
							const isDir = result.is_directory === 1
							const dirPath = isDir ? result.path : result.path.split('/').slice(0, -1).join('/')

							return (
								<Pressable
									key={`${result.volume}:${result.path}`}
									onPress={() => {
										onNavigate(dirPath)
										setIsOpen(false)
										setQuery('')
									}}
									style={styles.resultItem}
								>
									<View style={styles.resultIcon}>
										{getFileIcon(
											{
												name: result.name,
												path: result.path,
												isDirectory: isDir,
												size: 0,
												modifiedAt: '',
												mimeType: null,
											},
											16,
										)}
									</View>
									<View style={styles.resultText}>
										<Text style={styles.resultName} numberOfLines={1}>
											{result.name}
										</Text>
										<Text style={styles.resultPath} numberOfLines={1}>
											{result.path}
										</Text>
									</View>
								</Pressable>
							)
						})
					)}
				</View>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		maxWidth: 400,
		position: 'relative',
		zIndex: 10,
	},
	inputRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		backgroundColor: '#ffffff',
		borderWidth: 1,
		borderColor: Colors.BorderColor.primary,
		borderRadius: Outlines.borderRadius.md,
		paddingHorizontal: 12,
		paddingVertical: 6,
	},
	input: {
		flex: 1,
		fontSize: 13,
		color: Colors.TextColor.primary,
		fontFamily: Typography.body.fontFamily,
		padding: 0,
	},
	dropdown: {
		position: 'absolute',
		top: '100%',
		left: 0,
		right: 0,
		marginTop: 4,
		backgroundColor: '#ffffff',
		borderWidth: 1,
		borderColor: Colors.BorderColor.primary,
		borderRadius: Outlines.borderRadius.md,
		maxHeight: 320,
		...Outlines.shadow.lg,
	},
	dropdownMsg: {
		paddingHorizontal: 16,
		paddingVertical: 12,
		fontSize: 13,
		color: Colors.TextColor.tertiary,
	},
	resultItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	resultIcon: {
		width: 16,
		alignItems: 'center',
	},
	resultText: {
		flex: 1,
	},
	resultName: {
		fontSize: 13,
		color: Colors.TextColor.primary,
	},
	resultPath: {
		fontSize: 11,
		color: Colors.TextColor.tertiary,
	},
})
