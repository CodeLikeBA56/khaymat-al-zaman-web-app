import { configureStore } from "@reduxjs/toolkit";
import { authReducer } from "@/store/auth/auth.reducer";
import { employeeReducer } from "@/store/employee/employee.reducer";
import { attendanceReducer } from "@/store/attendance/attendance.reducer";
import { financeReducer } from "@/store/finance/finance.reducer";
import { supplierReducer } from "@/store/supplier/supplier.reducer";
import { expenseCategoryReducer } from "@/store/expense-category/expense-category.reducer";
import { salaryPlanReducer } from "@/store/salary-plan/salary-plan.reducer";
import { expenseTransactionReducer } from "@/store/expense-transaction/expense-transaction.reducer";
import { listenerMiddleware } from "@/store/listener.middleware";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    finance: financeReducer,
    employee: employeeReducer,
    attendance: attendanceReducer,
    supplier: supplierReducer,
    expenseCategory: expenseCategoryReducer,
    salaryPlan: salaryPlanReducer,
    expenseTransaction: expenseTransactionReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().prepend(listenerMiddleware.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;
