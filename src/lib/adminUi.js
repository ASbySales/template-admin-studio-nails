import { createContext, useContext } from 'react'

export const AdminUIContext = createContext({
  avisar: () => {},
  confirmar: async () => false,
  tema: 'gold',
  setTema: () => {},
})

export const useAdminUI = () => useContext(AdminUIContext)
