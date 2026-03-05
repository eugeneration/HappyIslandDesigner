const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');

module.exports = (env, argv) => {
  const isDev = argv.mode !== 'production';

  return {
    mode: argv.mode || 'development',
    entry: ['./app/index'],
    output: {
      path: path.join(__dirname, 'dist'),
      publicPath: isDev ? '/' : 'dist/',
      filename: '[name].bundle.js',
      clean: true,
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
            isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
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
                    targets: { browsers: ['last 2 versions', 'not dead', 'not op_mini all'] },
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
                    regenerator: false,
                  },
                ],
                ['babel-plugin-typescript-to-proptypes', {}],
              ],
            },
          },
        },
      ],
    },
    devtool: isDev ? 'eval-source-map' : 'source-map',
    plugins: [
      new webpack.DefinePlugin({
        __DEV__: isDev,
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
        filename: isDev ? 'index.html' : path.resolve(__dirname, 'index.html'),
      }),
      //new CopyPlugin([{ from: 'src/static', to: 'static' }]),

      new MiniCssExtractPlugin({
        filename: '[name].css',
        chunkFilename: '[name].css',
      }),
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
};
