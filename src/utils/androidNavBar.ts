/**
 * Android: keep Ivy above the phone's gesture / button bar. Drawing behind it
 * (viewport-fit=cover) hid the bottom of the chat on phones that don't report the
 * bar's size. If the bar is still drawn over the page, leave room for it (--nav-gap).
 */
const ASSUMED_BAR_PX = 48;
// A page that reaches this close to the screen's bottom edge is under the bar
const OVERLAID_PX = 36;

export function setupAndroidNavBar(): void {
  if (!/Android/i.test(navigator.userAgent)) return;
  const viewport = document.querySelector<HTMLMetaElement>('meta[name=viewport]');
  if (viewport) viewport.content = viewport.content.replace(/,\s*viewport-fit=cover/, '');

  const fit = () => {
    const overlaid = screen.height - window.innerHeight < OVERLAID_PX;
    document.documentElement.style.setProperty('--nav-gap', overlaid ? `${ASSUMED_BAR_PX}px` : '0px');
  };
  fit();
  window.addEventListener('resize', fit);
}
