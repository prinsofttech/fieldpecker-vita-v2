export interface DeviceFingerprint {
  browser: {
    name: string;
    version: string;
    userAgent: string;
  };
  os: {
    name: string;
    version: string;
  };
  screen: {
    width: number;
    height: number;
    colorDepth: number;
    pixelRatio: number;
  };
  timezone: string;
  language: string;
  platform: string;
  hardwareConcurrency: number;
  deviceMemory?: number;
  canvas?: string;
  webgl?: string;
}

export async function getDeviceFingerprint(): Promise<DeviceFingerprint> {
  const browserInfo = getBrowserInfo();
  const osInfo = getOSInfo();
  const screenInfo = getScreenInfo();
  const canvasFingerprint = await getCanvasFingerprint();
  const webglFingerprint = getWebGLFingerprint();

  return {
    browser: browserInfo,
    os: osInfo,
    screen: screenInfo,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency || 0,
    deviceMemory: (navigator as any).deviceMemory,
    canvas: canvasFingerprint,
    webgl: webglFingerprint,
  };
}

function getBrowserInfo(): { name: string; version: string; userAgent: string } {
  const ua = navigator.userAgent;
  let name = 'Unknown';
  let version = 'Unknown';

  if (ua.includes('Firefox/')) {
    name = 'Firefox';
    version = ua.split('Firefox/')[1].split(' ')[0];
  } else if (ua.includes('Edg/')) {
    name = 'Edge';
    version = ua.split('Edg/')[1].split(' ')[0];
  } else if (ua.includes('Chrome/')) {
    name = 'Chrome';
    version = ua.split('Chrome/')[1].split(' ')[0];
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    name = 'Safari';
    version = ua.split('Version/')[1]?.split(' ')[0] || 'Unknown';
  } else if (ua.includes('Opera/') || ua.includes('OPR/')) {
    name = 'Opera';
    version = ua.split('OPR/')[1]?.split(' ')[0] || ua.split('Opera/')[1]?.split(' ')[0];
  }

  return { name, version, userAgent: ua };
}

function getOSInfo(): { name: string; version: string } {
  const ua = navigator.userAgent;
  let name = 'Unknown';
  let version = 'Unknown';

  if (ua.includes('Windows NT')) {
    name = 'Windows';
    const versionMap: Record<string, string> = {
      '10.0': '10/11',
      '6.3': '8.1',
      '6.2': '8',
      '6.1': '7',
    };
    const ntVersion = ua.split('Windows NT ')[1]?.split(';')[0];
    version = versionMap[ntVersion] || ntVersion;
  } else if (ua.includes('Mac OS X')) {
    name = 'macOS';
    version = ua.split('Mac OS X ')[1]?.split(')')[0].replace(/_/g, '.') || 'Unknown';
  } else if (ua.includes('Linux')) {
    name = 'Linux';
  } else if (ua.includes('Android')) {
    name = 'Android';
    version = ua.split('Android ')[1]?.split(';')[0] || 'Unknown';
  } else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) {
    name = 'iOS';
    version = ua.split('OS ')[1]?.split(' ')[0].replace(/_/g, '.') || 'Unknown';
  }

  return { name, version };
}

function getScreenInfo(): {
  width: number;
  height: number;
  colorDepth: number;
  pixelRatio: number;
} {
  return {
    width: window.screen.width,
    height: window.screen.height,
    colorDepth: window.screen.colorDepth,
    pixelRatio: window.devicePixelRatio || 1,
  };
}

async function getCanvasFingerprint(): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const text = 'FieldPecker Security';
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText(text, 2, 15);
    ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.fillText(text, 4, 17);

    return canvas.toDataURL().substring(0, 100);
  } catch {
    return '';
  }
}

function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return '';

    const debugInfo = (gl as any).getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return '';

    const renderer = (gl as any).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    const vendor = (gl as any).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);

    return `${vendor}~${renderer}`.substring(0, 100);
  } catch {
    return '';
  }
}

export function getDeviceIdentifier(fingerprint: DeviceFingerprint): string {
  return `${fingerprint.browser.name} ${fingerprint.browser.version} - ${fingerprint.os.name}`;
}
