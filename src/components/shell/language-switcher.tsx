import { ChevronDown, Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { loadLanguageBundle } from '@/lib/i18n/i18n'
import { type AppLanguage, LANGUAGE_OPTIONS, persistLanguage } from '@/lib/i18n/languages'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const currentLanguage = i18n.resolvedLanguage ?? i18n.language
  const selectedLanguage = LANGUAGE_OPTIONS.some((language) => language.code === currentLanguage)
    ? (currentLanguage as AppLanguage)
    : 'en'
  const selectedOption =
    LANGUAGE_OPTIONS.find((language) => language.code === selectedLanguage) ?? LANGUAGE_OPTIONS[2]

  const handleLanguageChange = (language: AppLanguage) => {
    persistLanguage(language)
    // The bundle has to be registered before the switch, or the UI renders raw
    // keys until the chunk lands.
    void loadLanguageBundle(language).then(() => i18n.changeLanguage(language))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="lg"
          className="bg-card min-w-30 justify-between font-medium"
          aria-label={t('language.switch')}
        >
          <span className="flex min-w-0 items-center gap-2">
            <Languages className="text-muted-foreground size-3.5" aria-hidden="true" />
            <span className="truncate">{selectedOption.nativeLabel}</span>
          </span>
          <ChevronDown className="text-muted-foreground size-3.5" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{t('language.switch')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={selectedLanguage}
          onValueChange={(value) => handleLanguageChange(value as AppLanguage)}
        >
          {LANGUAGE_OPTIONS.map((language) => (
            <DropdownMenuRadioItem key={language.code} value={language.code} className="py-2">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate">{language.nativeLabel}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {language.englishLabel}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
