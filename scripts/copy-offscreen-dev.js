#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Recursive directory copy function
function copyDirSync(src, dest) {
  if (!fs.existsSync(src)) {
    return false
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true })
  }

  const entries = fs.readdirSync(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }

  return true
}

// Copy offscreen files to DEV build directory
const sourceFiles = [
  'offscreen.html',
  'offscreen-effects.js'
]

// Copy Tone.js ES modules from node_modules
const nodeModulesDirectories = [
  {
    source: 'node_modules/tone/build/esm',
    target: 'tone'
  }
]

// Target the dev build directory
const buildDir = path.join(__dirname, '../build/chrome-mv3-dev')

if (!fs.existsSync(buildDir)) {
  console.error('❌ Dev build directory not found! Run `plasmo dev` first.')
  process.exit(1)
}

console.log('📦 Copying offscreen files to DEV build directory...')
console.log('📦 Target directory:', buildDir)

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

// Copy node_modules directories
nodeModulesDirectories.forEach(({ source, target }) => {
  const sourcePath = path.join(__dirname, '..', source)
  const targetPath = path.join(buildDir, target)

  if (copyDirSync(sourcePath, targetPath)) {
    console.log(`✅ Copied ${target} directory from node_modules`)
  } else {
    console.warn(`⚠️  Node modules directory not found: ${source}`)
  }
})

console.log('📦 Dev offscreen file copy complete')