#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Copy offscreen files to DEV build directory
const sourceFiles = [
  'offscreen.html',
  'offscreen-effects.js',
  'autotune-worklet.js',
  'autotune-licenses.txt',
  'midi-setup.html',
  'midi-setup.js'
]

// No external dependencies to copy

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

  // Required runtime assets must fail the build if missing or unreadable.
  fs.copyFileSync(sourcePath, targetPath)
  console.log(`✅ Copied ${file}`)
})

// No external files to copy

console.log('📦 Dev offscreen file copy complete')
