import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Colors, Typography } from '@/theme'

interface Tab {
	id: string
	label: string
}

interface TabsProps {
	tabs: Tab[]
	activeTab: string
	onChange: (id: string) => void
}

export default function Tabs({ tabs, activeTab, onChange }: TabsProps) {
	return (
		<View style={styles.container}>
			{tabs.map((tab) => {
				const isActive = activeTab === tab.id
				return (
					<Pressable key={tab.id} onPress={() => onChange(tab.id)} style={styles.tab}>
						<Text style={[styles.tabText, isActive && styles.activeTabText]}>{tab.label}</Text>
						{isActive && <View style={styles.indicator} />}
					</Pressable>
				)
			})}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		borderBottomWidth: 1,
		borderBottomColor: Colors.BorderColor.primary,
	},
	tab: {
		paddingHorizontal: 16,
		paddingVertical: 10,
		position: 'relative',
	},
	tabText: {
		fontSize: 13,
		fontWeight: '500',
		fontFamily: Typography.body.fontFamily,
		color: Colors.TextColor.secondary,
	},
	activeTabText: {
		color: Colors.BrandColor[600],
	},
	indicator: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		height: 2,
		backgroundColor: Colors.BrandColor[600],
	},
})
