// import download from '@/components/downloads/download'
import { combineReducers } from 'redux'
import { persistStore, persistReducer } from 'redux-persist'
import storage from 'redux-persist/lib/storage'
import downloadSlice from './slice/downloadSlice'
import { configureStore } from '@reduxjs/toolkit'
import modsSlice from './slice/modsSlice'
import settingsSlice from './slice/settingsSlice'
import authSlice from './slice/authSlice'


const rootReducer = combineReducers({
  downloadSlice,
  modsSlice,
  settingsSlice,
  authSlice
})

const persistConfig = {
  key: 'root',
  storage,
  
  whitelist: ['downloadSlice', 'settingsSlice', 'authSlice'] 
}

const persistedReducer = persistReducer(persistConfig, rootReducer)
 
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
})

export const persistor = persistStore(store)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// const persistedReducer = persistReducer(persistConfig, rootReducer)
// const store = createStore(persistedReducer)
 
// export type RootState = ReturnType<typeof rootReducer>
// export type AppDispatch = typeof store.dispatch

// export default () => {
  
//   let persistor = persistStore(store)
//   return { store, persistor }
// }