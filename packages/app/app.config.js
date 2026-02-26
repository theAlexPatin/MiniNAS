export default {
	expo: {
		name: 'MiniNAS',
		slug: 'mininas',
		version: '0.1.0',
		orientation: 'default',
		scheme: 'mininas',
		userInterfaceStyle: 'light',
		newArchEnabled: true,
		ios: {
			supportsTablet: true,
			bundleIdentifier: 'com.mininas.app',
		},
		android: {
			adaptiveIcon: {
				backgroundColor: '#ffffff',
			},
			package: 'com.mininas.app',
		},
		web: {
			bundler: 'metro',
			output: 'static',
			favicon: './src/assets/favicon.png',
		},
		plugins: [
			'expo-router',
			[
				'expo-build-properties',
				{
					ios: {
						deploymentTarget: '15.1',
					},
				},
			],
		],
		experiments: {
			typedRoutes: true,
		},
		extra: {
			router: {
				origin: false,
			},
		},
	},
}
