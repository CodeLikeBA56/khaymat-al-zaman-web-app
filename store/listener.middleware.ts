import { createListenerMiddleware } from "@reduxjs/toolkit";
import { toast } from "sonner";
import { clearAuthSession, setAuthSession } from "@/store/auth/auth.reducer";
import { fetchEmployees, clearEmployeeState } from "@/store/employee/employee.reducer";
import { clearAttendanceState } from "@/store/attendance/attendance.reducer";
import { clearFinanceState } from "@/store/finance/finance.reducer";

export const listenerMiddleware = createListenerMiddleware();

type RejectedAction = {
  type: string;
  payload?: unknown;
  error?: { message?: string };
  meta?: { aborted?: boolean; condition?: boolean };
};

function isRejectedAction(action: unknown): action is RejectedAction {
  return (
    typeof action === "object" &&
    action !== null &&
    "type" in action &&
    typeof (action as { type?: unknown }).type === "string" &&
    (action as { type: string }).type.endsWith("/rejected")
  );
}

listenerMiddleware.startListening({
  predicate: (action): action is RejectedAction => isRejectedAction(action),
  effect: (action) => {
    if (action.meta?.aborted || action.meta?.condition) return;

    const message =
      typeof action.payload === "string"
        ? action.payload
        : action.error?.message || "Request failed.";

    toast.error(message);
  },
});

listenerMiddleware.startListening({
  actionCreator: setAuthSession,
  effect: async (action, listenerApi) => {
    if (action.payload.role === "admin") {
      await listenerApi.dispatch(fetchEmployees({ force: true }));
    }
  },
});

listenerMiddleware.startListening({
  actionCreator: clearAuthSession,
  effect: async (_, listenerApi) => {
    listenerApi.dispatch(clearEmployeeState());
    listenerApi.dispatch(clearAttendanceState());
    listenerApi.dispatch(clearFinanceState());
  },
});
