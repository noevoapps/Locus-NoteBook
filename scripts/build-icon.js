const fs = require('fs')
const path = require('path')
const toIco = require('to-ico')

const root = path.join(__dirname, '..')
const iconPng = path.join(root, 'build', 'icon.png')
const iconIco = path.join(root, 'build', 'icon.ico')
const rendererIcon = path.join(root, 'src', 'renderer', 'src', 'assets', 'icon.png')
const resourcesIcon = path.join(root, 'resources', 'icon.png')

const png = fs.readFileSync(iconPng)
toIco(png, { resize: true }).then((buf) => {
  fs.writeFileSync(iconIco, buf)
  fs.copyFileSync(iconPng, rendererIcon)
  fs.copyFileSync(iconPng, resourcesIcon)
  console.log('Generated build/icon.ico and synced icon to renderer & resources')
}).catch((err) => {
  console.error('Failed to generate icon.ico:', err)
  process.exit(1)
})
