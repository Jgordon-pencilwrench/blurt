import { execSync } from 'child_process'
import { clipboard } from 'electron'

export function getFrontmostApp(): string {
  const script = `tell application "System Events" to get name of first application process whose frontmost is true`
  return execSync(`osascript -e '${script}'`, { timeout: 3000 }).toString().trim()
}

export function typeIntoApp(text: string, appName: string): void {
  // Write to clipboard first (reliable fallback)
  clipboard.writeText(text)

  // Activate by process name then paste from clipboard (preserves newlines,
  // unicode, bullet points — anything keystroke would mangle)
  const script = [
    `tell application "System Events"`,
    `  set frontmost of first process whose name is "${appName}" to true`,
    `end tell`,
    `delay 0.15`,
    `tell application "System Events"`,
    `  keystroke "v" using command down`,
    `end tell`,
  ].join('\n')

  try {
    execSync(`osascript -e '${script}'`, { timeout: 5000 })
  } catch {
    // Silently fail — text is already on clipboard as fallback
  }
}
