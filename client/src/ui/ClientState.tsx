import React, { createContext, useContext, useState } from 'react';

type Screen = 'LOGIN' | 'CHAR_SELECT' | 'GAME';

interface ClientStateContextType {
    currentScreen: Screen;
    setScreen: (screen: Screen) => void;
}

const ClientStateContext = createContext<ClientStateContextType | undefined>(undefined);

export const ClientStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentScreen, setScreen] = useState<Screen>('LOGIN');

    return (
        <ClientStateContext.Provider value={{ currentScreen, setScreen }}>
            {children}
        </ClientStateContext.Provider>
    );
};

export const useClientState = () => {
    const context = useContext(ClientStateContext);
    if (!context) throw new Error('useClientState must be used within a ClientStateProvider');
    return context;
};
