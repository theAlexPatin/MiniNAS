const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

module.exports = (() => {
  const config = getDefaultConfig(__dirname)
  const { resolver } = config

  // Dev server middleware: proxy /api and /dav requests to the MiniNAS backend
  config.server = {
    ...config.server,
    enhanceMiddleware: (middleware) => {
      return (req, res, next) => {
        // Proxy API requests to backend
        if (
          req.url?.startsWith('/api/') ||
          req.url?.startsWith('/dav/')
        ) {
          const http = require('http')
          const proxyReq = http.request(
            {
              hostname: 'localhost',
              port: 3001,
              path: req.url,
              method: req.method,
              headers: req.headers,
            },
            (proxyRes) => {
              res.writeHead(proxyRes.statusCode, proxyRes.headers)
              proxyRes.pipe(res, { end: true })
            }
          )
          req.pipe(proxyReq, { end: true })
          return
        }
        return middleware(req, res, next)
      }
    },
  }

  config.resolver = {
    ...resolver,
    resolveRequest: (context, moduleName, platform) => {
      if (platform === 'web') {
        // Alias react-native to react-native-web on web
        if (moduleName === 'react-native') {
          return context.resolveRequest(context, 'react-native-web', platform)
        }

        // Mock native-only modules on web
        const webMocks = {
          'expo-haptics': path.resolve(__dirname, 'mocks/expo-haptics.web.js'),
          'expo-splash-screen': path.resolve(
            __dirname,
            'mocks/expo-splash-screen.web.js'
          ),
          'react-native-screens': path.resolve(
            __dirname,
            'mocks/react-native-screens.web.js'
          ),
        }

        if (webMocks[moduleName]) {
          return {
            type: 'sourceFile',
            filePath: webMocks[moduleName],
          }
        }
      }
      return context.resolveRequest(context, moduleName, platform)
    },
  }

  return config
})()
