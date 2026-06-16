import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import livraisonReducer from './livraisonSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    livraison: livraisonReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
