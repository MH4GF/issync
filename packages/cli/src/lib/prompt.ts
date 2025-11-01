interface ConfirmOptions {
  message: string
  question?: string
}

/**
 * Confirms an action with the user in interactive mode
 * Returns true if confirmed (or in non-interactive mode), false if cancelled
 */
export async function confirmAction(
  options: ConfirmOptions,
  inputStream = process.stdin,
  outputStream = process.stdout,
): Promise<boolean> {
  console.warn(options.message)

  // In non-interactive mode, always proceed
  if (!inputStream.isTTY) {
    return true
  }

  const readline = await import('node:readline')
  const rl = readline.createInterface({
    input: inputStream,
    output: outputStream,
  })

  const answer = await new Promise<string>((resolve) => {
    rl.question(options.question ?? 'Continue? [y/N] ', resolve)
  })
  rl.close()

  return answer.toLowerCase() === 'y'
}
