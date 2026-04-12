/**
 * Monetag Direct Link 輔助 composable。
 *
 * 使用時機：工具頁的 Support us Modal `onAdConfirm()`。
 * 呼叫 `openDirectLink()` 會在 Monetag 模式下同步開啟新分頁到 Direct Link，
 * 非 Monetag 模式（adsense / none）則是 no-op。
 *
 * 重要：必須在使用者點擊事件的同步呼叫鏈中執行，否則會被瀏覽器彈窗攔截器擋下。
 */
export function useMonetagDirectLink() {
  const config = useRuntimeConfig()

  function openDirectLink() {
    if (config.public.adProvider !== 'monetag') return
    const url = config.public.monetagDirectLink as string
    if (!url) return
    window.open(url, '_blank', 'noopener')
  }

  function openAltDirectLink() {
    if (config.public.adProvider !== 'monetag') return
    const url = config.public.monetagDirectLinkAlt as string
    if (!url) return
    window.open(url, '_blank', 'noopener')
  }

  return {
    openDirectLink,
    openAltDirectLink
  }
}
