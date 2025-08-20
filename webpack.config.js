const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = [
  // Main process
  {
    mode: process.env.NODE_ENV || 'development',
    entry: './src/main/index.ts',
    target: 'electron-main',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'main.js',
    },
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          { from: 'src/main/icon.png', to: 'icon.png' },
          { from: 'resources/', to: 'resources/', noErrorOnMissing: true }
        ],
      }),
    ],
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@shared': path.resolve(__dirname, 'src/shared'),
        '@main': path.resolve(__dirname, 'src/main'),
      },
    },
    externals: {
      electron: 'commonjs electron',
    },
  },
  // Preload script
  {
    mode: process.env.NODE_ENV || 'development',
    entry: './src/main/preload.ts',
    target: 'electron-preload',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'preload.js',
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@shared': path.resolve(__dirname, 'src/shared'),
      },
    },
  },
  // Renderer process
  {
    mode: process.env.NODE_ENV || 'development',
    entry: './src/renderer/index.tsx',
    target: 'electron-renderer',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'renderer.js',
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@shared': path.resolve(__dirname, 'src/shared'),
        '@renderer': path.resolve(__dirname, 'src/renderer'),
      },
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: 'public/favicon.png', to: 'favicon.png' }
        ],
      }),
    ],
    devtool: 'source-map',
  },
];