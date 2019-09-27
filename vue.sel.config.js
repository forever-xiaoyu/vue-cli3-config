const path = require('path')
// const CompressionWebpackPlugin = require('compression-webpack-plugin')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
const WorkboxPlugin = require('workbox-webpack-plugin')
const WebpackBar = require('webpackbar')
const loading = require('./src/components/pre-render-loading')
const VConsolePlugin = require('vconsole-webpack-plugin')
const resolvePath = dir => path.join(__dirname, dir)
const isProduction = process.env.NODE_ENV === 'production'

module.exports = {
  // 项目部署基础
  // 默认情况下，我们假设你的应用将被部署在域的根目录下,
  // 例如：https://www.my-app.com/
  // 默认：'/'
  // 如果您的应用程序部署在子路径中，则需要在这指定子路径
  // 例如：https://www.foobar.com/my-app/
  // 需要将它改为'/my-app/'
  publicPath: process.env.BASE_URL,
  outputDir: resolvePath('dist'),
  // 如果你不需要使用eslint，把 lintOnSave 设为false即可
  lintOnSave: true,
  // 向 CSS 相关的 loader 传递选项
  css: {
    // 将组件内的 CSS 提取到一个单独的 CSS 文件 (只用在生产环境中)
    // 也可以是一个传递给 `extract-text-webpack-plugin` 的选项对象
    extract: true,
    loaderOptions: {
      // 为 sass 设置全局的变量、mixin或 function
      // 将 sass 代码放在实际的入口文件(entry file)之前，可以设置 data 选项。
      // 此时 sass-loader 不会覆盖 data 选项，只会将它拼接在入口文件的内容之前。
      // 当 sass 变量依赖于环境时，这一点尤其有用
      sass: {
        data: `
        @import "./src/styles/index.scss";
        `
      }
    }
  },
  // 提供了一个 webpack 原始配置的上层抽象，
  // 使其可以定义具名的 loader 规则和具名插件，
  // 并有机会在后期进入这些规则并对它们的选项进行修改。
  chainWebpack: config => {
    // 最小化代码
    config.optimization.minimize(true)

    // 分割代码
    config.optimization.splitChunks({
      chunks: 'all',
      maxInitialRequests: Infinity,
      minSize: 300000, // 依赖包超过300000bit将被单独打包
      automaticNameDelimiter: '-',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name (module) {
            const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1]
            return `chunk.${packageName.replace('@', '')}`
          },
          priority: 10
        }
      }
    })

    // 替换原有的 svg 基础loader，在html内直接展示
    const svgRule = config.module.rule('svg')
    svgRule.uses.clear()
    svgRule.use('raw-loader').loader('raw-loader')

    // 自定义路径解析
    config.resolve.alias
      .set('@', resolvePath('src'))
      .set('_v', resolvePath('src/views'))

    // 这里是对环境的配置，不同环境对应不同的REQUEST_URL，以便axios的请求地址不同
    config.plugin('define').tap(args => {
      args[0]['process.env'].REQUEST_URL = JSON.stringify(
        process.env.REQUEST_URL
      )
      return args
    })

    // 将一个使用vue编写的loading组件在webpack编译过程中将虚拟dom预渲染到html中
    config.plugin('html').tap(args => {
      args[0].loading = loading
      return args
    })

    // 移除 prefetch 插件
    config.plugins.delete('prefetch')

    // 对于 vue、vue-router、vuex 、axios和 element-ui 等等这些不经常改动的库，
    // 我们让webpack不对他们进行打包，通过cdn引入，
    // 可以减少代码的大小、也可以减少服务器的带宽，更能把这些文件缓存到客户端，客户端加载的会更快。
    // if (isProduction) {
    // 生产环境忽略打包的文件
    // 通过该配置可以告诉 webpack 在 javascript 运行环境中已经内置了哪些全局变量，
    // 不用讲这些全局变量打包到代码中而是直接使用它们
    const externals = {
      // 将导入语句中的 vue 替换成运行环境里的全局变量 Vue
      vue: 'Vue',
    }
    config.externals(externals)

    const cdn = {
      css: [
      ],
      js: [
        '//cdnjs.cloudflare.com/ajax/libs/vue/2.6.10/vue.min.js'
      ]
    }
    config.plugin('html').tap(args => {
      args[0].cdn = cdn
      return args
    })
    // }
  },
  // 该方法的第一个参数会收到已经解析好的配置。
  // 在函数内，你可以直接修改配置，或者返回一个将会被合并的对象
  configureWebpack: config => {
    if (isProduction) {
      // 移除 console 等
      config.plugins.push(
        new UglifyJsPlugin({
          uglifyOptions: {
            compress: {
              drop_debugger: true,
              drop_console: true
            }
          },
          sourceMap: false,
          parallel: true
        })
      )
      // 构建时开启gzip，降低服务器压缩对CPU资源的占用，服务器也要相应开启gzip
      // config.plugins.push(
      //   new CompressionWebpackPlugin({
      //     test: new RegExp('\\.(' + ['js', 'css'].join('|') + ')$'),
      //     threshold: 8192,
      //     minRatio: 0.8
      //   })
      // )
    } else {
      // VConsole
      config.plugins.push(
        new VConsolePlugin({
          enable: process.env.VUE_APP_VCONSOLE === 'true'
        })
      )
      // 进度条插件
      config.plugins.push(new WebpackBar())
    }
    // 生成sw文件，构建离线应用
    // 参考https://webpack.docschina.org/guides/progressive-web-application/
    config.plugins.push(
      new WorkboxPlugin.GenerateSW({
        // 这些选项帮助 ServiceWorkers 快速启用
        // 不允许遗留任何“旧的” ServiceWorkers
        clientsClaim: true,
        skipWaiting: true
      })
    )
  },
  // 打包时不生成.map文件
  productionSourceMap: false,
  devServer: {
    open: true,
    host: 'www.google.com',
    port: 80,
    disableHostCheck: true, // 解决127.0.0.1指向其他域名时出现"Invalid Host header"问题
    // 这里写你调用接口的基础路径，来解决跨域，如果设置了代理，那你本地开发环境的axios的baseUrl要写为 '' ，即空字符串
    proxy: {
    // 例如将'localhost:8080/api/xxx'代理到'https://yujihu.cn/api/xxx'
      '/api': {
        target: 'http://www.google.com', // 接口的域名
        // secure: true, // 是否验证SSL证书，如果是https接口，需要配置这个参数
        changeOrigin: true // 将主机标头的原点更改为目标URL，如果接口跨域，需要进行这个参数配置
      }
    }
  }
}
