import { createAction, createReducer } from "@reduxjs/toolkit";
import type { Role } from "@/config/roles";

export type AuthSessionPayload = {
  uid: string;
  role: Role;
};

type AuthState = {
  uid: string | null;
  role: Role | null;
};

const initialState: AuthState = {
  uid: null,
  role: null,
};

export const setAuthSession = createAction<AuthSessionPayload>("auth/SET_SESSION");
export const clearAuthSession = createAction("auth/CLEAR_SESSION");

export const authReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(setAuthSession, (state, action) => {
      state.uid = action.payload.uid;
      state.role = action.payload.role;
    })
    .addCase(clearAuthSession, (state) => {
      state.uid = null;
      state.role = null;
    });
});
