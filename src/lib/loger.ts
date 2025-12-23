import { toast } from "sonner"
import * as Sentry from "@sentry/browser"

type LoggerFunc = (message: string, details?: unknown) => void;

export const LOGGER = {
    error: ((message, error) => {
        const errorMsg = error instanceof Error ? error.message : String(error);
        toast.error(message, { description: errorMsg });
        console.error(message, errorMsg);
        Sentry.captureException(error);
    }) as LoggerFunc,
    log: ((message, details) => {
        const detailsMsg = String(details)
        toast(message, { description: detailsMsg })
        console.log(message, details)
    }) as LoggerFunc,
    success: ((message, details) => {
        const detailsMsg = String(details)
        toast.success(message, { description: detailsMsg })
        console.log(message, details)
    }) as LoggerFunc,
}
