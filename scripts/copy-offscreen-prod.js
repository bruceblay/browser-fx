#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// Copy offscreen files to PROD build directory
const sourceFiles = [
  'offscreen.html',
  'offscreen-effects.js',
  'autotune-worklet.js',
  'autotune-licenses.txt',
  'midi-setup.html',
  'midi-setup.js'
]

// No external dependencies to copy

// Target the prod build directory
const buildDir = path.join(__dirname, '../build/chrome-mv3-prod')

if (!fs.existsSync(buildDir)) {
  console.error('❌ Prod build directory not found! Run `plasmo build` first.')
  process.exit(1)
}

console.log('📦 Copying offscreen files to PROD build directory...')
console.log('📦 Target directory:', buildDir)

sourceFiles.forEach(file => {
  const sourcePath = path.join(__dirname, '..', file)
  const targetPath = path.join(buildDir, file)

  // Required runtime assets must fail the build if missing or unreadable.
  fs.copyFileSync(sourcePath, targetPath)
  console.log(`✅ Copied ${file}`)
})

// No external files to copy

console.log('📦 Prod offscreen file copy complete')
