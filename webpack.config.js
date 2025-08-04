const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

const buildMode = process.env.NODE_ENV || 'production';
const isProduction = buildMode === 'production';
const isAnalyze = process.env.ANALYZE === 'true';

module.exports = {
  mode: buildMode,
  entry: './src/main.js',
  
  output: {
    path: path.resolve(__dirname, 'dist-webpack'),
    filename: isProduction ? 'bundle.[contenthash:8].js' : 'bundle.js',
    clean: true,
    publicPath: '',
  },
  
  resolve: {
    extensions: ['.js'],
    modules: ['node_modules', 'src'],
  },
  
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', {
                targets: {
                  browsers: ['> 1%', 'last 2 versions', 'not ie <= 8']
                },
                modules: false
              }]
            ]
          }
        }
      },
      {
        test: /\.css$/,
        use: [
          isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
          'css-loader'
        ]
      }
    ]
  },
  
  plugins: [
    new HtmlWebpackPlugin({
      template: './demo.html',
      filename: 'index.html',
      inject: 'body',
      minify: isProduction ? {
        removeComments: true,
        collapseWhitespace: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeStyleLinkTypeAttributes: true,
        keepClosingSlash: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true,
      } : false,
      templateParameters: {
        buildDate: new Date().toISOString(),
        buildMode: buildMode,
        bundler: 'webpack'
      }
    }),
    
    ...(isProduction ? [
      new MiniCssExtractPlugin({
        filename: 'styles.[contenthash:8].css',
      })
    ] : []),
    
    ...(isAnalyze ? [
      new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        openAnalyzer: false,
        reportFilename: 'bundle-analysis.html'
      })
    ] : [])
  ],
  
  optimization: {
    minimize: isProduction,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: false, // Keep console for debugging
            drop_debugger: false,
          },
          mangle: {
            keep_fnames: true, // Keep function names for debugging
          },
          format: {
            comments: false,
          },
        },
        extractComments: false,
      }),
    ],
    
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        default: false,
        vendors: false,
        // Keep everything in a single bundle for the single-file requirement
        bundle: {
          name: 'bundle',
          chunks: 'all',
          enforce: true
        }
      }
    }
  },
  
  performance: {
    maxAssetSize: 500000, // 500KB limit as specified in requirements
    maxEntrypointSize: 500000,
    hints: isProduction ? 'warning' : false
  },
  
  devtool: isProduction ? 'source-map' : 'eval-source-map',
  
  stats: {
    colors: true,
    modules: false,
    children: false,
    chunks: false,
    chunkModules: false,
    assets: true,
    entrypoints: false,
    performance: true,
    errors: true,
    warnings: true,
  }
};