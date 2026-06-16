import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Voyage, ArticleScan } from '@/services/livraisonService';

interface LivraisonState {
  voyages: Voyage[];
  articlesScanned: ArticleScan[];
  loading: boolean;
  error: string | null;
}

const initialState: LivraisonState = {
  voyages: [],
  articlesScanned: [],
  loading: false,
  error: null,
};

const livraisonSlice = createSlice({
  name: 'livraison',
  initialState,
  reducers: {
    setVoyages(state, action: PayloadAction<Voyage[]>) {
      state.voyages = action.payload;
    },
    addArticleScanned(state, action: PayloadAction<ArticleScan>) {
      const exists = state.articlesScanned.find((a) => a.id === action.payload.id);
      if (!exists) state.articlesScanned.push(action.payload);
    },
    resetScan(state) {
      state.articlesScanned = [];
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const { setVoyages, addArticleScanned, resetScan, setLoading, setError } =
  livraisonSlice.actions;
export default livraisonSlice.reducer;
