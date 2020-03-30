const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  mode: 'development',
  entry: ['./app/index'],
  output: {
    path: path.join(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  resolve: {
    modules: ['node_modules'],
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.scss$/,
        exclude: /node_modules/,
        use: [
          process.env.NODE_ENV !== 'production'
            ? 'style-loader'
            : MiniCssExtractPlugin.loader,
          'css-loader',
          'sass-loader',
        ],
      },
      {
        test: /\.(j|t)s(x)?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true,
            babelrc: false,
            presets: [
              [
                '@babel/preset-env',
                {
                  targets: { browsers: 'last 2 versions' },
                  useBuiltIns: 'entry',
                  corejs: '3',
                },
              ],
              '@babel/preset-typescript',
            ],
            plugins: [
              ['@babel/plugin-proposal-class-properties', { loose: true }],
              [
                '@babel/plugin-transform-runtime',
                {
                  regenerator: true,
                },
              ],
            ],
          },
        },
      },
    ],
  },
  devtool: 'eval-source-map',
  plugins: [
    new ForkTsCheckerWebpackPlugin(),
    new webpack.NamedModulesPlugin(),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'static', 'index.html'),
      filename: 'index.html',
    }),
    new CopyPlugin([{ from: 'src/static', to: 'static' }]),

    // new MiniCssExtractPlugin({
    //   // Options similar to the same options in webpackOptions.output
    //   // both options are optional
    //   filename: '[name].css',
    //   chunkFilename: '[id].css',
    // }),
  ],
};
