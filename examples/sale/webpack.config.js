const path = require('path')
const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
// webpack.config.js
const VueLoaderPlugin = require('vue-loader/lib/plugin')
const px2rem = require('postcss-px2rem')
const cssnext = require('postcss-cssnext')({
  browsers: [
    'last 2 versions',
    'iOS >= 7',
    'Android >= 4.0',
  ],
})
const SkeletonPlugin = require('../../src/skeletonPlugin')

module.exports = {
  mode: 'development',
  entry: './src/main.js',
  output: {
    path: path.resolve(__dirname, './dist'),
    publicPath: '/',
    filename: 'build.js'
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: { importLoaders: 1 }
          },
          {
            loader: 'postcss-loader',
            options: {
              ident: 'postcss',
              sourceMap: true,
              plugins: loader => [
                require('postcss-import')({ root: loader.resourcePath }),
                require('postcss-nested'),
                cssnext,
                px2rem({ remUnit: 75 })
              ]
            }
          }
        ]
      },
      {
        test: /\.vue$/,
        loader: 'vue-loader'
      },
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: file =>
          /node_modules/.test(file) &&
          !/\.vue\.js/.test(file)

      },
      {
        test: /\.(png|jpg|gif|svg)$/,
        loader: 'file-loader',
        options: {
          name: '[name].[ext]?[hash]'
        }
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: 'index.html',
      template: 'index.html'
    }),
    new VueLoaderPlugin(),
    new SkeletonPlugin({
      pathname: path.resolve(__dirname, './shell'),
      staticDir: path.resolve(__dirname, './dist'),
      routes: ['http://0.0.0.0:9090/motor/sf/car_hero/index.html']
    }),
  ],
  resolve: {
    alias: {
      'vue$': 'vue/dist/vue.esm.js'
    }
  },
  devServer: {
    historyApiFallback: true,
    noInfo: true,
    overlay: true
  },
  performance: {
    hints: false
  },
  devtool: '#eval-source-map'
}

if (process.env.NODE_ENV === 'production') {
  module.exports.devtool = '#source-map'
  module.exports.mode = 'production'
  // http://vue-loader.vuejs.org/en/workflow/production.html
  module.exports.plugins = (module.exports.plugins || []).concat([
    new webpack.LoaderOptionsPlugin({
      minimize: true
    })
  ])
}
