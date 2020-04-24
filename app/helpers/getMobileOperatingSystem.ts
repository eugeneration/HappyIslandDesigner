// https://stackoverflow.com/questions/53666113/

export function getMobileOperatingSystem() {
  // @ts-ignore window.opera
  var userAgent = navigator.userAgent || navigator.vendor || window.opera;

  // Windows Phone must come first because its UA also contains "Android"
  if (/windows phone/i.test(userAgent)) {
    return "Windows Phone";
  }

  if (/android/i.test(userAgent)) {
    return "Android";
  }

  // iOS detection from: https://stackoverflow.com/questions/9038625/
  let isIOS = /iPad|iPhone|iPod/.test(navigator.platform)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIOS) {
    return "iOS";
  }

  return "unknown";
}
