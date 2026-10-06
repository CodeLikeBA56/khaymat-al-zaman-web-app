import { configureStore } from "@reduxjs/toolkit";
import { authReducer } from "@/store/auth/auth.reducer";
import { employeeReducer } from "@/store/employee/employee.reducer";
import { attendanceReducer } from "@/store/attendance/attendance.reducer";
import { financeReducer } from "@/store/finance/finance.reducer";
import { listenerMiddleware } from "@/store/listener.middleware";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    finance: financeReducer,
    employee: employeeReducer,
    attendance: attendanceReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(listenerMiddleware.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;
