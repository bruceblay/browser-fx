#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Copy offscreen files to build directory
const sourceFiles = [
  'offscreen.html',
  'offscreen-effects.js'
]

// Find the correct build directory (dev or prod)
const buildBaseDir = path.join(__dirname, '../build')
let buildDir

if (fs.existsSync(path.join(buildBaseDir, 'chrome-mv3-prod'))) {
  buildDir = path.join(buildBaseDir, 'chrome-mv3-prod')
} else if (fs.existsSync(path.join(buildBaseDir, 'chrome-mv3-dev'))) {
  buildDir = path.join(buildBaseDir, 'chrome-mv3-dev')
} else {
  console.error('❌ No build directory found!')
  process.exit(1)
}

console.log('📦 Copying offscreen files to build directory...')

sourceFiles.forEach(file => {
  const sourcePath = path.join(__dirname, '..', file)
  const targetPath = path.join(buildDir, file)

  if (fs.existsSync(sourcePath)) {
    try {
      fs.copyFileSync(sourcePath, targetPath)
      console.log(`✅ Copied ${file}`)
    } catch (err) {
      console.error(`❌ Error copying ${file}:`, err.message)
    }
  } else {
    console.warn(`⚠️  Source file not found: ${file}`)
  }
})

console.log('📦 Offscreen file copy complete')