'use client'

import { createContext, useContext, useMemo } from 'react'
import { machines as configMachines, deserializeMachine, type Machine, type SerializedMachine } from './machine'

/**
 * The live machine roster, read on the server and handed down once per
 * request (see `getLiveMachinesSerialized`). Client components take prices
 * and prize tables from here rather than importing data/machine.json, so what
 * they show is what the contract charges and pays.
 *
 * Outside a provider it falls back to the config roster, which is exactly
 * right in demo mode.
 */
const MachinesContext = createContext<Machine[]>(configMachines)

export function MachinesProvider({
  machines,
  children,
}: {
  machines: SerializedMachine[]
  children: React.ReactNode
}) {
  const value = useMemo(() => machines.map(deserializeMachine), [machines])
  return <MachinesContext.Provider value={value}>{children}</MachinesContext.Provider>
}

export function useMachines() {
  const machines = useContext(MachinesContext)
  return useMemo(
    () => ({
      machines,
      defaultMachine: machines[0],
      byId: (id: string) => machines.find((m) => m.id === id),
      byTier: (tierId: number) => machines.find((m) => m.tierId === tierId),
    }),
    [machines],
  )
}
