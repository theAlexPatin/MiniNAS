import { ChevronRight, Home } from 'lucide-react-native'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Colors, Typography } from '@/theme'

interface BreadcrumbSegment {
	label: string
	path: string
}

interface BreadcrumbsProps {
	segments: BreadcrumbSegment[]
	onNavigate: (path: string) => void
}

export default function Breadcrumbs({ segments, onNavigate }: BreadcrumbsProps) {
	return (
		<ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container}>
			<View style={styles.inner}>
				<Pressable onPress={() => onNavigate('')} style={styles.crumb}>
					<Home size={14} color={Colors.TextColor.secondary} />
				</Pressable>

				{segments.map((segment, index) => {
					const isLast = index === segments.length - 1
					return (
						<View key={segment.path} style={styles.segmentRow}>
							<ChevronRight size={14} color={Colors.TextColor.tertiary} />
							{isLast ? (
								<Text style={styles.currentText} numberOfLines={1}>
									{segment.label}
								</Text>
							) : (
								<Pressable onPress={() => onNavigate(segment.path)} style={styles.crumb}>
									<Text style={styles.crumbText} numberOfLines={1}>
										{segment.label}
									</Text>
								</Pressable>
							)}
						</View>
					)
				})}
			</View>
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	container: {
		flexGrow: 0,
	},
	inner: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	segmentRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	crumb: {
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 4,
	},
	crumbText: {
		fontSize: 13,
		color: Colors.TextColor.secondary,
		fontFamily: Typography.body.fontFamily,
		maxWidth: 160,
	},
	currentText: {
		fontSize: 13,
		fontWeight: '600',
		color: Colors.TextColor.primary,
		fontFamily: Typography.body.fontFamily,
		paddingHorizontal: 8,
		paddingVertical: 4,
		maxWidth: 200,
	},
})
