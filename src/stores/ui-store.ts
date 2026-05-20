import { create } from 'zustand'

type ConsoleUiState = {
  connectionDialogOpen: boolean
  commandPaletteOpen: boolean
  setConnectionDialogOpen: (open: boolean) => void
  openConnectionDialog: () => void
  setCommandPaletteOpen: (open: boolean) => void
  openCommandPalette: () => void
  toggleCommandPalette: () => void
}

export const useConsoleUiStore = create<ConsoleUiState>((set) => ({
  connectionDialogOpen: false,
  commandPaletteOpen: false,
  setConnectionDialogOpen: (open) => set({ connectionDialogOpen: open }),
  openConnectionDialog: () => set({ connectionDialogOpen: true }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
}))
