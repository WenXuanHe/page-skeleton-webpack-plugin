'use strict'

const fs = require('fs')
const http = require('http')
const path = require('path')
const EventEmitter = require('events')
const { promisify } = require('util')
const merge = require('lodash/merge')
const hasha = require('hasha')
const express = require('express')
const MemoryFileSystem = require('memory-fs')
const { defaultOptions, staticPath } = require('./config/config')
const {
  writeShell, generateQR, addDprAndFontSize,
  getLocalIpAddress, createLog
} = require('./util')
const Skeleton = require('./skeleton')

const defineOptions = merge({ staticPath }, defaultOptions, {
  routes: ['http://0.0.0.0:9090/motor/sf/car_hero/index.html']
})
const myFs = new MemoryFileSystem()

class Server extends EventEmitter {
  constructor(options) {
    super()
    Object.keys(options).forEach(k => Object.assign(this, { [k]: options[k] }))
    this.options = options
    this.host = getLocalIpAddress()
    // 用于缓存写入 shell.html 文件的 html
    this.routesData = null
    // The origin page which used to generate the skeleton page
    this.origin = ''
    this.sockets = []
    this.previewSocket = null
    this.skeleton = null
    this.log = createLog(options)
    this.skeleton = new Skeleton(this.options, this.log)
  }

  // 启动服务
  async listen() {
    /* eslint-disable no-multi-assign */
    const app = this.app = express()
    const listenServer = this.listenServer = http.createServer(app)
    this.initRouters()
    listenServer.listen(this.port, () => {
      this.log.info(`page-skeleton server listen at port: ${this.port}`)
      this.resiveSocketData()
    })
  }

  // Close server
  close() {
    if (this.skeleton && this.skeleton.destroy) this.skeleton.destroy()
    // process.exit()
    this.listenServer.close(() => {
      this.log.info('server closed')
    })
  }

  async initRouters() {
    const { app, staticPath, log } = this
    app.use('/', express.static(path.resolve(__dirname, '../preview/dist')))

    const staticFiles = await promisify(fs.readdir)(path.resolve(__dirname, '../client'))

    staticFiles
      .filter(file => /\.bundle/.test(file))
      .forEach((file) => {
        app.get(`/${staticPath}/${file}`, (req, res) => {
          res.setHeader('Content-Type', 'application/javascript')
          fs.createReadStream(path.join(__dirname, '..', 'client', file)).pipe(res)
        })
      })

    app.get('/preview.html', async (req, res) => {
      fs.createReadStream(path.resolve(__dirname, '..', 'preview/dist/index.html')).pipe(res)
    })

    app.get('/:filename', async (req, res) => {
      const { filename } = req.params
      if (!/\.html$/.test(filename)) return false
      let html = await promisify(fs.readFile)(path.resolve(__dirname, 'templates/notFound.html'), 'utf-8')
      try {
        // if I use `promisify(myFs.readFile)` if will occur an error
        // `TypeError: this[(fn + "Sync")] is not a function`,
        // So `readFile` need to hard bind `myFs`, maybe it's an issue of `memory-fs`
        html = await promisify(myFs.readFile.bind(myFs))(path.resolve(__dirname, `${staticPath}/${filename}`), 'utf-8')
      } catch (err) {
        log.warn(`When you request the preview html, ${err} ${filename}`)
      }
      res.send(html)
    })
  }

  /**
   * 处理 data socket 消息
   */
  async resiveSocketData() {
    try {
      const skeletonScreens = await this.skeleton.renderRoutes()
      // CACHE html
      this.routesData = {}
      /* eslint-disable no-await-in-loop */
      for (const { route, html } of skeletonScreens) {
        const fileName = await this.writeMagicHtml(html)
        const skeletonPageUrl = `http://${this.host}:${this.port}/${fileName}`
        this.log.info(`请打开${skeletonPageUrl}浏览`)
        this.routesData[route] = {
          url: route,
          skeletonPageUrl,
          qrCode: await generateQR(skeletonPageUrl),
          html
        }

        await this.writeShellFile()
      }
    } catch (err) {
      const message = err.message || 'generate skeleton screen failed.'
      throw new Error(message)
    }
  }

  /**
   * 将 sleleton 模块生成的 html 写入到内存中。
   */
  async writeMagicHtml(html) {
    const decHtml = addDprAndFontSize(html)
    try {
      const { staticPath } = this
      const pathName = path.join(__dirname, staticPath)
      console.log('writeMagicHtmlPath', pathName)
      let fileName = await hasha(decHtml, { algorithm: 'md5' })
      fileName += '.html'
      console.log('writeMagicHtmlPath', fileName)
      myFs.mkdirpSync(pathName)

      await promisify(myFs.writeFile.bind(myFs))(path.join(pathName, fileName), decHtml, 'utf8')
      return fileName
    } catch (err) {
      this.log.warn(err)
    }
  }


  async writeShellFile() {
    const { routesData, options } = this
    try {
      await writeShell(routesData, options)
    } catch (err) {
      this.log.warn(err)
    }
    const afterWriteMsg = 'Write files successfully...'
    this.log.info(afterWriteMsg)
  }

  async saveShellFile(route, html) {
    if (html) {
      this.routesData[route] = {}
      this.routesData[route].html = html
      const fileName = await this.writeMagicHtml(html)
      this.log.info('fileName', fileName)

      this.routesData[route].skeletonPageUrl = `http://${this.host}:${this.port}/${fileName}`
    }
  }
}


// const server = new Server(defineOptions) // eslint-disable-line no-multi-assign
// server.listen().catch(err => server.log.warn(err))
module.exports = Server
