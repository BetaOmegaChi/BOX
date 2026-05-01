// webpack.config.js
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
require('dotenv').config();

module.exports = (env, argv) => {
  const prod = argv.mode === 'production';

  return {
    entry: './src/main.jsx',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: prod ? '[name].[contenthash].js' : '[name].js',
      assetModuleFilename: 'assets/[name].[contenthash][ext][query]',
      publicPath: 'auto',          // ✅ works under /<repo> on GitHub Pages
      clean: true                  // ✅ clears old files each build
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', { targets: 'defaults' }],
                ['@babel/preset-react', { runtime: 'automatic' }],
              ]
            }
          }
        },
        { test: /\.css$/i, use: ['style-loader', 'css-loader'] },
        { test: /\.(png|jpe?g|gif|svg)$/i, type: 'asset' },
        { test: /\.(woff2?|eot|ttf|otf)$/i, type: 'asset/resource' },
      ]
    },
    resolve: { extensions: ['.js', '.jsx'] },
    plugins: [
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'static/index.html'), // your HTML template
        inject: 'body',    // ✅ auto-injects the hashed <script> tag
      }),
      new webpack.DefinePlugin({
        'process.env.SUPABASE_URL':      JSON.stringify(process.env.SUPABASE_URL),
        'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY),
      }),
    ],
    optimization: prod
      ? { splitChunks: { chunks: 'all' }, runtimeChunk: 'single' } // ✅ better caching
      : {},
    devtool: prod ? 'source-map' : 'eval-cheap-module-source-map',
    devServer: {
      static: { directory: path.resolve(__dirname, 'dist') },
      historyApiFallback: true,  // ✅ SPA routing in dev
      port: 8080,
      allowedHosts: 'all',
    },
  };
};
