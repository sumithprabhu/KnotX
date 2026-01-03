import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const emptyModulePath = resolve(__dirname, 'empty-module.js')

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Increase body size limit for API routes
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  webpack: (config, { webpack, isServer }) => {
    // Exclude test files and other non-production files from node_modules
    config.module = config.module || {}
    config.module.rules = config.module.rules || []
    
    // Ignore test files and directories in node_modules
    config.module.rules.push({
      test: /node_modules\/.*\/test\/.*/,
      use: 'ignore-loader',
    })
    
    // Ignore all test and spec files (including test.js)
    config.module.rules.push({
      test: /\.(test|spec)\.(js|ts|tsx|mjs)$/,
      use: 'ignore-loader',
    })
    
    // Ignore test.js files specifically (like viem/_esm/clients/decorators/test.js)
    config.module.rules.push({
      test: /\/test\.js$/,
      use: 'ignore-loader',
    })
    
    // Ignore LICENSE and README files
    config.module.rules.push({
      test: /(LICENSE|README\.md|\.md)$/,
      use: 'ignore-loader',
    })
    
    // Ignore shell scripts and other non-JS files
    config.module.rules.push({
      test: /\.(sh|zip)$/,
      use: 'ignore-loader',
    })
    
    // Use plugins to handle test file imports
    config.plugins = config.plugins || []
    
    // Ignore test-related imports from viem and other packages
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^\.\/test\//,
        contextRegExp: /node_modules\/viem/,
      })
    )
    
    // Replace test.js files with empty module
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /test\.js$/,
        emptyModulePath
      )
    )
    
    // Replace test directory imports with empty module
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /\.\/test\//,
        emptyModulePath
      )
    )
    
    // Use resolve.alias to redirect problematic test imports
    config.resolve = config.resolve || {}
    config.resolve.alias = config.resolve.alias || {}
    
    // Redirect test.js imports to empty module
    config.resolve.alias['./test.js'] = emptyModulePath
    config.resolve.alias['./test'] = emptyModulePath
    config.resolve.alias['./test/'] = emptyModulePath
    
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      }
    }
    
    return config
  },
}

export default nextConfig
