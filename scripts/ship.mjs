// Build, commit everything and push in one step.
// Usage: npm run ship "what you changed"
import { execSync } from 'node:child_process'

const message = process.argv.slice(2).join(' ').trim()
if (!message) {
  console.error('Add a commit message: npm run ship "what you changed"')
  process.exit(1)
}

const run = (cmd) => execSync(cmd, { stdio: 'inherit' })
const out = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim()

if (!out('git status --porcelain')) {
  console.log('Nothing to ship: no changes since the last commit.')
  process.exit(0)
}

let step = 'build'
try {
  console.log('\n› Building to check for errors…')
  run('npm run build')

  step = 'commit'
  console.log('\n› Committing…')
  run('git add -A')
  execSync('git commit -F -', { input: message, stdio: ['pipe', 'inherit', 'inherit'] })

  step = 'push'
  console.log('\n› Pushing…')
  run('git push')

  console.log('\n✓ Shipped. The live site updates in about a minute:')
  console.log('  https://kroketez.github.io/selo-budget/')
} catch {
  console.error(
    step === 'push'
      ? '\n✗ Committed, but the push failed. Fix the error above, then run: git push'
      : '\n✗ Stopped. Nothing was committed or pushed. Fix the error above and try again.',
  )
  process.exit(1)
}
