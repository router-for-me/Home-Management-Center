import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from 'react'

import {
  type PreferenceNormalizer,
  getBrowserLocalStorage,
  readPreference,
  writePreference,
} from '@/lib/ui-preferences'

export function useLocalStoragePreference<T>(
  key: string,
  defaultValue: T,
  normalize: PreferenceNormalizer<T>,
): [T, Dispatch<SetStateAction<T>>] {
  const normalizerRef = useRef(normalize)
  normalizerRef.current = normalize

  const [value, setValue] = useState(() =>
    readPreference(getBrowserLocalStorage(), key, defaultValue, normalizerRef.current),
  )

  useEffect(() => {
    writePreference(getBrowserLocalStorage(), key, value)
  }, [key, value])

  return [value, setValue]
}
