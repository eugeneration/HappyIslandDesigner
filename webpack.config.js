const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');

module.exports = {
  mode: 'development',
  entry: ['./app/index'],
  output: {
    path: path.join(__dirname),
    filename: '[name].bundle.js',
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
          {
            loader: 'sass-loader',
            options: {
              api: 'modern',
            },
          },
        ],
      },
      {
        test: /\.(png|woff|woff2|eot|ttf|svg)$/,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 100000
          }
        }
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
              '@babel/preset-react',
            ],
            plugins: [
              ['@babel/plugin-proposal-class-properties', { loose: true }],
              [
                '@babel/plugin-transform-runtime',
                {
                  regenerator: true,
                },
              ],
              ['babel-plugin-typescript-to-proptypes', {}],
            ],
          },
        },
      },
    ],
  },
  devtool: 'eval-source-map',
  plugins: [
    new webpack.DefinePlugin({
      // Since mode is hardcoded to 'development', __DEV__ is always true
      // For production builds, change mode to 'production' and this to false
      __DEV__: true,
    }),
    new ForkTsCheckerWebpackPlugin({
      typescript: {
        diagnosticOptions: {
          semantic: true,
          syntactic: true,
        },
      },
    }),
    new ESLintPlugin({
      extensions: ['js', 'jsx', 'ts', 'tsx'],
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'static', 'index.html'),
      filename: 'index.html',
    }),
    //new CopyPlugin([{ from: 'src/static', to: 'static' }]),

    // new MiniCssExtractPlugin({
    //   // Options similar to the same options in webpackOptions.output
    //   // both options are optional
    //   filename: '[name].css',
    //   chunkFilename: '[id].css',
    // }),
  ],
  optimization: {
    splitChunks: {
      cacheGroups: {
        commons: {
          test: /[\\/]node_modules[\\/]/,
          name: "vendor",
          chunks: "initial",
        }
      }
    }
  },
  devServer: {
    static: [
      {
        directory: path.join(__dirname, 'static'),
        publicPath: '/static',
      },
      {
        directory: __dirname,
        publicPath: '/',
      }
    ],
    hot: true,
    port: 8080,
  }
};
