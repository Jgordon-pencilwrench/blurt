import { execSync } from 'child_process'
import { clipboard } from 'electron'

export function getFrontmostApp(): string {
  const script = `tell application "System Events" to get name of first application process whose frontmost is true`
  return execSync(`osascript -e '${script}'`, { timeout: 3000 }).toString().trim()
}

export function typeIntoApp(text: string, appName: string): void {
  // Write to clipboard first (reliable fallback)
  clipboard.writeText(text)

  // Escape text for AppleScript string literal
  const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

  const script = [
    `tell application "${appName}" to activate`,
    `delay 0.1`,
    `tell application "System Events"`,
    `  keystroke "${escaped}"`,
    `end tell`,
  ].join('\n')

  try {
    execSync(`osascript -e '${script}'`, { timeout: 5000 })
  } catch {
    // Silently fail — text is already on clipboard as fallback
  }
}
