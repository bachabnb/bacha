import { THEME_STORAGE_KEY } from './ThemeProvider'

/**
 * Applies the theme before first paint.
 *
 * This runs synchronously in <head>, ahead of any stylesheet-dependent paint,
 * so a returning visitor on light mode never sees a black flash. It is also
 * why nothing in the React tree branches on theme during render — the DOM is
 * already correct by the time hydration happens, so there is no mismatch.
 */
export function ThemeScript({ defaultTheme = 'light' }: { defaultTheme?: 'light' | 'dark' }) {
  // Light is the product's primary theme. A visitor who has explicitly chosen
  // dark, or explicitly chosen to follow their OS, gets what they asked for —
  // but an unset preference is light rather than whatever the system says.
  const script = `(function(){try{
var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
var t=(s==='light'||s==='dark')?s
  :(s==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')
  :${JSON.stringify(defaultTheme)});
document.documentElement.setAttribute('data-theme',t);
document.documentElement.style.colorScheme=t;
}catch(e){document.documentElement.setAttribute('data-theme',${JSON.stringify(defaultTheme)});}})();`

  return <script dangerouslySetInnerHTML={{ __html: script }} suppressHydrationWarning />
}
