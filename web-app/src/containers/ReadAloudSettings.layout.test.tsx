import { render, screen } from '@testing-library/react'
import { page } from '@vitest/browser/context'
import { describe, it } from 'vitest'
import { ReadAloudSettings } from './ReadAloudSettings'
import { ReadAloudButton } from './ReadAloudButton'
import { expectNoHorizontalOverflow, setFontSize, setTheme, settle, withTranslations } from '@/test/layout'

describe('read aloud controls', () => {
  for (const width of [1024, 1280]) for (const size of ['16px', '20px']) for (const theme of ['light', 'dark'] as const) {
    it(`fits ${width}px ${size} ${theme} beside the open sidebars`, async () => {
      await page.viewport(width, 900)
      setFontSize(size)
      setTheme(theme)
      render(withTranslations(<div style={{ marginLeft: 480, padding: 16 }}>
        <div data-testid="speech-settings"><ReadAloudSettings /></div>
        <div data-testid="reply-actions" className="flex items-center gap-1"><ReadAloudButton id="reply" text="A completed reply." /></div>
      </div>))
      await settle()
      expectNoHorizontalOverflow(screen.getByTestId('speech-settings'))
      expectNoHorizontalOverflow(screen.getByTestId('reply-actions'))
    })
  }
})
