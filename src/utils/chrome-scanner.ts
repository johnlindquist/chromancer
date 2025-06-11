import * as net from 'net'

export interface ChromeInstance {
  port: number
  url: string
  version?: any
}

/**
 * Check if a port is open and has Chrome DevTools
 */
async function checkChromePort(port: number, host: string = 'localhost'): Promise<boolean> {
  try {
    const response = await fetch(`http://${host}:${port}/json/version`, {
      signal: AbortSignal.timeout(1000),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Get Chrome version info from a port
 */
async function getChromeInfo(port: number, host: string = 'localhost'): Promise<any | null> {
  try {
    const response = await fetch(`http://${host}:${port}/json/version`, {
      signal: AbortSignal.timeout(1000),
    })
    if (response.ok) {
      return await response.json()
    }
  } catch {
    // Ignore errors
  }
  return null
}

/**
 * Scan for Chrome instances on common debugging ports
 */
export async function scanForChromeInstances(
  host: string = 'localhost',
  startPort: number = 9222,
  endPort: number = 9232
): Promise<ChromeInstance[]> {
  const instances: ChromeInstance[] = []
  const checkPromises: Promise<void>[] = []
  
  for (let port = startPort; port <= endPort; port++) {
    checkPromises.push(
      (async () => {
        if (await checkChromePort(port, host)) {
          const info = await getChromeInfo(port, host)
          instances.push({
            port,
            url: `http://${host}:${port}`,
            version: info,
          })
        }
      })()
    )
  }
  
  await Promise.all(checkPromises)
  return instances.sort((a, b) => a.port - b.port)
}

/**
 * Find an available port for Chrome
 */
export async function findAvailablePort(
  startPort: number = 9222,
  endPort: number = 9232
): Promise<number | null> {
  for (let port = startPort; port <= endPort; port++) {
    const isAvailable = await checkPortAvailable(port)
    if (isAvailable) {
      return port
    }
  }
  return null
}

/**
 * Check if a port is available (not in use)
 */
export async function checkPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => {
      server.close()
      resolve(true)
    })
    server.listen(port)
  })
}

/**
 * Wait for Chrome to be ready on a port
 */
export async function waitForChromeReady(
  port: number,
  host: string = 'localhost',
  maxRetries: number = 10,
  retryDelay: number = 1000
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    if (await checkChromePort(port, host)) {
      return true
    }
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }
  }
  return false
}