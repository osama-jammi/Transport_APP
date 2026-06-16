import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ChauffeurInfo } from '@/services/authService';

interface AuthState {
  chauffeur: ChauffeurInfo | null;
  isConnected: boolean;
}

const initialState: AuthState = {
  chauffeur: null,
  isConnected: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setChauffeur(state, action: PayloadAction<ChauffeurInfo>) {
      state.chauffeur = action.payload;
      state.isConnected = true;
    },
    clearChauffeur(state) {
      state.chauffeur = null;
      state.isConnected = false;
    },
  },
});

export const { setChauffeur, clearChauffeur } = authSlice.actions;
export default authSlice.reducer;
